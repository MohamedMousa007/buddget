# S2c closing note: SMS fix session, batch 1

Date 2026-11-14. Scope: section 7 of `docs/launch/S2b2-second-review.md` with the decisions of its section 10. Fable 5.2 wrote the spec, designed each step and reviewed every diff; Sonnet coders wrote the code. No personal names or message text appear here; rows are cited by the first 8 characters of the log id.

The spec is `docs/launch/S2c-invariants.md` (I1 to I8, the signals, what settles). Every step and test names the invariant it serves.

## 1. What shipped

| Step | What changed | Migration |
|---|---|---|
| 1 | A row the pairing retracts records the message that caused it; a restore requires that marker. A phone pushing an older copy of a row can no longer change refund marks, the SMS link, the marker or the flags. New per-row `sms_flags` (server) and `sms_flags_ack` (user). | 0269 |
| 2 | A decline changes only its own row. A refund stamps an earlier message's row by payment reference, by the 15-minute same-account rule, or by same account and merchant; never a hand-entered row, a cash withdrawal, a fee or a repayment. No match: booked outside income and spending, flagged, and the user is asked. Reversal wording is a refund. | 0270 |
| 3 | One pairing change. The claim refuses a duplicate, failed or held row, the same account on both sides, two known different currencies, two legs in one direction, and a repayment against a transfer naming other digits or another person; unknown values pass and never settle. A fee difference pairs a repayment only with matching digits or reference. Own digits alone ask once per pair of accounts instead of settling. A transfer or repayment kind only the AI asserted is booked as spending and flagged; "paid into your card" stays non-spend with or without a registered debt. Aliases and shorter tails count as own digits. A repayment that needs confirmation keeps its funding account. A name-only pair credits its destination. A claimed sibling with no row no longer makes both legs vanish. A question whose row is gone clears. | 0271 |
| 4 | The same text at the same capture second is one message whatever capture id it carries (unique index, no time limit). The same text minutes apart is a duplicate only with a payment reference or running balance; otherwise booked and flagged `possible_duplicate`. | 0272 |
| 5 | A date that cannot be trusted never rejects: the row falls back to the capture day, then the arrival day, flagged `date_unsure`. A transaction with a missing or absurd amount, or below the confidence floor, is held for review in the existing held list instead of being answered as done. | none |
| 6 | Pass-through: Undo is stored on both rows and holds. A remembered Yes applies only to a pair on one known account, with a toast; every other pair stays labelled and counted. One prompt and a review list for users who already answered Yes. | none |
| 7 | "Forget this message" is one database function: its rows and fee row, its debt payment (reopening a debt it cleared), refund stamps it placed, its balance report, and the pairing, so the other leg returns as its own plain row. The undo route calls it. A row deleted in the app requests it and a scheduled job runs it 30 seconds later unless the row was revived. The web push Undo reads the key the server sends. | 0273 |
| 8 | "Your transfer was collected" notices are not transactions, decided before every tier; the template that booked them (`5d27254f`) is quarantined. A cash-machine deposit is always a credit, flagged `cash_deposit`, never matched to a salary; first booked as income, then (council, section 10) as a transfer from cash. A template or AI kind outside the known list no longer matches. Curated-table templates are tried only for the sender or body shape they were learned on. Wording guard in count-only mode. | 0274 |
| 9 | The stored template sample is masked. The model that writes patterns sees stand-in names and synthetic digits; the pattern is still verified against the real text on the server. The admin template list and the export mask at read time. Names after to/from in transfer formats are masked. The existing re-mask sweep now covers stored samples. | none |
| 10 | The background categoriser writes only rows that are still uncategorised and that the user has not decided. | none |
| 11 | Native, written and committed, NOT built: iPhone repeat rule (same text within 15 seconds reuses the capture id and time), Android worker keeps sending instead of idling after 8 attempts, one currency list across the three gates with SR and glued forms. Ships with the next owner-requested build. | none |
| UI | Badges and prompts for the five flags, built from the existing prompt stack, `ResolveSheet` parts, `Badge` and the action toast. Two answers go through a new route (`/api/sms/flag-action`): picking the refunded purchase, and "this was my own cash". | none |

