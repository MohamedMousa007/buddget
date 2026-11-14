# S2 closing note: SMS accuracy fixes

Date 2026-11-14, model Fable 5.2. Spec: `docs/launch/S1-sms-audit.md` sections 4, 5 and 6a. Branch `claude/fable-5-prioritization-c5372d`, one commit per slice. No live row was repaired or backfilled, no template was promoted, no native build was run. Three additive migrations were applied to the live project (0261, 0262, 0263).

## Metrics before and after

"Now" is what production stored. "Replay" runs today's decision code over the same rows (structured columns plus masked bodies, both kept out of git). Replay shows what new messages will get and what an S3 repair can reach; the live rows themselves are unchanged.

| Metric | Train now | Train replay | Holdout now | Holdout replay | Target | Met |
|---|---|---|---|---|---|---|
| SMS expenses shown as Cash without being cash | 296 | 0 | 126 | 0 | 0 | yes |
| Unplaced SMS expenses, users with an account | 73% | 38% | 72% | 45% | under 10% | no |
| Unplaced SMS expenses, all users | 77% | 46% | 77% | 51% | under 10% | no |
| Purchases with a normalized merchant | 52% | 100% | 48% | 100% | 95% or more | yes |
| Purchases in Other or uncategorised | 30% | 23% | 41% | 35% | under 25% | train only |
| Same merchant, same category (per user) | 96% | 100% | 98% | 100% | 100% | yes |
| Wallet top-up legs counted as income or expense | 89% | 3% | 100% | 0% | 0 | holdout yes, train 1 leg left |
| Relay legs flagged "possible pass-through" | 0% | 91% | 0% | 90% | 90% or more | yes |
| FX legs booked wrongly | 2 of 3 | 0 | 0 of 1 | 0 | 0 | yes |
| Parsed messages needing the AI | 57% | 57% (floor 10%) | 59% | 59% (floor 12%) | under 35% | no |
| Repeat rejected shapes sent to the AI | 17 | 0 | 5 | 0 | 0 | yes |

Two baselines differ from the audit because they are measured differently, not because anything moved: "Other" is 30 to 41% here (the category on the expense, after the background categoriser) against 74% in the audit (the category on the log row); and relay is about 21 real pairs, not 79 (see findings).

To reprint: export `scripts/qa/sms-gold-inputs.sql` to `.claude/sms-gold-inputs.json`, optionally `id -> masked_body` to `.claude/sms-gold-bodies.json`, then `npx vitest run src/lib/sms/gold --reporter=verbose`. Without the local files only the fixture checks run.

## What shipped

**Slice 0, harness** (`d252d236`). `src/lib/sms/gold/goldSet.json`: 936 log ids with labels only (split, top-up partner, relay partner, FX direction), no text. Holdout is the audit's rule (289 rows before removing the 16 owner-review ids, which are left out). `goldMetrics.ts` and its test print the table above.

**Slice 1, accounts** (`fe9dee68`, migration 0261).
- A bank-message expense with no account is labelled "Unassigned" in the Flow ledger and the expense day list. A manual cash expense is untouched.
- The server creates a provisional account only when bank, digits (three or more) and currency are all present, never for a pass-through rail, and never when a registered account already fits or two fit. Dedupe is a unique index on user + name (bank and digits) + currency.
- A provisional account carries history at once but can never hold a balance or reach net worth, and it is hidden from the accounts list until answered.
- It appears first in the existing detected-accounts sheet with three answers, each with Undo: Keep (earlier messages with the same digits are re-attributed), Link existing (merge: every row is re-pointed, the target learns the digits, Undo restores the account and moves the rows back), Not mine (kept as an excluded account so it is not re-created).
- Re-attribution on adding an account or an alias already existed (`useReattribute`) and now also runs on Keep.

