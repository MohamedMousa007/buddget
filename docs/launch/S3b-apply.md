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
