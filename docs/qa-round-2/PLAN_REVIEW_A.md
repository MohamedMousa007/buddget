# QA Round 2 - Plan review A (migrations, deploy order, conflicts, decisions)

Scope: QA_ROUND_2_FIX_PLAN.md + ledger.md + FILE_OWNERSHIP.md + QA_ROUND_2_DECISIONS.md, checked against the live DB (SELECT only, project ydihurtbcnoflhormgzi) and the repo on 2026-10-27. Nothing was changed.

Verdict: the batch order is mostly sound, but 6 issues would cause data loss, exposure or a lockout if executed as written, and 13 more cause rework or silent breakage. Counts: 6 High, 13 Medium, 3 Low (22 issues). A "Verified OK" list is at the end.

Live facts used (all measured today):
- `supabase_migrations.schema_migrations` ends at 0187; 0188-0196 objects exist live but have no ledger rows (applied by execute_sql). File numbers 0197-0220 are free; no file or ledger clash. No 0193 file.
- Extensions installed: pg_cron 1.6.4, supabase_vault. **pg_net is NOT installed.**
- cron.job: 10 jobs (analytics-rollup, admin-metrics, sms-stats-drain, sms-heal-stuck, sms-zero-variance, sms-retention, housekeeping, user-milestones, crash_retention, cron-log-trim). No cleanup_abandoned_anon_users / cleanup_expired_trusted_devices.
- Row counts: expenses 597, income_events 171, debt_payments 5, savings_accounts 30, savings_transactions 31, sms_parse_log 863, sms_corpus 518, merchant_categories 123, auth.users 45 (8 anonymous). Tables are tiny: no lock/timeout risk from any DDL here.
- `platform_settings` holds one key (`prices_refresh_attempt`); no `min_app_version`.
- `user_settings.timezone` is set for 1 of 45 users.

---

## HIGH

### 1. [High] 0209 purges 682 SMS rows the night it is applied, before the learner has seen them
What breaks: Plan and decisions say "the nightly job keeps failing (harmless) until LF3 + LF6 are done". The failure is the only safety. `sms_retention()` live is `UPDATE sms_parse_log SET raw_body=NULL ... WHERE received_at < now()-30d AND harvested_at IS NOT NULL`. It fails only because `raw_body` is NOT NULL (verified: `is_nullable = NO`). 0209 makes `raw_body` nullable AND rewrites the function in one file, and the cron (`sms-retention`, 00:50 daily) is already scheduled, so the purge runs at the next 00:50.
Evidence: `harvested_at` is set on **863 of 863** rows (the parse route stamps it on every path: route.ts lines 683, 853, 882, 900, 1008), yet `harvestLegacySms` was never scheduled and the corpus holds 518 shapes. So `harvested_at IS NOT NULL` does not mean "learned from". 682 rows are older than 30 days, 431 older than 60. LEDGER section 7 even suggests applying `ALTER raw_body DROP NOT NULL` early; with the current function that alone destroys 682 rows of learner input (and LF1/LF2 say 69 of 78 regex failures come from this very text).
Change:
- Split 0209 into 0209a (schema: nullable column, platform_settings keys, masking helper, class periods) and 0209b (enable). 0209a inserts `sms_retention_enabled = false` and the rewritten function returns immediately while it is false. Flip it only after LF3 backfill + LF6 scanner pass, as an explicit owner-approved step at the end of B4.
- Do not reuse `harvested_at` as the purge gate. Add a new stamp (`masked_at` / `corpus_harvested_at`) written only by the LF3 backfill or the fixed harvester; re-stamp not applicable to the 863 existing rows.
- Remove the "apply DROP NOT NULL early" suggestion from LEDGER section 7.