**Slice 2, merchant and category** (`c9a95a21`).
- `merchantDictionary.ts`: gateway prefixes stripped, case folded, about 145 Egypt and Saudi merchants named and categorised ahead of the AI, cut-off names completed when exactly one brand fits, trade words (pharmacy, market, restaurant and their Arabic and transliterated forms) for the category when the brand is unknown.
- One merchant, one category per user: own correction, then dictionary and catalog, then the user's earlier purchases at that merchant, then the shared memory, and only then this message's AI category. When the background categoriser learns a merchant, the user's earlier "Other" rows at that merchant follow.
- `merchant_normalized` is written on every tier, for purchases only.
- A deduction worded as service value plus stamp tax is a Utilities bill, not a fee.
- A bare company-form word ("Establish", "Company S") is never remembered as a merchant: it is many shops.

**Slice 3, transfers** (`4e782d14`, migration 0262).
- Verified with the harness that the existing top-up step fires once the wallet is known. It also now matches any exact spelling of the wallet's brand (a wallet printed under its newer brand name was the reason most top-ups never matched).
- Money in and the same amount out of one account is never settled as an own transfer by the registered-account fallback (it would have been auto-excluded as soon as accounts existed).
- Those pairs are labelled "Possible pass-through" on both legs. The user is asked once, with the count and total stated. "No" is remembered and nothing changes. "Yes" is remembered, applies to current and later pairs, comes with Undo, and each leg can be counted again on its own (the expense through its existing exclusion control, the credit through a new "Count as income" action in the income detail sheet).
- "My names": the counterparty is compared with the profile name and display name before anything is stored or masked; only a boolean is kept. It reclassifies a transfer only together with a confirmed (not provisional) own account. Two shared name parts including the first are required.
- An own transfer seen from the receiving account now credits that account (it used to book the receiving account as the source).
- Transfer counterparty names are no longer written to `sms_parse_log.merchant` or `merchant_normalized`.

**Slice 4, currency exchange** (`2ec0b5a2`). One row per exchange. Debit first: the row's source is the debited account and the credit leg only fills in the destination. Credit first: the row is posted with the credited account as destination and no source, and the debit leg then makes itself the source with the amount that actually left.

**Slice 5, speed** (`e265c31a`, migration 0263).
- Negative cache: an exact masked shape the AI rejected twice, and that never parsed for anyone, is rejected without another AI call. It fails open.
- `shape_key`: a coarse key (sender key, first four words, number of numeric slots) stamped on every new log row. It cuts distinct shapes from 420 to 162 on train and 212 to 101 on holdout.
- Shadow mode: verified with a probe inside a transaction that was rolled back. `record_sms_template_shadow` moved the one quarantined template from 0 to 1 agreement and left it quarantined; live data is unchanged (still 0). The counter is 0 everywhere because it only counts on quarantined templates and resets on exoneration, not because it is unwired.

## What did not ship

1. **Unplaced under 10% is not reachable under rule 6a.1.** After provisional accounts, 38 to 51% stay Unassigned, and in nearly all of them the bank is unknown (172 of 177 on train, 82 of 83 on holdout). These are sender-less iOS messages whose body does not name the bank. Needs an owner decision (below).
2. **"Other" on holdout is 35%.** What is left is local shops whose names the bank cuts to nine characters. A dictionary cannot name them.
3. **The AI share itself is unchanged.** Nothing was promoted, by instruction. The floor is 10 to 12% if every shape seen once had a template.
4. **Promotion rule: proposed, not applied.**
5. **A user-editable "my names" list.** The signal uses the profile name and display name only.
6. **Counterparty memory by salted hash.** Dropped by decision 6a.2 (one remembered answer, no relay engine).
7. **FX rate on the pair.** There is no column for it; the row keeps what left the source.
8. **The edit sheet for an Unassigned expense still preselects Cash in its account picker.** The lists are fixed; the picker is not.
9. **Repair of existing rows** (S3): the 422 unplaced rows, the old top-up and FX rows, `merchant_normalized` on old rows, names already stored in `merchant`, `shape_key` on old rows.

## Needs the owner

