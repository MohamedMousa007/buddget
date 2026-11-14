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