### 2. [High] The pg_cron + pg_net scheduler has no migration, no owner step, and B4 depends on it before B6 exists
What breaks: Addendum 2 says use pg_cron + pg_net hourly. FILE_OWNERSHIP lists 0213 = push-token sweeper and 0214 = sms_consent_at; nothing creates the extension, the job, or the secret. `pg_net` is absent live. Separately, 0211 (B4) says `cron.schedule` for `harvestLegacySms` (LF3), but that is a TypeScript function (today it runs inside the prices cron route, ops O19). A pg_cron job can only reach it through pg_net, which only B6 introduces. LF3 therefore cannot be scheduled in B4 as written, and the retention gate (issue 1) waits on LF3.
Also: ops O1 shows `notification_cron_cursor` was never written and `isAuthorizedCron` returns false when `CRON_SECRET` is unset. If the secret is unset, the pg_net call fails 401 the same way, and the first successful run will push a backlog (every overdue recurring item, month_end etc.) to all 45 users at once.
Change:
- Add a migration "b6_pg_net_scheduler" (renumber so 0213/0214 keep their IDs): `CREATE EXTENSION IF NOT EXISTS pg_net`, a `private.invoke_cron(path)` function reading the secret from `supabase_vault`, and the `cron.schedule` calls. The secret is created by a one-off execute_sql, never committed to the repo.
- Make the owner step "verify CRON_SECRET on Vercel and a 200 from /api/cron/notifications" a hard gate before B6 DB work (move it from the "owner-side steps" footer into the B6 row).
- LF3: schedule through a Vercel cron entry (or the existing prices-cron harvest) in B4; switch to pg_net in B6 if wanted. Remove `cron.schedule` for harvest from 0211.
- Add a first-run guard in evaluateAlerts: skip alerts older than 1 day on the first pg_cron run, and keep the Vercel daily cron from double-sending (dedupe key per user per day, or make the Vercel run process only users not served in the last 20h).
- Timezone fallback: ledger O9 says "UTC fallback"; round 1 (QA_ROUND_PLAN Part 6) shipped a Cairo fallback for users without a reported zone. Use Cairo (only 1 of 45 users has a timezone today). Same for T8 (issue 16).

### 3. [High] 0207 would delete an active anonymous user's data in its first run
What breaks: `cleanup_abandoned_anon_users()` (live definition) deletes `auth.users` rows where `is_anonymous` and `coalesce(last_sign_in_at, created_at) < now() - 14 days`, cascading every finance table. Live: 8 anonymous users, all 8 idle over 30 days by that measure, **1 owns expenses**. `last_sign_in_at` is not advanced by token refresh, so an anonymous user who keeps using the app on a long-lived refresh token is "abandoned" after 14 days.
Change: before scheduling, 0207 must replace the predicate: also require no rows in expenses/income_events/debts/savings_accounts/budget_plans and no recent `updated_at` in user_settings/profiles; dry-run list the 8 users for owner approval; schedule weekly, not nightly; LIMIT 50. The plan's "row-count SELECT first" is not enough because the count (1 user with data) is a decision, not a number.

### 4. [High] qa2_backup_* tables in schema public are readable and writable by `anon`
What breaks: 0197 creates backup tables holding copies of users' expenses/income/debt rows. Every public table here carries default grants to anon and authenticated (anon has ALL on 55 tables, verified), and a table created by `CREATE TABLE AS` has RLS off. The backups would be exposed through the REST API with the public anon key. The same applies to any new table in 0208 (2FA session table), 0211 (`sms_pattern_reviews`), 0202 (override table).
Change: put backups in a non-exposed schema (`CREATE SCHEMA qa2_backup`, not in db_schemas) or `ENABLE ROW LEVEL SECURITY` plus `REVOKE ALL ... FROM anon, authenticated` in the same statement. Add a migration check: no table created by 0197-0220 may exist without RLS and revoked anon/authenticated (query information_schema as a post-apply assertion).

### 5. [High] 0199 RPC changes can create ambiguous overloads and break every client call
What breaks: Live RPCs are `deposit_to_savings(p_account_id, p_amount, p_currency, p_notes, p_date, p_transaction_id)`, `withdraw_from_savings(...)`, `correct_savings_balance(...)`, `add_debt_payment_with_expense(p_payment, p_expense)`, `add_income_with_debt`, `add_subscription_with_recurring_expense`, `update_subscription_and_re`. 0199 adds a local-date parameter, idempotent replay and ownership checks. `CREATE OR REPLACE` with a different argument list creates a second overload. PostgREST resolves RPC by named parameters; a call using the old parameter names matches both overloads when the new ones have DEFAULTs, and PostgREST returns PGRST203 (cannot choose). That fails all deposits/withdrawals for old and new clients. Dropping the old signature instead breaks installed native builds that call it.
Change: keep each existing signature and behaviour unchanged (add checks inside the body only); expose new behaviour under a new function name (`deposit_to_savings_v2`) that the new client calls; remove the old one only after min_app_version passes the last old build. Add an apply-time check `select count(*) from pg_proc where proname = ... group by proname having count(*) > 1` per function.
Also: `0199` hardens RPCs that D22 (0218, B10c) may drop after D8 picks a survivor. Decide D8's RPC (live already has `add_debt_payment_with_expense`) before 0199 so the hardening is not discarded.