1. **Unassigned for sender-less messages.** Options: (a) keep 6a.1 as is and accept about 40% Unassigned for iOS users until they add accounts; (b) allow a provisional account from digits + currency alone, named "Account ••1234", with the bank asked at confirmation; (c) have the iOS Shortcut pass the sender. I recommend (c) where possible and (b) otherwise, because the digits already identify the account on the user's own phone.
2. **Promotion rule.** `check_sms_promotion_eligibility` hard-codes `GREATEST(min_unique_users, 5)`, so changing the config alone cannot help. Proposed: promote when a template has 2 or more users, or 1 user with at least 15 matches on one `shape_key`, zero failures and at least 14 days of age; in both cases only after the holdout replay passes and with shadow mode on. Today the best template has 31 matches and 2 users.
3. **The 15 relabels** from audit section 2 are still out of the gold set.
4. **Review before S3**: provisional account currency is the currency of the first message seen (a card whose first message is a foreign purchase gets that currency until edited).

## Findings worth knowing

- **Relay pairs are about 21, not 79.** The audit's join was many-to-many: one user has 19 credits and 21 debits of repeated amounts, which join into 75 combinations. One-to-one there are 19 pairs for that user and 2 or 3 for another.
- **Stored bank names are missing on old rows** (621 of 952). Today's route names the bank from the body, so the harness re-derives it from masked bodies; a repair in S3 must do the same.
- **`clean_title` on transfer rows still carries the counterparty name** in `sms_parse_log`. Only `merchant` and `merchant_normalized` were in scope. For S4.
- **A pre-existing test fixture contains what looks like a real personal name** (`src/lib/sms/ipnTransfer.test.ts`, the outbound message constant). Not introduced here; for S4.
- **Server-side SQL that totals income** (admin analytics, snapshots) does not know `income_events.exclusion`. The app's totals do. For S4.
- **`sms_try_pair` itself still allows a same-account pair**; the guard is in `dispatch.ts`. Moving it into the function belongs with S3.
- `scripts/qa/schema.public.sql` (used only by `npm run test:pg`) does not have the new columns.

## Migrations applied to live (all additive)

- `0261_payment_methods_provisional.sql`: `payment_methods.provisional`, unique index for provisional identity.
- `0262_pass_through_and_self_counterparty.sql`: `income_events.exclusion` (check: null or `pass_through`), `sms_parse_log.counterparty_is_self`.
- `0263_sms_shape_key_negative_cache.sql`: `sms_parse_log.shape_key`, index on it, hash index on `masked_body`.

`database.types.ts` was edited by hand for these five columns rather than regenerated in full.

## Gate

`npm run verify` passed on the final tree (2026-11-14): lint 0 errors, types clean, 5173 tests in Cairo and New York, coverage 86.8% lines and 77.7% branches, migration check, dependency audit, production build. A first run failed on one test that was added while that run was in progress and executed before its fix was saved; it passes on the settled tree and the full gate was re-run from scratch.

---

# S2 follow-up: the four fixes for the missed targets

Date 2026-11-14. Spec: `docs/launch/S1-sms-audit.md` 6b and 6c. Built in the order 3, 1, 4, 2. Design and diff review by Fable; the admin views, the bank picker, the test fakes, the own-transfer endpoint and prompts, and the category prompts were written by Sonnet subagents and reviewed. Migrations 0264 to 0267 are applied to the live project; all are additive except two function replacements (the promotion eligibility check and the category-edit trigger).

## Metrics after the follow-up

| Metric | Train: S2 → now | Holdout: S2 → now | Target |
|---|---|---|---|
| Unplaced SMS expenses, all users | 46% → 14% | 51% → 15% | under 10% |
| Purchases in Other or uncategorised | 23% → 22% | 35% → 31% | under 25% (relaxed to 30% by the council) |
| Parsed messages needing the AI | 57% → 57% | 59% → 59% | under 35% |

Unplaced: every row still unassigned has no account digits at all (53 of 53 on train, 24 of 25 on holdout), so it cannot become an account. The AI share did not move: the two promotions give no new reach yet (see part 3).

Provider cascade, scored on rows whose bank is known, with that knowledge hidden:

