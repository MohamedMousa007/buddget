# S2d closing note: SMS fix session, batch 2

Date 2026-11-14. Scope: section 4 of `docs/launch/S2c-closing.md` (both lists), plus three council items that arrived during the session. Fable 5.2 ordered the work, designed each item and reviewed every diff; Sonnet coders wrote the code and tests. No personal names or message text appear here; rows are cited by the first 8 characters of the log id.

The invariants are still `docs/launch/S2c-invariants.md`; this batch appended "S2d additions" sections to it (refund rules, wallet fee rule, the new flags and their defaults, the card-load rule, the row version, the repair-flag contract).

**Re-run the S3 dry-run after commit `bbd1480d`** (the last code commit of this batch; this note is committed after it). No repair of live rows was done and no native build was run.

## 1. What shipped

### Group 1: how a message is classified or booked

| Item | What changed | Migration |
|---|---|---|
| Rest of N2 | A refund smaller than its purchase stamps `refunded_amount` on the purchase and leaves it counted for the remainder (one partial refund per purchase). A refund in another currency matches only as a full refund, within 15% by an approximate rate. A purchase that arrives after its refund takes the stamp and retracts the refund's placeholder with the marker. The "same refund sent twice" check has three outcomes: same reference or within 10 minutes is acknowledged; a same-amount stamp within 3 days with nothing proving it is the same event matches nothing and asks; otherwise normal matching. Stamps are guarded and a lost race falls back to asking. The refund picker offers larger purchases. | 0275 |
| N7 | With one card debt or one instalment plan, a message that names another credit card, another bank, or (instalments) another provider and amount asks instead of being applied. Unknown on either side still applies. | none |
| N13 | An app-logged subscription charge replaced by a bank-message charge within 5 days is deleted through the normal delete after each sync, nearest row only, so the delete reaches the server. | none |
| N6 | A message the phone flagged as cut is held for review (`truncated_amount`). See section 2 for the half that was dropped. | none |
| N8 | A failed write of the tracking switch is remembered per account and replayed at the next start, and wins over the stale device row. | none |
| N9 | A wallet top-up with a fee pairs in both arrival orders when one leg is a purchase at the user's own wallet and the other names the same wallet; the fee is booked as spending. A credit naming a wallet brand the user has not added stays income, flagged `wallet_unregistered`, with a prompt. | 0277 |
| N14 | One predicate for "this row counts" at the budget committed view, the subscription paid figure and the budget debt lines. | none |
| P2-3 | Three code patterns for the compact Saudi format (purchase at a terminal, online purchase, transfer in): 108, 13 and 23 stored rows match, none of another kind. | none |
| Curated templates | 3 of the 8 bank-name-keyed templates re-keyed by body shape; 21, 1 and 12 stored sender-less messages are now in scope. | 0280 |
| Confirm route (N19) | The parse stores the resolved day, the flags and the kind source on the log; confirm books on that day with the flags, the device and the counterparty facts. A currency confirmation changes only rows the message owns. A confirmed row is still treated as code-asserted. | 0276 |
| Stale phone copy | Row version `server_rev` on expenses and income: the trigger bumps it when a server write changes amount, currency, accounts, date, exclusion, or moves a row into or out of a non-spend category; a client write echoing an older value keeps the server's values for those columns. A client that sends nothing is treated as fresh. | 0278 |
| Lone leg | A transfer leg with no partner never records a two-leg question; the route clears a stuck one. | none |
| Card load (council) | A model-asserted repayment with "via card" wording and a printed balance at least the payment is booked as a non-spend top-up into the card, flagged `card_load`, with a one-tap "it was spending". Smaller or unreadable balance: spending, flagged, as before. The seven existing rows are not repaired. | none |
| Wording guard | Enforced. Count read first: 4 of 138 template-matched messages diverted (3 declined, 1 rejected), each to the next tier, never to rejection. | none |
| `occurred_at` | When the day falls back to the arrival day, the stored instant is the server's, on rows and debt payments. | none |

### Group 2: N15

A late or repaired row is booked in its true month (unchanged; confirm now keeps the parsed day). The carry is never recomputed automatically. A closed month is stale only when its figure moved by at least 1 base unit **and** a money row or savings deposit of that cycle was written after the carry was last settled (so an exchange-rate move alone is not staleness). Stale months show an "Out of date" badge on the carry row and one prompt; "Update" posts a deposit or a capped withdrawal to the pocket the carry went to; "Later" hides it until the figure changes again. At the next close, stale months are netted into the new carry, unless that would push it below zero, in which case nothing is netted and they stay stale. Each application claims the summary row first (compare-and-set), so a tap and the cron, or two taps, cannot both apply. New column `savings_month_summary.carry_settled_at` (0282). Route: `/api/savings/carry`.

### Group 3: cash withdrawals