### 6. [High] Deploy order is only specified for "remove" changes; restrictive migrations and installed native builds are not covered
What breaks: Protocol step 6 covers "DB step that removes something old code reads". The converse and the installed-app case are missing:
- Additive migrations (0198, 0200, 0212, 0214, 0217) must be applied BEFORE the code that writes the new columns ships. An upsert with an unknown column returns PGRST204 and poisons the whole sync batch (the L3/D6 pattern).
- Restrictive migrations (0201 grants, 0202 trigger rules, 0203/0205 FKs, 0204 CHECKs, 0208 gate, 0209b purge, 0216 gate) must be applied AFTER the code that no longer violates them is live AND old native builds are accounted for. TestFlight/Play builds in the wild never update with `git push`: they keep upserting absolute `current_balance` (W7), writing debt payments without the new columns (D2), sending no 2FA proof (C1) and amounts the new CHECKs may reject (Q8).
Change: add a "DB/code order" column to the migration table in FILE_OWNERSHIP, for example:

| Migration | Order | Old-build rule |
|---|---|---|
| 0197, 0198, 0200, 0212, 0214, 0217 | DB first, then code | new columns nullable with fallback in readers |
| 0199 | DB first (new RPC names), code switches, old RPCs stay | keep old signatures (issue 5) |
| 0201, 0202, 0203, 0205 | code first (verify deploy), then DB | revoke only what the clients provably do not use; service-role routes verified |
| 0204 | code first, then NOT VALID | live violators today: 0 (amount<=0 on expenses/income_events/debt_payments) |
| 0208 | code first, flag default OFF | enable only after the 2FA-proof client is in a shipped build |
| 0209b | last step of B4, owner approved | issue 1 |
| 0216 | DB, separate file | issue 7 |

Add a rule: any apply that changes behaviour for existing clients states which min_app_version it needs and is held behind a `platform_settings` flag until that build is out (the owner already controls native builds).

---

## MEDIUM

### 7. [Medium] The 2FA gate (0208) and the fast gate (0216) do not fit how `private.app_client_gate` works
Evidence: live function body (0195) is a PostgREST `db_pre_request` hook, `STABLE`, and wraps its work in `EXCEPTION WHEN others THEN RETURN` (fail-open by design). It runs on every PostgREST call from any role, including service-role calls from Next routes.
What breaks: (a) C1 says "fail closed", the surrounding function is fail-open; a lookup error would let everyone through or, if re-written to fail closed, lock everyone out on a transient error. (b) The endpoints that perform the 2FA step (`/api/auth/device/check`, trust, OTP send/verify, sign-out) also pass through the hook; if the gate blocks them there is no way to become verified. (c) Existing sessions and installed builds have no verification record, so every 2FA user is locked out the moment the gate is enabled. (d) Adding a per-request table lookup in B3 and optimising it in B8 means B3 ships a slower gate for a whole batch window.
Change: implement 2FA as a separate function called only for users with `twoFactorEmailEnabled` and only on user-data tables, with explicit allow-list of the verification paths; flag key in platform_settings `enforce_2fa_gate` default false; backfill a verification record for all currently valid sessions of 2FA users when enabling; fail-closed only for the 2FA branch. Keep 0216 as planned but specify a test matrix (no min_version, below min, 2FA on/off, verification route). Do not run 0208 and 0216 as separate rewrites of the same function body: 0216 must start from the live `pg_get_functiondef`.