| Stage | Train precision / coverage | Holdout precision / coverage | Acts on its own |
|---|---|---|---|
| Body (hotline, then name) | 100% (51 of 51) / 38% | 100% (24 of 24) / 39% | yes |
| Same user's history of the digits | 100% (128 of 128) / 96% | 100% (61 of 61) / 98% | yes |
| Other users' format, 3+ users | 100% (22 of 22) / 16% | 100% (8 of 8) / 13% | yes, at 3+ users with nothing contradicting |
| Other users' format, 1 or 2 users | 100% (89 of 89) / 66% | 100% (40 of 40) / 65% | no: suggestion only |

On the sender-less messages themselves the cascade names a bank for 46% (train) and 42% (holdout), up from 11% and 10%: about a third from the body and two thirds from history. The format stage names none of them today: the sender-less users' formats have not been seen from three other users.

## Part 3: template promotion

**Shipped**
- Kill switch: "Switch off" in the admin Templates panel (new op `kill`). Switching off, demoting or disabling a template flags every transaction it created (`sms_parse_log.template_revoked_at`).
- Manual promotion and the admin "run auto-promote" now go through the replay gate; before, both promoted without one.
- Rule: the hard-coded 5-user floor is 2. A template with any recorded failure is never eligible. A single-user template (15+ matches, zero failures, 14+ days) is only listed under "Needs staff approval" in the Promotion panel; approving runs the replay gate.
- `src/lib/sms/gold/templateReplay.ts`: replays a template over every stored message (952, all users, including the non-transactions), and compares its amount, direction (after the direction guard), currency and digits with the reading of the other tiers.

**Promotions made (2 of 47 active learned templates)**

Gate: zero false positives, zero disagreements on amount, direction, currency or digits, same kind as the other tier, 3+ independent readings, 3+ of them on raw text, 14+ days old, no recorded failure.

| Template | Before → after | Evidence |
|---|---|---|
| `b0f41406-7b18-4525-9d5f-c8c7c03bfa44` (income) | template → curated_db | 2 users, 82 days old, 3 independent readings, all 3 compared exactly, 0 disagreements, 0 false positives |
| `a7986fbd-a629-44f4-90f6-6afb15ade219` (purchase) | template → curated_db | 1 user, 24 days old, 56 independent readings, 6 compared exactly, 0 disagreements, 0 false positives |

Neither template matched any message of a user who had not contributed to it, in either direction: no cross-user false positive, and no cross-user proof either. So the promotions change nothing for today's users; they only make these two formats parse without the AI for the next user of the same bank.

Rollback (either or both):
```sql
update public.sms_tracking_templates_ai
   set tier = 'template', promoted_at = null, auto_promoted = false, updated_at = now()
 where id in ('b0f41406-7b18-4525-9d5f-c8c7c03bfa44', 'a7986fbd-a629-44f4-90f6-6afb15ade219');
```
or use Demote / Switch off in the admin Templates panel, which also flags the rows they parsed.

Not promoted, and why: 6 more passed the first gate but failed the stricter one (too young, the other tier chose a different kind, or too few exact comparisons); 6 have recorded failures; 1 matched a non-transaction message; the rest have fewer than 3 independent readings.

Config change: `sms_promotion_config.min_unique_users` 5 → 2. To restore: `update public.sms_promotion_config set min_unique_users = 5 where id = 1;` (the function floor would still be 2).

## Part 1: bank for sender-less messages

**Shipped and applied**
- The cascade (`providerCascade.ts`), with the stage recorded on every row (`bank_source`): sender, code pattern, body, the user's confirmed account, the user's history of the digits, other users' format.
- Body stage made safer: a hotline outranks a name, and a bank name inside a transfer or cash-machine message is not taken for the sender unless it opens the message. This removed the one wrong answer the stage had.
- History: 4+ digits, exactly one bank; a second bank drops the mapping. A bank that was itself inferred is never evidence for the next message.
- The AI's bank name no longer sets the bank anywhere. It is stored as a suggestion (`bank_suggestion`).
- Fallback: with no bank but 4+ digits and a currency, a provisional "Account ••1234". Keeping it opens the existing provider picker (Egypt and Saudi first); the confirmed account then names the bank for later messages and counts as that user's one vote for the format.

**Log-only, and why**
- Format memory below 3 distinct users: it only fills `bank_suggestion`. At today's scale that is every sender-less case.
- The suggestion is stored but not yet shown as the pre-selected bank in the picker (the picker has no pre-selection input and was not reshaped).

