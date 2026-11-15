# S3b: SMS repair tooling and apply log

Date 2026-11-15. **Nothing has been applied to money rows.** Phase A (tooling) is built and live; phase B (rolled-back rehearsal) passed, see section 3. Rows are cited by the first 8 characters of the log id, users by the first 8 of the user id.

## 1. What exists (live and in the repo)

Migration `supabase/migrations/0283_sms_s3_repair.sql`, applied live. Additive; nothing the deployed app or server calls.

| Object | Purpose |
|---|---|
| `sms_repair_audit` | one row per change: batch, type, user, log, table, row, action (update, soft_delete, insert, relink), full old row, changed columns, `reverted_at`. RLS on, no policy, no grants to anon or authenticated. Unique per (batch, table, row, type): a run is idempotent. |
| `sms_s3_apply(batch, type, log_ids, expected jsonb)` | per log: re-reads the live row, refuses on a user-touch signal (note, exclusion, answered flag, category source, answered held row, deleted row) or when amount, currency, day, category, refund stamp or flags no longer equal the report; writes the audit row, then the change; checks the write took. The fourth argument is the report's expected value per log (an addition to the part 7 signature: the report values have to come from somewhere). Types: T1, T2a, T2b, T3, T4, T5, T8, T9, T11, T15. |
| `sms_s3_record_insert(...)` | audits a row inserted by the script and fills the log's pointer if empty. |
| `sms_s3_revert(batch, type)` | newest first; per column compare-and-swap (a column a user changed after the apply is not restored; an inserted row a user edited is not deleted); notes every skip. |
| `sms_s3_input` | the repair list (104 rows: log prefix, user prefix, amount, currency, day, category, flags, proposed row). RLS on, no policy, no grants. Holds no text, names or digits, only id prefixes and money facts already in the report. Proposed: drop it after step 2 (the audit table stays). |

All four functions are executable by `service_role` only (checked: ACL is postgres and service_role).

Facts found while building, which the design relies on:
- Soft-deleting a row with no marker queues a discard of its message (`sms_discard_on_row_delete`). Every soft delete here sets the marker in the same write and the functions set `sms.discarding = 1` as well.
- `edited_at` is never touched. `reject_stale_write` (0278) bumps `server_rev` for amount, currency, accounts, date, exclusion and non-spend category changes, so a stale phone cannot push those back; stamps, flags and retraction are server-owned (I8) and also protected. A stale push that carries `server_rev` null is treated as fresh (the known limit).
- The template-signal trigger does nothing without `auth.uid()`, so service-role repairs record no signal.
- Pushes and toasts are sent by the parse route after `createSmsTransaction` returns (`nudgeUser`, `sendNativePush`, `emitNotification`, `sms_mark_pushed`, AI categorisation in `after()`). `scripts/qa/s3-insert.test.ts` calls only `createSmsTransaction` and `appendSmsFlags`, so nothing is sent.

Repo: `scripts/qa/s3-gen-apply-input.py` (builds `s3-apply-input.json`, `sql/0283_s3_load_input.sql`, `sql/0283_s3_apply_revert.test.sql`), `scripts/qa/s3-insert.test.ts` (insert script, vitest-run, off unless `S3_INSERT=1`; dry mode `S3_DRY=1`), `database.types.ts` updated.

## 2. Decisions that need the reviewer