### 8. [Medium] 0205 foreign keys vs sync tiers and the nightly housekeeping hard-delete
Evidence: live `income_events` has no link FKs (`template_id`, `linked_savings_account_id`, `linked_debt_id`, `shared_plan_id`). `sync.ts` flushDiff puts `income_sources`, `income_events`, `savings_accounts`, `debts` all in `level1`, drained in parallel. `housekeeping()` hard-deletes tombstones older than 90 days in 21 tables (including debts, savings_accounts, income_sources, payment_methods, debt_payments) in one function.
What breaks: (a) A new debt/pocket and an income event linked to it created in the same flush (withdraw-to-debt, savings withdraw) would hit an FK violation and poison the level. (b) An FK without `ON DELETE SET NULL` makes the purge of an old tombstone fail whenever a live row still points to it, aborting the entire housekeeping job (it also does ai_usage rollups and email_log pruning, all rolled back together).
Change: 0205 must use `ON DELETE SET NULL` on every link FK (as the existing expenses FKs do). Move `income_events` to `level2` in `flushDiff` in the same B3 commit (sync.ts is not listed as a B3 file; add it to the conflict table, owners B1, B3, B8, B11). Add a test creating parent and child in one flush. Order of apply: code (tier change) first, then `NOT VALID`, then `VALIDATE`.

### 9. [Medium] B1 has circular and cross-batch dependencies that the stated order cannot satisfy
- Ledger "Depends on": W2 depends on W12 and W12 depends on W2; L11 depends on W22 and W22 on L11. Order inside B1 ("W1, D1/D2/D3, Q6/W9/W7, W2/W12, L1/L3/R11, rest") hides both. Treat W2+W12 and L11+W22 as single work packages.
- W2 (B1) makes pocket deposits/withdrawals debit/credit the primary tracked account by default; the "From account" row that lets the user see or change that arrives in B2. B1 pushes to dev + main first, so users get account balances moving with no visible control. Move the "From account" row (and its hidden-when-no-accounts rule) into B1, or gate W2's default behind the same commit as B2.
- D2 (B1) adds `amount_in_debt_unit`; the SMS write path (`createSmsExpense`, `add_sms_debt_payment_with_expense`) is deferred to B4. For the B1..B4 window SMS-created payments have NULL in the new column, so D3/D7 (progress by amount) must read `coalesce(amount_in_debt_unit, amount)` and the backfill must be re-run (or be a view) after B4.
- 0210 says the RPC is "idempotent on sms_log_id" but live `debt_payments` has no `sms_log_id` column (verified). Either 0210 adds it (and partial unique index exempting fee rows) or idempotency must key on `expenses.sms_log_id`; state which.
- W7 (client stops writing `current_balance`) conflicts with installed builds that still do (issue 6): the RPC/trigger side must ignore or reconcile a client absolute balance, otherwise the old builds keep overwriting server deltas.
Change: re-sequence B1 as: W1 -> D1 -> (D2, D3, D7 with fallback) -> Q6 new RPCs -> (W2 + W12 + From-account row) -> W9/W7 -> (L11 + W22) -> L1/L3/R11 -> rest.

### 10. [Medium] 0197 repair premises do not match live data
Evidence: "21 expenses with `is_debt_payment` and NULL `linked_debt_payment_id`" (debt.md, ledger D1) is now **5** (4 live); `debt_payments` has 5 rows (4 live); 0 of the 5 expenses match a payment by `debt_id + amount`; 2 expenses are already linked. L1 repair ("events hidden by deleted sources"): 0 income events point at a deleted source and 0 have a dangling `template_id`.
What breaks: a repair written for 21/N rows either matches nothing (silent no-op while D1 stays visible in the UI) or, if loosened to hit 21 (by `debt_id+date+amount+pm`), mis-links.
Change: the 0197 file computes its candidate set at apply time and asserts the count (`RAISE EXCEPTION` if over a stated ceiling); write the audit SELECT output into the batch note; D1 repair of historical rows may legitimately be "none needed". Update the plan text ("21 rows") and the L1 note.

