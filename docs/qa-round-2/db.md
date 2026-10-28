# QA Round 2 - DATABASE DEEP (live project ydihurtbcnoflhormgzi, SELECT-only, 2026-10-27)

Scope done: all 84 public tables, 2 views, 94 public functions (all SECURITY DEFINER bodies of authenticated-callable RPCs + triggers + cron fns read), every pg_policies row, FKs/unique/check constraints, enums, triggers, cron.job + run details, storage/realtime/extensions/event triggers, security + performance advisors, pg_stat_statements, postgres logs, anomaly aggregates, ledger vs repo.
Not re-reported (already in QA_ROUND_PLAN): D1-D9, A1-A25, 0188-0195 items.
Counts: P1 1, P2 8, P3 12.

Clean (verified): RLS on for 84/84; every user-facing table has own-row USING+WITH CHECK via (select auth.uid()); no policy uses auth.role() except service_role_only on 2 tables; views are security_invoker; all authenticated-callable SECURITY DEFINER RPCs check auth.uid() and pin search_path; admin_*/ai_quota_*/sms_* SD functions are NOT executable by anon/authenticated; no extensions in public; no storage buckets/objects; no edge functions; realtime publication = sms_parse_log only (RLS applies) + own-topic broadcast policies; every table with user_id FKs to auth.users ON DELETE CASCADE except those in Q5; perf advisor only shows 47 unused indexes (INFO), no initplan/unindexed-FK lints; zero orphans on all unconstrained link columns (Q9); 45 users = 45 profiles = 45 user_settings.

## P1

### Q1 P1 - sms_retention() cron fails every night; raw bank SMS bodies never purged
Object: cron job 7 `sms-retention` -> public.sms_retention(); column sms_parse_log.raw_body (NOT NULL, no default).
Problem: function runs `UPDATE sms_parse_log SET raw_body = NULL ...`, violating NOT NULL, so the statement aborts and the following `DELETE FROM sms_corpus ...` never runs either. 4 of 4 runs in the last 14 days failed. Retention promise (30 days) is broken for financial SMS text and corpus pruning is dead.
Evidence: `select status,count(*) from cron.job_run_details ... group by` -> sms-retention failed:4 ("null value in column raw_body ... violates not-null constraint"); postgres_logs shows the same error. `select count(*) from sms_parse_log where received_at < now()-'30 days'` -> 667 of 859 rows still hold raw_body (older30=667, nullraw=0). sms_corpus n_dead_tup=64, never vacuumed.
Fix:
```sql
alter table public.sms_parse_log alter column raw_body drop not null;
-- then verify app code tolerates null raw_body (sms_try_pair, re-adjudication, undo paths)
select public.sms_retention();
```
(Alternative: change function to set raw_body = '' instead of NULL.) Add an alert on any cron.job_run_details.status='failed'.

## P2

### Q2 P2 - sms_ingest_tokens: owner can UPDATE any column (re-activate revoked token) and tokens are plaintext
Object: policy sms_ingest_tokens_update_own (UPDATE, no WITH CHECK, no column limit); authenticated holds UPDATE grant; column token uuid plaintext.
Problem: admin "reset_sms_tokens" and device revoke set is_active=false via service role, but the user can `PATCH /rest/v1/sms_ingest_tokens?id=eq.X {is_active:true}` and revive it (also edit device_id, token). Plaintext token + owner SELECT policy means any DB read/backup leak = ingest-as-user (B22 confirmed plaintext).
Evidence: pg_policies row; information_schema columns: token uuid NOT NULL default gen_random_uuid(); 20 active tokens for 13 users, 5 users with >1 active.
Fix:
```sql
drop policy sms_ingest_tokens_update_own on public.sms_ingest_tokens;  -- all writes go through service role routes
revoke update, insert, delete, truncate on public.sms_ingest_tokens from anon, authenticated;
-- longer term: store sha256(token), compare hashed
```