Monthly line on Flow "Cash withdrawn: X, not in spending" with a "Change" link to the setting. Ask-once prompt "Do you log what you spend in cash?"; unanswered means non-spend. The answer is stored in the synced prompt state (`cashlog:yes` / `cashlog:no`, later time wins) and is changeable from the SMS card in settings. When the answer is "no" the server books each new withdrawal as ordinary spending with no credit to Cash; rows already booked never change, whichever way the answer later flips. No total is computed differently on the client.

### Group 4

| Item | What changed |
|---|---|
| P2-13 | A refused permission shows an error; the settings card shows a notice when Android reports the permission was removed. |
| P2-4 | The pattern learner makes one metered attempt per message and skips a shape that is still cooling down or out of attempts. |
| P2-6 | A code-tier pattern's literal currency is trusted without a currency word in the body. |
| P2-8 | The "not a transaction" cache needs 2 accounts, or 3 messages over 2 days, within 30 days; a parsed row of the shape clears it; parsed rows now store the masked shape. |
| P2-9 | A number equal to a bank hotline is not a hotline when it sits next to a currency or a decimal part. |
| N11 | The adjudicator's verdict applies only to the judged message's signals; bulk enable touches active templates only and invalidates the cache; promotion floors match what the database enforces; manual promote requires the automatic or the candidate list. |
| N12 | The Settings CSV export has a "Counted" column. |
| N10, adjudicator half | The adjudicator sees stand-in names (amounts and dates kept); its corrections are validated against the real message before they are stored. |
| N21 | A data reset clears this account's queued messages captured before the reset; the app drain continues past a refusal that only affects AI-needing messages and stops after two server errors in a row; iPhone queue items older than 30 days are evicted (written, not built). |
| Admin `undone` | Explicit label, and undone rows leave the "unparsed" queue. |
| Currency parity | One currency list feeds the direction guard; a test compares the three device gate lists (they are equal). |
| Discard gaps | Discarding a message reverses the savings withdrawal behind a debt payment it wrote; a sibling left with no row is held for the user instead of vanishing; a fee row of any pair is retired; a refund placeholder that a purchase retracted comes back (0279, 0281). |

### Council items

1. **Card load rule**: built as decided (above). See section 6, item 1, for a reviewer objection the council should see.
2. **Repair flag `topup_repaired`**: flag, prompt (English and Arabic) and one-tap undo (`/api/sms/flag-action`, action `topup_undo`). Contract for the repair script: add `topup_repaired` and `topup_prev:<old category>` to the purchase row's `sms_flags`; soft-delete a retracted income leg with `retracted_by_sms_log_id` set to the purchase's log id and link the two logs by `paired_log_id`. Undo restores the income first, then the category, clears the destination and removes both flag entries. Unanswered, the repaired state stands. The retracted income leg has no row the user can see, so the one prompt sits on the purchase row.
3. **The 15 gold-set relabels**: each re-checked against masked text by a reader under the council rule. **None is settled by the wording alone, so all 15 stay out**; one structural reason per row is in `docs/launch/S1-relabel-review.md`. The gold set is unchanged. Fable reviewed the reasons, not the masked text.

All eight migrations (0275 to 0282) are applied live.

## 2. Dropped, with reasons

- **N6, "amount ends the message" heuristic.** Measured on stored messages it would have held 3 of 196 genuine transactions out of spending. Only the phone's explicit flag holds a row. A message cut by the carrier with no flag is not detected.
- **N14, balance keyed on `refundedAt` versus `refundKind`.** Not real: every writer sets both.
- **P2-6, sender currency by majority.** The stored value is the user's explicit confirmation; 0 live mismatches.
- **P2-3, Egyptian card-style transfer.** Not real as described: the 131 AI-parsed rows are the account style, which has been in code since November (22 November rows are parsed by code). The card style has 2 stored rows.
- **Five curated templates not re-keyed** (`423be87f`, `cbd0c81f`, `b0f41406`, `fb69d6cb`, `650e29cb`): no stored message shows which key their messages produce.
- **Discard gap "salary occurrence stamp".** Not real: the unique index and the matcher both ignore deleted rows.
- **Savings-funded expenses on discard.** Not reversed, because the app does not reverse them on a manual delete either; only debt payments are.
- **N21, deleting permanently refused iPhone items.** The queue keeps refused messages on every platform on purpose.
- **N11, a mark for killed templates.** `kill` leaves no trace but the audit log; no column was invented, so bulk enable still re-enables a killed template that is `active`.
- **Net-worth half of P1-1.** Left for the net-worth work, as the review allowed.
- **Reader-confirmed findings** N6, N8, N9, N11 to N15 and the adjudicator half of N10 were verified at their lines before acting; all are real except the parts listed above.

## 3. Closing replay