### 11. [Medium] Several migrations rewrite shared functions from stale copies
Evidence: `housekeeping()` is changed by 0213 (O17), 0215 (api_rate_hit cleanup), possibly 0209 (purge call); `analytics_touch` by 0206 then 0215; `private.app_client_gate` by 0208 then 0216; `sms_retention`, `sms_heal_stuck`, `sms_try_pair` across 0209/0211. Each `CREATE OR REPLACE` replaces the whole body. A migration file written from an older repo copy silently reverts earlier work (live `housekeeping` already contains tombstone loops and ai rollups added after the repo's original file).
Change: protocol step 3 gains: "start every function rewrite from `pg_get_functiondef` of the live function, diff against the repo file, and add the diff to the batch note". Where possible add call-outs instead of body edits (separate small functions called from housekeeping).

### 12. [Medium] 0201 grant revocation: anon still needs two table reads and the 0190/0195 history says be careful
Evidence: live policies grant anon/public SELECT on `asset_prices` and `merchant_categories`; `useAssetPrices.ts` reads `asset_prices` from the browser client and can run before the session is restored (role anon at that moment). Round 1 deliberately skipped the anon revoke on the gate (Part 5, D5) for the same reason. `api_rate_limits_client_denied` also lists anon.
What breaks: "revoke anon ALL" removes the grants those policies depend on and returns empty prices on cold start ("dead prices" returns).
Change: 0201 revokes by an explicit table list and keeps `GRANT SELECT` for anon on `asset_prices` and `merchant_categories` (re-grant, then test cold-start). Revoke TRUNCATE/REFERENCES/TRIGGER from authenticated everywhere as planned. For profiles/user_settings column revokes: verified safe for `welcome_email_sent_at` and `data_reset_at` (profileToRow does not write them); re-verify user_settings columns against `settingsToRow` before revoking. Verified: `sms_ingest_tokens`, `trusted_devices` and `biometric_devices` are only touched by service-role routes (setup-token, device/*, biometric/*, admin), so locking them down does not break any client query.

### 13. [Medium] 0202 corroboration has no data to corroborate with
Evidence: `merchant_categories` columns are `merchant_key, category, source, sample_merchant, hit_count, updated_at`; no contributor information. 123 rows exist.
What breaks: a rule "promote only after N distinct users" cannot be evaluated for existing rows; if the read path starts requiring corroboration, all 123 curated entries vanish for SMS categorisation (regression vs round 1).
Change: 0202 adds a contributors table or `source_user_count`, grandfathers all 123 existing rows as corroborated, applies the rule to new writes only, and says whether the NON_SPEND rejection also cleans existing rows (SELECT count first).

### 14. [Medium] 0203 can lower template trust and may cascade the email audit
Evidence: 23 orphan `sms_template_users` rows (verified), 56 total. Recomputing `unique_user_count` drops counts for templates that those 23 users contributed to; promotion/quarantine thresholds depend on it (N16 changes them in 0211).
Change: before the delete, list templates whose count falls below the promotion threshold; take no demotion automatically (owner sees the list). `email_log` FK must be `ON DELETE SET NULL` (it holds bounce/complaint suppression and the audit trail for O7), not CASCADE.

### 15. [Medium] Decision vs plan contradictions
Binding decisions (Addendum 2 wins over the first table where they differ):
- **Arabic**: Decisions first table says "owner reviews the Arabic list before it ships"; Addendum 2 says "ship with the batch, owner reviews after". The plan footer follows Addendum 2, but ledger T3, DT6 and section 7 ("hold Arabic keys for sign-off or ship English fallback") follow the old wording. Fix the ledger; B9 ships Arabic, B12 collects the review list.
- **Export**: Addendum 2 says "No Export my data feature this round"; ledger C12 is FIX (B3: "build the authenticated route, ask owner before adding the button"). Change C12 to DEFER (round 3), keep C6 (admin DSR table list) only.
- **Memory proposals**: Addendum 2 says default OFF for new users (existing keep theirs); ledger I20 says "default stays unless owner asks". Change I20: new-user default false via the settings default, existing rows untouched.
- **SMS sender checks**: Addendum 2 says strict for credits, lenient for debits (purchases/debits stay auto-booked). Ledger N18 says any curated pattern with a known sender that mismatches goes to awaiting_confirmation. Restrict N18 to credit/income kinds and to the allow-list described in the decision; debits and iOS (no sender) stay auto-booked. Salary "confirm decisions actually post" is N1 (fine).
- **Notifications fallback**: ledger O9 "UTC fallback" and "needs Vercel Pro" contradict round 1 (Cairo fallback) and Addendum 2 (pg_cron replaces the hourly Vercel cron; Vercel stays daily backup). Fix the ledger text.
- **Week start**: T8/DT7 apply a timezone-based default "once to existing users"; 44 of 45 users have no timezone yet, so almost everyone would be classed as non-Egypt (Sunday). Store `week_start = NULL` meaning "auto" and resolve at read time from the reported timezone/country; do not run a one-off bulk write.
- **LTR**: consistent (T11/X14 use bidi isolation, no dir=rtl). **Retention order**: consistent in intent but violated by 0209 as written (issue 1).
- **L19** (Flow ordered by occurredAt) is approved in Addendum 2 yet tagged "NOT in DECISIONS" and sits in B11; no conflict, but move it to B5 with the other Flow work to avoid touching `useFlowLedger` four times.

### 16. [Medium] Overlaps FILE_OWNERSHIP table 3 misses (found by symbol/path grep)
- `src/lib/budget/lineEdit.ts`, `monthClose.ts`, `useBudgetPageActions.ts`: B1 (R1/R2) and B5 (R16, R19, R22, R34 on monthClose/closeBudgetCycle). Order B1 -> B5 is fine but it must be in the table; B5 must rerun B1's lineEdit tests.
- `recurringDebtDueHandlers.ts`: B1 (D10) and B2 (D5, D17); `useDebtTabData.ts` B1/B5/B9 is listed, this one is not.
- `src/lib/savings/*` (B1, whole directory) vs B2 (`hawl.ts`, `ZakatSheet`, `WithdrawSheetV3`) and B9 strings; `zakatInputs.ts` B1 (W17) vs B2 (W11).
- R11 (B1) says it also fixes "flow legacy income, Reports, recurringActiveForWindow"; those files are B5 files (`useReportsPage.ts`, flow band). Add them to B1 or split R11: engine part B1, consumers B5.
- `AddSavingsSheetV3`: B2 (W/L) and B5 (left-to-spend wording) and B9; `src/lib/store/useFinanceStore.ts` B1 (savings tx delete W5/W6), B2 (`deleteSavingsAccount` W20) - same slice, different functions, add the function list to the table.
- `WidgetSync.tsx`: B5 R20 fixes widget digits/keying, B6 V15 unmounts it and V24 removes its App Group; the R20 widget part is wasted. Move R20's widget half into V15 and delete it. (`src/lib/native/WidgetSync.tsx` is only used by AppShell.)
- `src/lib/supabase/remote/sync.ts` also needed by B3 (tier change, issue 8); it is listed only for B1/B8/B11.
- Q13/0218: live `ai_tmp_probe` does not exist and `fx_rates` has 0 rows, `live_market_data` 3 rows; the file must be written as IF EXISTS drops and must not drop `live_market_data` without a code grep (only `database.types.ts` references it today, so it can go, but check).

### 17. [Medium] Native dependency bump (Z1, B7) after native edits (B6)
Evidence: FILE_OWNERSHIP table 3 says "B7 Capacitor bump then re-sync native files". B6 edits `project.pbxproj`, `Package.swift`, AndroidManifest, `build.gradle`, `variables` (iOS 16.4, V22 removal, V6, V14); Capacitor 8.5.3 + `cap sync` regenerates `Package.swift`/plugin lists and can reset the deployment target or re-add the speech plugin.
Change: move Z1/Z14/Z15 (dependency bumps) to the start of B6 (or a B6a), then apply V4/V5/V6/V22/V14 on the bumped tree. The zod 4.6.7 bump also precedes B8's F2 (zod lazy import) and changes the schemas B2's receipt/Buddgy work validates; bump zod before B2 or retest B2 afterwards.

### 18. [Medium] Test and CI infrastructure arrives in B7, after six batches have used it
Evidence: Z7 (TZ-pinned tests), Z2 (pg tests in CI), Z11 (PR CI), Z8 (migration numbering check), Q10 (ledger repair) all sit in B7, yet the protocol requires "failing test first, TZ=Africa/Cairo" from B1 and applies 0197-0216 in B1-B6. db.md notes `supabase db reset` from repo files does not match live (duplicate numbers 0079/0103, files without ledger rows), so a pg-test job added late may fail on the migrations written in B1-B6 or need rework of them.
Change: add a short B0 before B1: Q10 (insert ledger rows for 0188-0196 via execute_sql), Z8 numbering check for new files, Z7 TZ pin in vitest config, Z10 (live-network eval out of `npm test`), Z11 PR CI. Keep Z2 in B7 but write each new migration (0197+) to be self-contained and runnable on a plain Postgres with stub schemas (no live-data-dependent statements in the file; put the data repair in a separate `*_repair.sql` executed by execute_sql).

### 19. [Medium] Retention numbers in the plan do not match the live design and privacy text
`C15` (B6) says the privacy policy must match B4's retention numbers, but B4's final numbers are only fixed at 0209b time. Order B6 policy text after 0209b, or write it from platform_settings values; avoid shipping a policy that states 7/30/60 days while the purge is still off (issue 1).

---

## LOW

### 20. [Low] Numbering and ledger bookkeeping
- Plan header "0213-0214" for B6 and ledger "0213 = push token sweeper, 0214 = optional consent" leave the scheduler migration unnumbered (issue 2). Reserve explicit numbers and keep a gap-free sequence; other sessions share the worktree and could create 0197 concurrently (reservation note in FILE_OWNERSHIP).
- 0200 adds `savings_accounts.updated_at`, which already exists live. All migrations should use `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP ... IF EXISTS`, and `DO $$ ... IF NOT EXISTS` for constraints so a re-run after a partial apply is safe.
- `database.types.ts` regeneration after each apply will also pull in the 0188-0196 changes; do the first regeneration as its own commit in B0 so B1's diff is readable.

### 21. [Low] Lock/timeouts and NOT VALID (checked, no blocker)
- Every touched table is under 700 rows; `ALTER TABLE ... ADD CONSTRAINT ... NOT VALID` and `CREATE INDEX` (non-concurrent) hold locks for milliseconds. No need for CONCURRENTLY. `authenticator` has `lock_timeout=8s`, `statement_timeout=8s`; execute_sql runs as postgres and is not capped that way, but run each DDL in its own call to keep a failed one isolated.
- Q8: live violators of `amount > 0`: expenses 0, income_events 0, debt_payments 0, savings_transactions 0; occurred_at outside 2000-2100: 0. NOT VALID is safe today. Remaining risk is future client writes (I8 before Q8 already in the ordering; also keep SMS paths (B4) from writing 0-amount rows: N10 refunds use `refund_kind`, amounts stay positive).
- 0204 `debts` zero-amount credit-card debts mentioned in ledger section 7 are not covered by the three-table constraint; leave `debts` out (as planned).
- Gate and cron changes: pg_cron jobs are plain `SELECT public.fn()`; no timeout issue.

### 22. [Low] Round-1 collisions checked
- Round 1 (Part 5/6): A4 device header stays optional (`SMS_REQUIRE_DEVICE_HEADER`), 0195 gate in `private`, per-user timezone with Cairo fallback, biometric unbind on sign-out (commit 27229014), 0196 dropped `payday_weekend`. C18 (validate device header) must stay optional for old builds; C8/C5 biometric unbind must not duplicate 27229014's sign-out unbind (extend it, do not re-add); T8 week start does not touch `shiftToBusinessDay` (Sat/Sun held decision), keep it out of scope. No ID reverts a round-1 fix, except the three ledger texts that contradict round 1 (issue 15, UTC fallback; issue 2).

---

## Verified OK (no change needed)
- Order constraints 1-7 in FILE_OWNERSHIP section 3 are internally consistent (R11 < F4, I8/D6/L16/L17 < Q8, C1 < F10, LF3+LF6 < N2 purge in intent, D8 < D22).
- No migration depends on a later one; 0198 is used by 0210, 0201 by 0208, 0209 by 0211 (hold key), 0215/0216 after 0206/0208.
- All referenced objects exist live: `adjust_pocket_balance`, `cleanup_abandoned_anon_users`, `cleanup_expired_trusted_devices`, `record_sms_template_signal`, `sms_try_pair`, `sms_heal_stuck`, `get_sms_keyword_pool`, `analytics_touch`, `api_rate_hit`, `housekeeping`, `set_updated_at`, `sms_corpus`, `sms_parse_log.harvested_at`. Not present (to be created): `expenses.subcategory/category label/shared_plan_id`, `savings_accounts.target_amount/emoji`, `debt_payments.sms_log_id`, `user_settings.week_start/sms_consent_at`.
- No client query breaks from the trusted_devices / biometric_devices / sms_ingest_tokens lockdown (service-role only).
- Dropping `sms_parse_log` from the realtime publication is safe for the app: the only client channel is a private broadcast channel (`AppShell.tsx` SmsNudgeSync), not postgres_changes.
- 0204 NOT VALID constraints have 0 live violators; no lock risk anywhere.
- LTR decision is consistent with T11/X14.