### Q3 P2 - trusted_devices direct insert/update lets any session self-trust a device (2FA bypass at DB level)
Object: policies trusted_devices_self_insert / self_update (authenticated).
Problem: extends A1 (route). Even if the route is fixed, a signed-in client can `POST /rest/v1/trusted_devices` with its own user_id and a chosen device_id, defeating email 2FA. Same for refreshing last_used_at to dodge the 180-day expiry.
Evidence: pg_policies: self_insert WITH CHECK user_id=auth.uid(); no column restrictions.
Fix:
```sql
drop policy trusted_devices_self_insert on public.trusted_devices;
drop policy trusted_devices_self_update on public.trusted_devices;
revoke insert, update on public.trusted_devices from anon, authenticated;
```

### Q4 P2 - Global merchant_categories can be poisoned by one user (client-settable sms_log_id)
Object: trigger trg_remember_merchant_category -> remember_merchant_category_on_edit() (SECURITY DEFINER); expenses.sms_log_id (no FK, no ownership check); merchant_categories.source='user'.
Problem: any user can write an expense with an arbitrary non-null sms_log_id, edit its category once, and the trigger upserts merchant_categories (a table read for every user's SMS categorisation). upsert_merchant_category() makes source='user' win over seed and ai forever, so one edit overrides the category for all users for that merchant key. No corroboration threshold. (Same class as S10.)
Evidence: function bodies; merchant_categories: user=4, seed=19, ai=100 rows.
Fix: require corroboration, e.g. only promote when >=3 distinct users agree (store per-user votes), and verify the sms log belongs to auth.uid():
```sql
-- in trigger: if not exists (select 1 from sms_parse_log l where l.id=new.sms_log_id and l.user_id=auth.uid()) then return new; end if;
alter table public.expenses add constraint expenses_sms_log_fk foreign key (sms_log_id) references public.sms_parse_log(id) on delete set null not valid;
```

### Q5 P2 - Account deletion leaves personal rows (no FK) and PII text
Object: sms_template_users.user_id, sms_stats_outbox.user_id, email_log.user_id/to_email, admin_financial_exclusions.user_id, admin_access_grants.target_user_id, admin_audit_log.actor_id (all uuid without FK); support_tickets.requester_email + context, client_crashes.device_id (FK is ON DELETE SET NULL but text PII stays).
Problem: deleting an auth user cascades 60+ tables but not these. Verified leak: 23 of 51 sms_template_users rows point at users that no longer exist (also inflates unique_user_count used by template promotion).
Evidence: `select count(*) from sms_template_users s where not exists (select 1 from auth.users u where u.id=s.user_id)` -> 23. Other orphan counts 0 today.
Fix:
```sql
delete from public.sms_template_users s where not exists (select 1 from auth.users u where u.id=s.user_id);
alter table public.sms_template_users add foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.email_log add foreign key (user_id) references auth.users(id) on delete set null;  -- plus null to_email on delete
alter table public.sms_stats_outbox add foreign key (user_id) references auth.users(id) on delete cascade;
```
Also scrub support_tickets.requester_email/context in the account-delete route; recompute unique_user_count.

### Q6 P2 - SECURITY DEFINER RPCs trust ids/currency inside arguments
Object: deposit_to_savings, withdraw_from_savings, correct_savings_balance, add_debt_payment_with_expense, add_income_with_debt, add_subscription_with_recurring_expense, update_subscription_and_re.
Problems (RPCs bypass RLS, so FK targets are not tenant-checked):
1. deposit/withdraw take p_currency but add p_amount to current_balance without comparing to the account currency: depositing 100 USD into an EGP pocket adds 100 EGP. Evidence: body `current_balance = current_balance + p_amount`, no currency check.
2. No `deleted_at is null` check on the account (tombstoned pocket can be changed), correct_savings_balance has no >=0 check on p_new_balance and no row lock (read-then-write race between concurrent deposit and correct).
3. payment_method_id (payment, expense, subscription, income), linked_credit_card_debt_id inside jsonb are not verified to belong to auth.uid(); FK passes for another tenant's uuid.
4. They write `balance_after` as NULL: 43/43 savings_transactions have balance_after NULL (22 live), while adjust_pocket_balance and correct set it.
5. Not idempotent: replaying with the same p_*.id raises 23505 instead of returning the existing row (offline retry shows an error although the write landed).
Fix sketch:
```sql
-- in deposit/withdraw after loading v_acc:
if v_acc.deleted_at is not null then raise exception 'account deleted'; end if;
if p_currency is distinct from v_acc.currency then raise exception 'currency mismatch'; end if;
select * into v_acc from savings_accounts where id=p_account_id for update;
-- jsonb ids:
if v_pm is not null and not exists (select 1 from payment_methods where id=v_pm and user_id=v_user) then raise exception 'payment method not owned'; end if;
```

### Q7 P2 - Anonymous sign-ins enabled but unused; cleanup jobs not scheduled
Object: Auth config (advisor auth_allow_anonymous_sign_ins on 40 tables), public.cleanup_abandoned_anon_users(), public.cleanup_expired_trusted_devices(), cron.job.
Problem: grep of src finds no signInAnonymously, yet 8 anonymous users exist (oldest 2026-04-17, all >14 days idle). Anyone can mint unlimited `authenticated` identities, bypassing per-user quotas/rate limits (ai_quota, per-user keyed limiters) and write rows (analytics events, notifications, expenses). Neither cleanup function appears in cron.job (10 jobs listed); 4 of 5 trusted_devices are older than 180 days. 6 non-anonymous users never confirmed email (oldest March).
Evidence: `select count(*) from auth.users where is_anonymous` -> 8; cron.job has no cleanup entries.
Fix: disable anonymous sign-ins in Auth settings (or enable captcha); then
```sql
select cron.schedule('cleanup-anon','15 2 * * *','select public.cleanup_abandoned_anon_users()');
select cron.schedule('cleanup-trusted','20 2 * * *','select public.cleanup_expired_trusted_devices()');
```

### Q8 P2 - No CHECK constraints on money, dates or free-text enums
Object: expenses, income_events, debts, debt_payments, savings_*, recurring_*, subscriptions, user_settings.timezone, goals.priority, ai_provider text.
Problem: only day-of-month and a few enum-like checks exist (84 tables, ~100 checks, none on amounts or dates). Server and sync accept zero/negative/absurd amounts and any date. Live data already shows it: expenses dated 2028-06-21 and 2030-07-26 (future) and 2009-07-26 (393 EGP); 2 active credit_card debts with amount 0; user_settings.timezone is free text (validated only in app code; all 45 rows are still NULL because the 0192 client build has not reported yet).
Evidence: pg_constraint listing; anomaly queries (exp_future=2, exp_old=1, debts_nonpos=2).
Fix (NOT VALID first, then validate after cleaning):
```sql
alter table expenses add constraint expenses_amount_pos check (amount > 0) not valid;
alter table expenses add constraint expenses_date_sane check (expense_date between date '2015-01-01' and current_date + 366) not valid;
alter table income_events add constraint ie_amount_pos check (amount > 0) not valid;
alter table debt_payments add constraint dp_amount_pos check (amount > 0) not valid;
alter table savings_transactions add constraint st_amount_nonneg check (amount >= 0) not valid;
alter table user_settings add constraint tz_valid check (timezone is null or exists_tz(timezone)) -- implement via function using pg_timezone_names (cached view) or leave to app
```

### Q9 P2 - Link columns without FK (dangling or cross-tenant refs possible)
Object (uuid, no FK): expenses.sms_log_id, income_events.{sms_log_id, payment_method_id, linked_debt_id, linked_savings_account_id, template_id, shared_plan_id}, income_sources.{linked_debt_id, linked_savings_account_id, shared_plan_id}, profiles.{active_budget_plan_id, default_carry_pocket_id, active_shared_budget_id, default_shared_budget_plan_id}, savings_accounts.linked_payment_method_id, subscriptions.linked_recurring_expense_id, savings_month_summary.pocket_id, sms_parse_log.{debt_payment_id, savings_transaction_id, paired_log_id, learn_template_id}.
Also: every existing FK is single-column on id, so none enforces same user_id (RLS WITH CHECK only checks the row's own user_id).
Problem: hard-purge by housekeeping (90 day tombstones) or user delete can leave dangling ids; a client can reference another tenant's uuid. Today: 0 orphans in all of them (checked each), so this is preventive.
Fix: add FKs `on delete set null` (NOT VALID then VALIDATE); consider composite unique (id,user_id) + composite FKs for the hot paths (expenses.payment_method_id, debt_payments.debt_id).

## P3

### Q10 P3 - Migration ledger gaps (live objects exist; ledger rows missing)
Repo files with no ledger row but objects present: 0126_admin_rate_hit (fn exists), 0127_admin_analytics_perf, 0128_ai_gateway_quota (ai_quota_* exist; ledger has 0126a_ai_gateway_tables), 0150_accounts_core, 0151_ledger_links, 0152_balance_reports_adjustments (tables exist), 0153_privacy_settings (user_settings.privacy exists), 0154_adjust_pocket_balance (fn exists), 0155_pocket_balance_source, 0156_accounts_fk_indexes, 0157_net_worth_snapshot_basis (basis col exists), 0163_policies_authenticated_only (superseded by 0190), 0170_ai_cost_report (admin_ai_cost_daily exists), 0172_dsr_permission, 0173_price_book_manage, 0188-0192, 0194-0196 (applied via execute_sql, never in ledger; 0193 has no repo file but payday_weekend was added then dropped by 0196: column is absent, consistent). 0129 does not exist in repo. Duplicate numbers 0079 and 0103 (x2 each) in repo. Net: a fresh `supabase db reset` or `migration repair` will not match live; ledger names differ from filenames.
Fix: `supabase migration repair --status applied <version>` per row; rename duplicates.

### Q11 P3 - anon/authenticated hold ALL privileges (incl. TRUNCATE, REFERENCES, TRIGGER) on ~55 public tables
Object: role_table_grants. RLS blocks DML, but TRUNCATE is not subject to RLS and any future disabled-RLS/forgotten policy exposes full write. Includes server-only tables (fx_rates, ai_price_book, ai_reservations, api_rate_limits, sms_keyword_pool, sms_sender_pool, sms_promotion_config, sms_template_users, sms_corrections).
Fix:
```sql
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
```
then re-grant select/insert/update/delete only on the user tables.

### Q12 P3 - Hot-path overhead
pg_stat_statements: `INSERT INTO app_analytics_events` 26,094 calls, mean 59.8 ms (1.56M ms total, for 45 users; client event spam while analytics_touch RPC already exists); `select private.app_client_gate()` called on every request, 7,222 calls mean 60.8 ms; realtime `wal->>type` poll on the sms_parse_log publication 1.5M calls / 10.1M ms total. api_rate_hit() executes `delete from api_rate_limits where window_start < now()-1h` on every hit (write amplification, lock contention; admin_rate_hit has no cleanup).
Fix: batch/drop client analytics events in favour of analytics_touch; cache gate result in middleware (it is cheap data); evaluate whether postgres_changes on sms_parse_log is still needed given broadcast nudge (0143); move rate-limit cleanup to a cron job.

### Q13 P3 - Dead and leftover objects
- public.ai_tmp_probe() SECURITY DEFINER debug function (deletes from ai_reservations / inserts ai_usage_events); not executable by clients, but drop it.
- live_market_data (3 rows, last_fetch 2026-03-29, zero src references) and fx_rates (0 rows, zero src references; types regenerated in D4) look dead.
- Enum values never used: savings_transaction_kind 'withdraw' (rows use 'withdrawal'), savings_type 'bond', gold_karat lacks 14/12 while savings_holdings.karat check allows 12,14 (debts.gold_karat vs holdings mismatch).
- Columns referenced only by mappers/types: shared_plan_id (2), active_shared_budget_id, default_shared_budget_plan_id, buddgy_flow, catalog_region, ai_provider (1 file).
- GoalStatus 'cancelled' (TS) is mapped to 'paused' (goalMapper.ts:31): a cancelled goal reappears as paused after the next pull.
Fix: `drop function public.ai_tmp_probe();` and decide on the rest.

### Q14 P3 - Missing/redundant updated_at triggers
Tables with updated_at but no BEFORE UPDATE trigger: push_tokens, savings_month_summary, sms_sender_currency, merchant_categories, asset_prices, sms_promotion_config, sms_tracking_templates_ai, platform_settings, email_templates (set by code or ignored). savings_month_summary is user-readable and carry-cron-written; stale updated_at breaks any delta sync if it joins sync later. income_sources has two updated_at triggers (trg_income_sources_updated and trg_income_sources_updated_at, both fire).
Fix: `drop trigger trg_income_sources_updated on public.income_sources;` add set_updated_at to savings_month_summary/push_tokens.

### Q15 P3 - Tombstone purge vs offline clients; sync_pull is an unpaginated snapshot
housekeeping() hard-deletes rows with deleted_at older than 90 days across 21 tables. A device offline >90 days (or with a cursor older than that) never receives the deletion and can re-push the stale row, resurrecting it. sync_pull(null) returns every live row of 17 tables plus all budget rows in one jsonb value (no paging; PostgREST/response size limit risk as users grow; today biggest user is small). Live tombstones now: budget_plans 25 (of 38), savings_accounts 12, savings_transactions 21, debts 8, expenses 27 (oldest 2026-08-06).
Fix: clients with cursor older than 60 days must do a full resync (server returns `needs_full` when p_since < now()-'60 days'); page sync_pull per table.

### Q16 P3 - SECURITY DEFINER trigger record_sms_template_signal trusts client sms_log_id
Any user can point own expense/income_event sms_log_id at another user's parse log and edit it, writing sms_template_signals against that user's matched template (cap max_user_signals_per_day=10 per attacker). Low impact, but with anonymous sign-ins (Q7) the cap is per identity. Fix with the ownership check from Q4.

### Q17 P3 - sms_parse_log has a long failure tail and no pruning
Status mix: confirmed 663, rejected 124, failed 67, paired 4, add_failed 1, notified 1; 68 failed/add_failed rows since 2026-06-18 never retried or removed; 11 is_duplicate rows. housekeeping never deletes sms_parse_log (859 rows, 1.8 MB, largest table; 203 dead tuples, vacuum 2026-10-20). Fine today, grows linearly with SMS volume.
Fix: add `delete from sms_parse_log where received_at < now()-'180 days' and status in ('rejected','failed')` to housekeeping.

### Q18 P3 - Possible duplicate expenses
7 groups of active expenses with identical (user, amount, date, description, payment_method). Could be legitimate (two coffees) or double-posts from the pre-fix SMS confirm race (B4). No unique guard exists on expenses(sms_log_id) / income_events(sms_log_id) (none duplicate today).
Fix (defence in depth): `create unique index expenses_sms_log_uidx on expenses(sms_log_id) where sms_log_id is not null and deleted_at is null;` same for income_events.

### Q19 P3 - Bulk-delete and policy-shape hygiene
profiles_delete_own and user_settings_delete_own let a user delete their own profile/settings row via PostgREST; handle_new_user only runs on insert into auth.users, so the user ends up with auth identity but no profile (sync_pull returns has_profile=false; onboarding gate behaviour unverified). No policy-level protection for profiles columns welcome_email_sent_at / data_reset_at (user can null welcome_email_sent_at to be re-welcomed).
Fix: drop the two delete policies (deletion goes through /api/account/delete with service role); revoke update on welcome_email_sent_at, data_reset_at (column-level grant).

### Q20 P3 - Backups / PITR and Auth config not verifiable via SQL
Not reachable with SELECT tools: PITR/backup schedule, Auth settings (anon sign-ins, leaked-password D6, OTP expiry, JWT TTL), network restrictions. Please confirm PITR is enabled on this Pro project; the unified DB has no scheduled logical backup job (cron has none).

## Advisors snapshot
Security: 39 rls_enabled_no_policy (INFO, all intentional service-only), 10 authenticated_security_definer_function_executable (WARN, reviewed: all own-checked, see Q6), anonymous-policy lint on 40 tables (root cause Q7), leaked password protection disabled (D6, known).
Performance: 47 unused_index (INFO). No other lints.

## Cron status (last 14 days)
admin-metrics 311 ok; sms-heal-stuck 932 ok; sms-stats-drain 932 ok; sms-zero-variance 78 ok; analytics-rollup, housekeeping, user-milestones, crash_retention, cron-log-trim ok; sms-retention 4/4 FAILED (Q1). Missing from cron: cleanup_abandoned_anon_users, cleanup_expired_trusted_devices (Q7).

## Not reached
RLS impersonation simulation (policies read statically; no begin/set role test run), Auth/PITR settings (Q20), reading the 5 QA skill files in full, per-RPC call-site audit in src (rpc.ts wrappers found; callers not traced), Vercel/API cron side, mapper column-by-column diff beyond enums, performance under load.