`TZ=Africa/Cairo npx vitest run src/lib/sms/gold/closingReplay.test.ts --reporter=verbose` on the export of 2026-11-14 19:57 (960 messages: 771 dispatched, 184 skipped, 5 refused as the same capture). All twelve checks pass, with the same evidence rows as in S2c: both repayment pairs, the two true bounces by the 15-minute rule, `9e75b537` and `1ccc2355` untouched in both orders, `4a382257` refused, the four daily declines, `6e9e1e26` non-spend, `572aaf39` untouched, `baab5343` stamping `e8b0e3ed`, no regressed pair (3 of 6 pair as stored, 5 of 6 with digits restored, 1 not replayable), wording guard 4 of 138. New in the output: `wallet_unregistered` would be stamped on 21 rows. 49 of 960 rows change outcome class against live data (mode A). The replay ran before the review fixes of section 4 and inside the final verify run after them. Its limits are those listed in S2c section 5.

## 4. Review of the full diff

Every coder's diff was read before its commit; nine were sent back at least once. Two independent reviewers then read the whole diff cold (server and SQL; client, sync and carry). All findings are fixed, each with a test, except the two noted in section 6.

Server (12): the wallet-fee pairing read a column the route never fills (the test had seeded a shape production does not write); the reversed refund rule had no time order; cross-currency amounts used hard-coded rates; the narrowed twin rule could stamp another purchase; stamps could fail silently; `topup_undo` was not retryable; N7 asked on a funding account's digits; the fee row and the adopted placeholder were left behind on discard; a wallet answer could be double counted on discard; wallet credits stored as plain income were not seen.

Client (11): the adopted subscription charge was never deleted on the server; the carry ledger key could repeat; a tap and the cron could both apply one month; a pending tracking choice was replayed for another account; a data reset cleared another account's queue; the drain hammered the server during an outage; plus smaller ones (savings deposits ignored by the staleness test, the carry prompt mounted twice, prompts not refreshing after an answer).

## 5. Verified and not verified

**Verified**
- `npm run verify` passes on the final code commit (lint 0 errors, types, tests in Cairo with the coverage floor and in New York, migration check, dependency audit, production build).
- On the live database, in rolled-back blocks: 0275 (3 checks), 0278 (12 checks), 0279 (10 checks), 0281 (6 checks). The live body of `sms_discard_message` has the same hash as the 0281 file.
- **Backward compatibility while the migrations were live ahead of the code.** All new columns are nullable; `sms_try_pair` gained one defaulted argument and the old named call was run live and resolves; the discard function only adds return keys; a client that does not send `server_rev` is treated as fresh. The API schema cache was asked to reload.
- The hand-edited database types match the live schema for every object this batch touched.

**Not verified**
- Nothing was run on a device or in the app: every new prompt and the cash line (layout, Arabic in place), the permission notice, the carry badge.
- No request was sent through the deployed routes after the push.
- `sms_try_pair` with the fee argument was not exercised on the live database (only its old call form); the wallet-fee rule is covered by unit tests on the stored shape.
- The 0273 discard check script (22 checks) was not re-run after 0279 and 0281; the new scripts cover the changed paths only.
- The Swift queue eviction was not compiled. The Kotlin and Swift changes of S2c and this batch ship with the next owner-requested build; the web changes reach the native apps with that build too.
- The online-purchase Saudi pattern was written from masked text only (no raw row exists).
- The cron's "prior drift unreadable" branch has no test.
- The 15 relabel verdicts rest on a reader's reading of masked text.

## 6. For the council and the planning session

1. **Card load rule (reviewer objection).** "Printed balance at least the payment" also holds for an ordinary debit or prepaid purchase that prints a remaining balance. If the model labels such a message a repayment and it has "via card" wording, it is booked as a top-up and leaves spending until the user answers the prompt. The rule was built as decided; the evidence behind it is one message pair. A narrower test (load wording, or the balance rising against the card's last reported balance) would remove the risk.
2. **A second genuine refund within 3 days of an earlier same-amount refund on the same card now asks**, even when its own reference would have matched a purchase. Safe default (credit out of income and spending, purchase counted), one extra question.
3. **The repair apply needs N15 and the `topup_repaired` flag live before it runs.** Both are in this push. A repair write moves `updated_at` on the rows it touches, so repaired months will show as stale and prompt the user; that is the intended notice. The row version makes a stale phone unable to push back a repaired category, amount, account or date, so the repair does not need to bump `edited_at` for those columns (S3 condition 3 can be re-read in that light; bumping `edited_at` would make the trigger treat the repair as a client write).
4. **`wallet_unregistered` would flag 21 stored credits** of one user in the replay. Forward only; if the repair stamps flags, count these prompts with the others.
5. **Follow-ups, not done here:** `src/lib/supabase/database.types.ts` is missing 34 tables, views and functions that exist live (older drift, unrelated to this batch); the prompt state is pushed as one object, so a device with an older copy can overwrite another device's cash answer (same limit as the pass-through answer); the carry status read costs up to 23 queries and one exchange-rate call per app session; a hard crash between a cron claim and the new summary insert leaves that month claimed and not netted; the Settings CSV exports a partly refunded row at its full amount.