1. **T5 flag name.** The report says `card_flag`; no such flag exists. The input uses `model_kind_unproven` (it has a prompt). Its default text may read as "counted as spending" while these rows stay non-spend: confirm, or choose another flag, before step 2.
2. **`818b0736`** (cash deposit recorded as an ATM withdrawal): the tooling only adds the `cash_deposit` flag; it does not retype the row or move its cash and account effect (needs balance logic, not in the report's money effect). Confirm flag only, or exclude.
3. **T11** sets category Transfer plus `topup_repaired` and `topup_prev:<old>`; the live rows have no payment method, so no destination is written (undo clears it anyway).
4. The insert script checks that the booked row equals the report's proposed row and that no other row of the user changed; a mismatch stops the run with the row already audited. Side effects of the booking function on tables it could touch beyond those checked (payment methods, debts, debt payments, expenses, income) are the ones listed in the script.

## 3. Rehearsal (phase B): result, 2026-11-15

The earlier timeouts were the SQL tool path, not the database (no idle transaction, no lock wait, audit table empty). The fifth run, the whole of `0283_s3_apply_revert.test.sql` in one rolled-back block with a 90 s statement timeout, completed. **Every check is PASS (47 of 47); everything was rolled back** (afterwards: audit rows 0, simulated rows 0, idle transactions 0). Nothing was applied to money rows.

- Setup: all 104 ids resolve to one live log each.
- Refusals (1a-1i): a note, an answered flag, an exclusion, a deleted row, a differing amount, day or category, and a cross-month shift are each refused, and a refusal writes no audit row.
- Apply (2): T3 5/5, T4 4/4, T1 2/2, T2a 1/1, T2b 1/1, T8 2/2, T9 1/1, T11 5/5, T5 7/7, T15 69/69, none refused; 109 audit rows for 104 list rows; a second call applies nothing.
- Fresh comparison: the apply re-reads each live row and refuses any whose amount, currency, day, category, stamp or flags differ from the report. None was refused, so all 104 rows still match the re-run; no exclusions.
- Totals (3): per-user per-month totals after the apply equal before plus the re-run prediction (0 mismatching keys). Five months move: one USD, one EGP, three SAR, all for user f923c68b except one each for 6090c8e7 (USD 2026-10 spending +5.70) and b85f074d (EGP 2026-07 spending +499.05); f923c68b SAR 2026-08 spending -1382.01 income -4293.71, 2026-09 spending -2800.00 income -4703.39, 2026-10 income -986.34.
- Stale push and later edit (4a-4h): a stale push cannot restore the old category, day, flag, retracted income or decline stamp; a later edit that echoes the current revision wins.
- Prompts (5): new flags on live rows, all user f923c68b: cash_deposit x4, model_kind_unproven x7, possible_duplicate x1, refund_unmatched x2, topup_repaired x5. No notification, push stamp, template signal or discard request was queued.
- Revert (6, 7): 119 changes restored; the two rows a user edited after the apply (02370960, 08ca4f8f) were skipped and kept their edit; totals equal the starting totals (0 mismatching keys); stamps back; no discard queued. An inserted row a user edited stays; an untouched inserted row is soft-deleted with its marker.

**Not covered by this run:** the inserts were simulated by direct inserts, so the real booking path (`scripts/qa/s3-insert.test.ts`, `S3_DRY=1`) has still not been run; the revert was checked by per-column totals and spot rows, not by a hash of every row; `sms_s3_input` has RLS on and no policy (checked).

## 4. Step lists (from the re-run, unchanged)

Step 1 (80): T15 69 same-month day shifts, T7b 2, T3 5, T1 2, T2a 1, T2b 1. Step 2 (24): T4 4, T11 5, T5 7, T6 5, T9 1, T8 2. The log ids are in `scripts/qa/s3-apply-input.json`. Excluded: none (the rehearsal re-checked all 104 against the live rows).

## 5. Step 1 apply log (2026-11-15)

Reviewer sign-off for step 1 received (rehearsal at 091d5092). Batch id `s3-20261115`. Order: T15, T3, T1, T2a, T2b (one transaction per type, 90 s statement timeout), then T7b by the insert script (dry run first). Starting totals saved in `sms_s3_totals_before` (to drop with `sms_s3_input` after step 2).

**Expected before applying** (step-1-only, from the rehearsal list split by type): the totals move in four keys only; every other key unchanged.
- 6090c8e7 USD 2026-10 spending +5.70 (T1)
- f923c68b SAR 2026-08 income -2993.71, 2026-09 income -3984.39, 2026-10 income -986.11 (T3)
- T15, T2a, T2b and T7b move no total.

**Applied** (batch `s3-20261115`, 2026-11-15, one transaction per type, 90 s statement timeout; no timeout, no retry):

| Type | Applied | Expected | Refused | Audit rows |
|---|---|---|---|---|
| T15 | 69 | 69 | none | 69 update |
| T3 | 5 | 5 | none | 5 soft_delete |
| T1 | 2 | 2 | none | 2 update |
| T2a | 1 | 1 | none | 1 update |
| T2b | 1 | 1 | none | 1 update |

**T7b (2 inserts): not run, left out.** The dry run `S3_DRY=1` of `scripts/qa/s3-insert.test.ts` failed at once with "Missing SUPABASE_SECRET_KEY": the local `.env.local` holds no service-role key. Not a booking-path result. Needs the key supplied by the owner (or the run moved to where it exists); booking code untouched.

**Totals check:** per-user per-month totals now vs `sms_s3_totals_before` differ in exactly the four predicted keys and by exactly the predicted amounts: 6090c8e7 USD 2026-10 spending +5.70; f923c68b SAR income 2026-08 -2993.71, 2026-09 -3984.39, 2026-10 -986.11. No other key moved. No revert needed.

**Nothing sent:** since the first audit row, no notification row, push stamp, template signal or discard request was created (count 0).

**Not verified:** T7b; the app-side view of the repaired rows on a device; a hash of each repaired row before and after (the audit table holds the old rows). Step 2 not run; `sms_s3_input` and `sms_s3_totals_before` not dropped.

## 6. Step 2 (in-place rows) (2026-11-15)

Decisions from S3-dryrun section 13 applied: T5 uses `card_load`; `818b0736` is retyped to Transfer with `cash_deposit` (function change in 0283: the T4 expense branch sets category Transfer, audit keeps the old row so the revert restores ATM Cash Withdrawal); T11 as built. Step 1 totals re-checked against `sms_s3_totals_before` first: the same four keys, same amounts, no drift.

**T5 per-row check** (7 rows, 1 user): the prompt says "money loaded onto your card, not spending". Every row is kind cc_payoff, category CC Payoff, non-spend, with no payment method or destination, so there is no balance to contradict the claim and the claim matches the classification. The "It was spending" action takes any category (sets Other, moves the payment method from the destination if present; here neither exists). All 7 get the flag. Known weakness: the prompt title reads "Card top-up" for a card payoff.

**Expected totals, step 2 in-place rows** (written before applying; every other key unchanged): T4 SAR income 2026-08 -1400.00 and 2026-09 -50.00; T11 SAR spending 2026-08 -1482.00 and 2026-09 -2800.00; T5 none; T9 SAR income 2026-09 -740.00; T8 SAR income 2026-09 -29.00 and 2026-10 -0.23.

**Pending inserts are 12, not 7:** T4's 3 income rows and T8's 2 income rows are retracted by the apply and their replacement rows (cash-deposit transfers, net-zero refunds, no total effect) are booked by the insert script, so they also wait for the service-role key, as do T7b 2 and T6 5.

**Rehearsal (rolled back, `scripts/qa/sql/0283_s3_step2_rehearsal.test.sql`):** 19 of 19 rows, all checks PASS: each type applied in full; `818b0736` Transfer with `cash_deposit`; the 7 T5 rows carry exactly `card_load`; totals equal before plus the step 2 prediction (0 mismatching keys); stale pushes cannot undo the top-up retag, the cash-deposit retag, a retracted income or the flags; a later edit wins; nothing queued; the revert restored 20 changes and skipped only the user-edited row, totals back to the start, `818b0736` back to ATM Cash Withdrawal without the flag, the 6 retracted incomes live again. The full-row hash differs for all 19 rows after the revert (server_rev and updated_at move on every write), so I compared per-column values and totals, not a bit-exact hash.

**Applied** (batch `s3-20261115-s2`, one type per transaction, totals checked after T4, T11, T5+T9 and T8; no timeout, no refusal):

| Type | Applied | Audit rows | Totals after |
|---|---|---|---|
| T4 | 4 of 4 | 3 soft_delete, 1 update | SAR income 2026-08 -4393.71, 2026-09 -4034.39: as predicted |
| T11 | 5 of 5 | 5 update | SAR spending 2026-08 -1482.00, 2026-09 -2800.00: as predicted |
| T5 | 7 of 7 | 7 update | no total moved: as predicted |
| T9 | 1 of 1 | 1 soft_delete, 2 relink | SAR income 2026-09 -4774.39: as predicted |
| T8 | 2 of 2 | 2 soft_delete | SAR income 2026-09 -4803.39, 2026-10 -986.34: as predicted |

Final state against the starting totals, steps 1 and 2 together: 6090c8e7 USD 2026-10 spending +5.70; f923c68b SAR 2026-08 spending -1482.00 and income -4393.71; 2026-09 spending -2800.00 and income -4803.39; 2026-10 income -986.34. No other key moved. Nothing was queued (no notification row, push stamp, template signal or discard request since the first audit row).

## S3 status

**Done:** step 1 (78 rows: T15 69, T3 5, T1 2, T2a 1, T2b 1) and the 19 in-place step 2 rows (T4 4, T11 5, T5 7, T9 1, T8 2), 97 live repairs in all, every one audited and revertible with `sms_s3_revert(batch)`.

**Pending, 12 inserts, wait for the owner to put the service-role key in the local env file:** T7b 2, T6 5, and the replacement rows for the 3 retracted T4 incomes and 2 retracted T8 incomes. Until they run, those 5 messages have no live row (their wrong income is already gone; the replacements are non-spend or net-zero, so no total changes). Run order: `S3_DRY=1`, then one row for real and verified, then the rest. Keep `sms_s3_input` and `sms_s3_totals_before` until then, then drop both.

**Known gaps:** the cash-account balance effect of the cash deposits is unmodelled; the retagged top-ups (T11) have no destination wallet; the T5 prompt title reads "Card top-up" for a card payoff; no check on a device; no bit-exact row hash.