**iPhone sender.** `docs/IOS_SMS_TRACKING.md` already records it: the Shortcuts Message automation hands over the text and nothing about the sender (0 of 824 forwarded messages carried one). One route exists without Apple changing anything: the automation is filtered per sender or per phrase, so each automation could pass a fixed "bank" value the user picks when setting it up. That changes the Shortcut and its setup steps, so it was not done.

## Part 4: own-account transfers

**Shipped and applied**
- `ownTransferDecision.ts`. Settles only on: a debit and a credit on different accounts, captured by the same device, same amount (a fee difference only with a matching reference), plus one of: same reference, same counterparty name, counterparty digits of an own account, or the user's remembered answer.
- Counterparty names are compared as a per-user salted hash (`counterparty_hash`); the name is not stored and hashes cannot be joined across users.
- Every leg's signals, verdict and candidate are recorded.
- This is stricter than before: a shared reference alone, or two registered accounts with a fee difference, used to settle; now they ask.
- Middle evidence: the user is asked once in Flow; the answer is remembered per pair of accounts (`sms_own_transfer_answers`) and becomes a signal for later pairs.
- Undo: a settled pair shows once in Flow with Undo; the income is restored and the expense counts as spending again (`POST /api/sms/own-transfer`).
- The same account on both legs stays "possible pass-through". A provisional account alone no longer makes a transfer an own transfer. The profile-name signal can only raise a question.

**Log-only, and why**
- Self-name learned from confirmed pairs (signal d): nothing reads it. The hashes of confirmed pairs are stored, which is what a later rule needs; there are no user-confirmed pairs yet (the threshold is 3).

**Measured.** In five months there are 54 candidate in/out pairs. 52 are on one account (pass-through; the rule calls none of them an own transfer, so zero false merges), 1 is a real cross-account pair on one device with a shared reference (settles under the new rule, as it did before), and 1 has an unknown account. Precision cannot be stated on one pair.

**To know.** 24% of the last 30 days' messages carry no device id (older app builds). For those users a real own transfer is asked about instead of settled.

## Part 2: categories for cut-off names

**Shipped and applied**
- A cut-off name is filed with the user's own earlier merchant it is a prefix of, or the reverse, only with 5+ shared characters and exactly one fit.
- A manual category edit now also files the same merchant's other uncategorised purchases at once, with Undo (rows the user already categorised are never changed).
- Ask once per unknown merchant with 2+ purchases, in Flow. There is no reusable category picker (the only one is inside the expense form), so the question opens the existing expense sheet on one of the purchases: choosing a category there files the rest. Either answer, including "Not now", is remembered.
- The AI's guess is not shown as a pre-selection in that sheet.
- Learning from an edit happens only on purchases: no key derived from a transfer, cash-machine or wallet description is stored.

**Log-only, and why**
- A category another user's purchases taught is applied only from a curated seed row or from 5+ distinct users agreeing. The 117 single-source AI rows in the shared table are no longer applied to other users; they remain as a log.

**Measured.** Top-1 accuracy against edits and the revert rate cannot be stated: there is 1 manual category edit in the whole database.

**Not changed, for the owner to decide.** The background AI categoriser still sets the category of a purchase nobody knows (it did before this work). Under the new guard it would only pre-fill the question. Switching it to suggestion-only would push "Other" back up until users answer.

## Needs the owner

1. The AI categoriser: keep applying its guess, or make it suggestion-only (above).
2. Whether to add a "bank" value to the iPhone Shortcut setup (part 1).
3. A reusable category picker does not exist. If the ask-once question should let the user pick in place, a `CategoryGrid` primitive would have to be extracted from the expense form (a new component, so it waits for your say).
4. `useSmsCounterparty` reads the transfer counterparty from `sms_parse_log.merchant`, which S2 stopped writing for transfers; where that hook is shown the name now comes only from the transaction title.
5. The two promotions and the 5 → 2 config change are live; the rollback SQL is above.
6. The 15 relabels are still out of the gold set.