Also added: an order-aware closing replay (`src/lib/sms/gold/closingReplay.ts`), and fixes for nine defects an independent review of the full diff found (section 6).

All six migrations (0269 to 0274) are applied live. The scheduled job `sms-pending-discards` (every minute) was switched on with the release.

## 2. Decisions taken in this session, for the owner to know

1. **The three cash deposits.** `cb5fd476`, `78e0b305`, `0812aa55` (and `818b0736`, booked as a withdrawal) all read, from masked text, as deposits at a cash machine into the user's own account. That supports the council's minority view (neither income nor spending). The decided default was built: income, flagged, one tap "My own cash" turns the row into a transfer from cash. The council has since flipped the default (section 10): a transfer from cash, one tap "It was income".
2. **Unmatched refund is an expense row already marked refunded**, not an income row with an exclusion: several income views ignore the income exclusion column, so an income row would leak into totals. Cost: on a tracked account the balance misses that credit until the user picks the purchase.
3. **Marker backfill.** 0269 stamped the new marker on 3 rows retracted before this session (2 expenses, 1 income), so old pairs stay undoable. No total and nothing visible changed. It is the only write to existing money rows.
4. **Invariant I1 keeps refund rule (c)** (same account and merchant within 90 days). It is in review section 3.1 but not in the one-line invariant of section 7.
5. **Low-confidence messages are now held and visible** instead of silently rejected. This follows from I6 and was not listed as a finding; users will see more items in the held list.
6. **Setup guide text is unchanged** (owner decision: keep recommending the second automation).
7. **The iPhone repeat rule treats two identical texts within 15 seconds as one message.** Two genuinely identical purchases inside 15 seconds would be captured once. That is the trade the review's rule 2 makes.

## 3. Dropped as not real, or not built

- **"Counterparty bank" as a signal** (review 3.2): no tier parses the counterparty's bank into a field, so no rule uses it. The spec says so.
- **P2-1 first half, P2-14, "hold" for duplicates, cash withdrawals as spending**: dropped by the second review; nothing built.
- Every reader-confirmed item that batch 1 acted on was re-read at its named lines and is real: both holes in 3.3, the raw template sample and the raw text sent to the pattern model, the unscoped curated-table templates, the service-worker key, the admin template list, the Android worker. None was dropped.
- Reader-confirmed items that belong to batch 2 (N6, N8, N9, N11 to N15, the adjudicator half of N10) were not re-read and not acted on.

## 4. Moved to batch 2

From the review's list, unchanged: N7, N13, N6, N8, N9, N14, P2-13 with permission detection, P2-4, P2-6, P2-8, P2-9, N11, N12, the rest of N10 (adjudicator), P2-3 patterns, the cash-withdrawal monthly line and ask-once switch, N15 (late message after month close).

Added by this session:
- **Rest of N2**: partial refunds, a refund in another currency, a refund before its purchase. The refund picker offers exact-amount purchases only.
- **Stale phone copy and shared columns** (I8 known limit): a phone holding an older copy can still undo a server retag of `category` to Transfer. Needs a row version in the push.
- **Net-worth half of P1-1** (the excluded expense staying in cash outflow): left for the net-worth work, as the review allowed.
- **Queue hygiene (N21)**: a data reset still does not clear the phone queue.
- **Wording guard enforcement**: read the count in section 5, then flip `WORDING_GUARD_ENFORCED`.
- **Held and flagged rows lose their flags on confirm**: `/api/sms/confirm` re-runs the booking without `possible_duplicate` / `date_unsure`, and dates by the receive time, not the body day (N19).
- **A lone leg with only a weak signal** can still record a two-leg question with no partner; answering it fails and the prompt stays. Pre-existing; found in step 3.
- **Discarding a leg whose sibling never had a row** cannot recreate a row for the sibling.
- **Debt payments funded from savings and the salary occurrence stamp** are not reversed by discard.
- **Curated-table templates stored under a bank-name key** (8 of 12) no longer match a sender-less iPhone message; those messages go to the AI tier. Cost only, nothing is lost. Re-key them by body shape.
- **Admin views** read a discarded message as "not parsed" (`admin/sms/logs`, user activity, `smsDisplay.ts`); add an `undone` label.
- **`directionGuard.ts`** has its own currency list without SR; no parity test compares the three device gate lists.
- **`occurred_at`** still comes from the phone clock when it is far off (the day is corrected, the timestamp is not).

## 5. Closing replay

`src/lib/sms/gold/closingReplay.ts` feeds every stored message through today's booking code in arrival order per user, against an in-memory database with the pairing claim mirrored from 0271. 957 messages were stored at export (952 at the time of the review): 770 dispatched, 182 skipped (172 non-transactions, 3 failed before parse, 7 stored duplicates), 5 refused as the same capture. Re-run: export with `scripts/qa/sms-s2c-replay-inputs.sql` into `.claude/sms-s2c-replay.json` (no raw text, out of git), then `TZ=Africa/Cairo npx vitest run src/lib/sms/gold/closingReplay.test.ts --reporter=verbose`.

| Check | Result |
|---|---|
| The two live repayment pairs still pair | Pass: `30657ada` with `a602aba1`, `346f56a6` with `34a081d4`; one repayment row each |
| `fb2d543a` and `e66b72ae` still match their transfers | Pass, both by the 15-minute rule (`d84e8bcd`, `7104f131`) |
| `9e75b537` untouched by `0fe8887c` | Pass |
| `1ccc2355` untouched in both arrival orders | Pass |
| `4a382257` refused as a copy of `76184aa7` | Pass |
| Four daily identical declines | Pass: `13248a70` one row; `b4dba45d`, `4d5206be`, `8bc752a7` acknowledged |
| `6e9e1e26` stays non-spend | Pass (waits for the user's confirmation, as live, then a non-spend repayment row) |
| Unpaired real pairs | 6 live pairs. 3 pair as stored. 2 exchange pairs pair once masked digits are restored (their direction sits in a masked sign). 1 (`6ad46d1d` with `eedf39da`) cannot be replayed: it paired on a reference that is masked. No replayable pair stopped pairing. |
| New pair the replay makes | `42136093` with `858f6536`: a purchase at the user's own wallet and the wallet's credit 3 seconds earlier (a top-up; correct) |
| Seven "payment via card" rows | Spending, flagged, once masked digits are restored: `51966294`, `5fe0a498`, `6cde6c02`, `81144634`, `82133010`, `b61afd88`, `c18dabf3`. On the one row whose raw text still exists (`b61afd88`) the rule was checked in the database and matches; it does not match `6e9e1e26`. |
| Wording guard, count only | 4 of 138 template-matched messages would be diverted (declined 3, rejected 1). Every template has an empty word list today, so this is an upper bound. |
| Collected notices and cash deposits | The new rules hit exactly `65921ad1`, `4b5d53d7`, `cb25279f`, `93e7ec95`, `d35340ff` (notices) and `cb5fd476`, `78e0b305`, `0812aa55`, `818b0736` (deposits), and nothing else among the 957 |

Other numbers: 5 rows refused as the same capture (`4a382257`, `fe443a48`, `e40c08b7`, `e23c899a`, `41c80815`); 36 rows would carry `possible_duplicate`, an upper bound because masked text makes different messages look alike (35 of them are also both booked in live data); 45 of 957 rows change outcome class against live data.

Limits of the replay, so no number is over-read: it replays the booking stage from stored columns, not the parse tiers; bodies are masked, so references and balances cannot be re-read and every refund match is by time or merchant; the stored kind is the applied kind; accounts and debts are today's, not the state at arrival; salary, subscription and own-name matching never fire (no data exported for them). The replay numbers were taken before the nine review fixes of section 6; the replay test was re-run after them and passes with the same numbers.

## 6. Review of the full diff

Every step's diff was read before its commit, and seven steps were sent back at least once. An independent reviewer then read the whole diff cold and reported nine defects; all are fixed, each with a test (commit "fixes from the independent review"):

1. A leg sat in the log under a borrowed kind while looking for a repayment, which could leave a real own transfer counted as spending.
2. The duplicate guard depended on which copy was delivered first.
3. A guessed currency was published as known and could refuse a true pair.
4. The collected-notice rule matched future tense ("will be received by the beneficiary") and would have dropped a send confirmation.
5. A second genuine refund was acknowledged against an earlier unmatched refund and not booked.
6. A failed post after a retraction left the other leg retracted and the claim held.
7. A fee row was posted for a repayment that failed to book.
8. The one-account answer inserted before it retracted.
9. An own-transfer leg claiming an outgoing sibling did not retag the sibling's row (older than this session).

## 7. Verified and not verified

**Verified**
- `npm run verify` passes on the final code commit (lint with 0 errors, types, tests in Cairo with the coverage floor and in New York, migration check, dependency audit, production build).
- 0269 trigger: tested on the live database in a rolled-back block (a stale push keeps the refund mark, link, marker and flags; a retracted row cannot be revived by a client; the user's own delete can; other tables unaffected).
- 0271 claim guards: tested live, rolled back (other digits, another person, fee without proof, two outgoing legs, same account, different currency all refused; the true shapes pair; the old call form works).
- 0273 discard: 22 checks in `scripts/qa/sql/0273_sms_discard_message.test.sql`, run live, rolled back, nothing left behind.
- **Backward compatibility while migrations were live ahead of the code** (asked by the planning session): the deployed code kept working. The claim function kept its arguments and return shape; new columns are nullable; the new unique index covers only rows the new code writes; the trigger only puts back columns no user action sets. One gap existed until the push: a repayment whose funding leg differs by a fee and arrives second was not paired by the old code.

**Not verified**
- Nothing was run on a device or in the app: the prompt and sheet layouts, the Arabic strings in place, the toast from the ledger hook, the native repeat rule (in particular whether two automation runs share one process and one lock), the Android worker change, the Kotlin tests.
- No request was sent through the deployed route after the push.
- `sms_flags_ack` clearing a prompt on a second device was not observed.
- The wallet top-up pair against the new same-account guard: no live pair has both legs on one account, but no live top-up pair exists to prove the wallet format either.
- The Postgres API schema cache was asked to reload; not observed from the API side.

## 8. S3 repair list, corrected

No repair was done in this session. For S3:

- **No action** for the eight "possible duplicate" rows of the first review (separate messages).
- **`9e75b537`**: un-reverse (its expense is stamped by the decline `0fe8887c`; wrong).
- **`572aaf39`**: stamped by the decline `4a7d7250` in the same second. Default if the owner does not answer: un-reverse, keep the charge counted (council). See the note below.
- **`baab5343`**: new finding. The replay matches this return to `e8b0e3ed`, a transfer out of the same amount on the same account 16 seconds before it, not to `bfe884e3` (40 hours before), which is the row stamped live. Repair: move the stamp from `bfe884e3`'s expense to `e8b0e3ed`'s. This answers the owner question without the raw text.
- **`fb2d543a`, `e66b72ae`**: correct, leave.
- **`af7e8c15`**: book it (lost before the "in progress" answer existed).
- **`a602aba1`, `34a081d4`**: correct, not wrong-kind.
- **Collected notices** `65921ad1`, `4b5d53d7`, `cb25279f`, `93e7ec95`, `d35340ff`: remove the income rows.
- **Cash deposits** (changed by the council, section 10): `cb5fd476`, `78e0b305`, `0812aa55` (booked as income) and `818b0736` (booked as a withdrawal) each become a transfer from the user's Cash account into the account that received the deposit, flagged `cash_deposit`, so the user gets the question "was this income?". The message's log row keeps or gets kind `income` (see section 10).
- **Seven "payment via card" rows** (`51966294`, `5fe0a498`, `6cde6c02`, `81144634`, `82133010`, `b61afd88`, `c18dabf3`): default if the owner does not read `b61afd88`: rebook as spending, flagged.
- **`ff52e170`** (a recharge booked as an own transfer): rebook as spending.
- From the first review, unchanged: `fa2a8ec2`, `ad8523cb`, `10ac8181`, `540077ff`, `acbe9dd7`, `916e58d4`, `aa5ece0a` (book or confirm absent); the 49 wrong-day rows; the 24 top-up incomes; `02370960`, `dac3937a`. Note `e23c899a` and `41c80815` are same-capture copies of `ad8523cb` and `fa2a8ec2`: check them together.
- Rows the owner should still read by 2026-11-22: `b61afd88`, `572aaf39` with `4a7d7250`.

## 9. Structural notes for the three open rows (from masked text only)

Raw text expires around 2026-11-25 and is not kept or copied. These notes are what remains to reason from.

**`572aaf39` and `4a7d7250`.** Same user, same card tail, same amount in USD, same merchant, received in the same second (gap 0 s). `572aaf39`: kind purchase, read by a code pattern, English "your credit card was charged ... at <merchant>" format with available-limit wording. `4a7d7250`: kind declined, read by the AI, Arabic format saying the transaction from the same merchant on the card was declined because the card used is not valid, and asking the holder to update the recurring-payment details to the new card. Live effect: the decline stamped the purchase (old rule: exact amount, currency and card within 90 days), so the charge counts as zero. Under the new rules the decline books only its own net-zero row and the charge stays counted. Open question: whether the charge stood. The decline's own wording (an invalid card on a recurring payment) reads as a failed attempt on an old card beside a successful charge, which fits the default.

**`b61afd88`.** Kind card repayment, read by the AI, SAR, compact Arabic card format: "Visa card: payment of SR <amount> via <digits>; Visa balance: <amount> SR <date time>". Not paired, no destination, no payment reference. Seven rows of one user share this format; five of the seven amounts are round. The same four digits appear as the source card in that user's card-to-account rows. Rule that matches now: repayment kind from the AI with "via <card digits>" wording, so spending, flagged. Open question: whether "payment" here is a purchase or bill payment made with the card (spending) or a payment of the card's balance (non-spend). The printed card balance after the payment would settle it on a statement: it falls for a purchase and rises for a repayment.

**`baab5343`.** Kind refund, read by the AI, EGP, Arabic "an instant transfer was returned to your account <digits> for <amount>, reference <masked>, on <day> at <time>". Live: stamped the expense of `bfe884e3` (transfer out, read by the AI, same account tail, same amount, 39.8 hours earlier; both carry a reference whose value is masked) by the old exact-amount rule. The replay finds `e8b0e3ed`, a transfer out of the same amount on the same account 16 seconds before the return: the 15-minute rule matches it first. That is the same shape as the two true bounces (16 s and 17 s). Conclusion: the return belongs to `e8b0e3ed`, and `bfe884e3` was a real payment that is wrongly counted as refunded.

## 10. Council verdicts on the open items (2026-11-14, after this note)

The owner put the open items of this note to a council. Four verdicts; one needed code.

1. **Cash-machine deposits: the default is flipped (2 of 3).** The condition the earlier council set was met by the finding in section 2: every live deposit reads as the user's own cash. A deposit at a cash machine is now booked as neither income nor spending: a transfer from the user's Cash account into the account that received it, flagged `cash_deposit`. The one-tap answer is "It was income", which retracts the transfer (with the marker, I4) and books an income row. Unanswered, it stays a transfer. Deposits without a cash-machine word are untouched and stay income.
   Built with it: the detector now needs a machine word (ATM, CDM, ITM, "cash machine", or the Arabic equivalents); a bare "cash deposit" no longer qualifies, because the default now takes money out of income. All four live rows carry a machine word and no stored message matched on the bare phrase alone, so nothing live changes class because of this. The message's log row keeps kind `income`: the pairing function matches candidate legs on the stored kind and its lists include `own_transfer`, so a deposit stored as `own_transfer` could be claimed as the other leg of an unrelated transfer of the same amount. The `own_cash` answer is removed; no live row carried the flag on an income row when it was removed.
2. **`572aaf39` stays counted, with no same-second exception (2 of 3).** A general "possibly declined" flag was rejected as built on one sample. Repair as listed in section 8: un-reverse.
3. **The seven "payment via card" rows stay spending, flagged (3 of 3).** S3 makes one capped check on `b61afd88`.
4. **Order of work (2 of 3).** S3's dry-run starts now and batch 2 can run in parallel. No repair is applied from a dry-run older than the last rule change.

