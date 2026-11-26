# W2e: live database evidence (read-only, 2026-11-26)

Project `tzioppxwsljhlglyducm`, eu-central-1, Postgres 17.11, `ACTIVE_HEALTHY`. All queries were catalog/stat reads or function-definition reads; no writes, no `EXPLAIN ANALYZE`, no PII returned.

## Size and capacity
- DB size 38 MB. 58 `auth.users` (pre-launch, internal testers plus QA synthetic users).
- Largest table `sms_parse_log` 2.6 MB / ~1.2k rows; `expenses` 2.0 MB / ~0.9k rows; every other table under 1.4 MB.
- Index size exceeds heap size on most tables (e.g. `expenses` 1.7 MB of 2.0 MB is index). 405 indexes in `public`.
- `max_connections` 60, `shared_buffers` 64 MB → smallest compute class (tier name NOT VERIFIED). 29 connections open, 2 active at sample time.
- Cache hit 99.99%; `shared_blks_read` per hot query ≈ 0. Working set is entirely in memory.

## pg_stat_statements (installed, stats since 2026-11-16, ~10.7 days, includes QA runs)
| Function / statement | Role | Calls | Mean ms | Max ms | Blocks/call | WAL rec/call |
|---|---|---|---|---|---|---|
| `entitlements_state(p_user)` | service_role | 12,664 | 433 | 40,957 | 610 | 1.4 |
| `sync_pull_v2()` (with `p_since`) | authenticated | 12,887 | 143 | 9,767 | 706 | 0.2 |
| `sync_pull_v2()` (full pull) | authenticated | 2,412 | 262 | 7,022 | 1,149 | 0.9 |
| `private.db_pre_request()` | authenticated | 93,819 | 15.0 | 13,463 | – | – |
| `private.db_pre_request()` | service_role | 288,193 | 2.4 | 2,506 | – | – |
| `analytics_touch` | authenticated | 6,256 | 111 | 14,403 | 176 | 4.8 |
| `sync_changed_since` | authenticated | 11,985 | 51 | 8,897 | 290 | 0.1 |
| `trial_claim` | service_role | 4,441 | 102 | 6,870 | 142 | 3.0 |
| `loyalty_week_summary` | authenticated | 5,777 | 74 | 5,833 | 155 | 0 |
| `api_rate_hit` | service_role | 11,915 | 28 | 26,000 | 51 | 2.7 |
| `second_factor_verified` | service_role | 12,646 | 23 | 9,628 | 31 | 0 |
| `latest_balance_reports` | authenticated | 3,041 | 42 | 8,272 | 92 | 0 |
| `profiles` welcome_email_sent_at UPDATE (2 shapes) | service_role | ~16,000 | 19–27 | 5,114 | – | – |

Window caveat: stats start at project creation (2026-11-16 03:45, the Frankfurt move) and the traffic is dominated by QA runs and internal testers; maxima cannot be dated. Even trivial statements (`set_config`, 0.4 ms mean) show 0.7-0.8 s maxima, so the tail is instance-wide, not specific to one function.

Reading: a few hundred cached buffer hits cost single-digit ms of CPU. Means of 23–433 ms with max 5–41 s and stddev above the mean point at waiting (CPU on a small shared instance and/or row-lock waits), not at plan or index problems. The DB is neither I/O-bound nor data-bound.

## Function findings
- **`entitlements_state` is a read that writes.** `VOLATILE SECURITY DEFINER`; it first calls `rewards_touch(p_user)` (referral evaluation, promo banking, `loyalty_refresh_tier`) and `referral_ensure_code(p_user)` (insert-if-missing), then ~20 sub-selects into one JSON. Called from `GET /api/entitlements/me` (`src/app/api/entitlements/me/route.ts:75`), refreshed by `useBillingStore.refresh()` from ~12 call sites (`BillingHost` on sign-in, Pro/Usage/Rewards/Invite/Founders pages, limit-denied, balance view, sparks packs, purchase polling `refreshUntilStore` 6×2 s). Event-driven; no interval polling found. The upkeep takes row locks on per-user loyalty/referral rows, so concurrent calls for one user serialize: a likely cause of the 41 s max (PLAUSIBLE; lock waits not sampled).
- **`db_pre_request`** runs on every PostgREST request: `app_client_gate` (header parse, `platform_settings` by key), `session_live_gate` (`auth.sessions` by PK), `two_factor_gate` (`platform_settings` by key, `user_settings` by PK only when the mode is on). All indexed point lookups; 2.4 ms mean for service_role is fine. service_role requests (288k) are 3× authenticated (94k): server routes issue many small PostgREST calls.
- **`welcome_email_sent_at` UPDATE ~16k times in 10 days for 58 users** (two statement shapes, ~8.3k and ~7.9k). Traced: `src/app/api/auth/welcome/route.ts` claims with `UPDATE ... WHERE welcome_email_sent_at IS NULL` (a no-op after the first success, so not a missing guard) and gives the claim back (`SET NULL`) when the send fails; the client (`AuthProvider.tsx:241-256`) only stops asking after a 2xx. `email_log` shows 3,410 `welcome` failures, all `RESEND_API_KEY is not set`, all on 2026-11-18/19, `user_id` null on every row; 5 delivered. Reading: a past configuration incident (which environment: NOT VERIFIED) amplified by a claim-and-give-back loop with no backoff. Counts do not fully reconcile (16k UPDATEs vs 3.4k logged failures); the rest are likely no-op claim attempts from QA users. Design weakness, not a live defect.

## Indexing
- Advisor: 0 unindexed foreign keys (own check confirms `fk_unindexed=0`), 0 RLS init-plan warnings. 31 `unused_index` INFO lints, including 6 BRIN indexes and 2 trigram indexes on `profiles` (admin search).
- "Unused" is unreliable: 10 days of stats on tables under 1.2k rows, where the planner rightly prefers seq scans. Do not drop on this evidence alone.
- Redundant pairs (left is a prefix of right, same predicate): `idx_debt_payments_user` ⊂ `idx_debt_payments_user_updated`; `idx_expenses_live` ⊂ `idx_expenses_live_user_id`; `idx_income_events_user` ⊂ `idx_income_events_user_updated`; `idx_savings_transactions_user` ⊂ `idx_savings_transactions_user_updated`. Drop candidates later (each adds write cost on hot sync tables).
- High seq_scan counts on small tables (`savings_accounts` 29k, `income_sources` 21k, `debts` 20k) are expected at this size.

## Scheduled jobs (pg_cron, 16 active, last 7 days)
All succeeded (0 failures). Heaviest: `sms-retention` 382 ms, `housekeeping` 378 ms, `cleanup-anon-users` 363 ms. `sms-tick` every 15 min at 89 ms. Retention exists for `api_rate_limits` (25 h, hourly), `client_crashes` (120 d), `site_leads` (180 d), `cron.job_run_details` (7 d), SMS (`sms_retention`), generic `db_retention`.

## Security advisor (Phase 10 cross-check)
- 60 `rls_enabled_no_policy` INFO: service-role-only tables by design (admin_*, billing_events, email_*, plans, platform_settings, ...). Correct deny-by-default.
- 25 SECURITY DEFINER functions callable by `authenticated` (money RPCs, loyalty, referral). Intended API surface; each must check `auth.uid()` ownership internally (not re-verified here).
- 1 anon-callable definer: `referral_inviter_first_name(p_code)` (invite landing). Intended; an unauthenticated lookup worth rate limiting.
- `pg_net` in `public` (accepted, QA-101). Leaked-password protection disabled (Auth setting).

## Scalability conclusions (Phase 9 inputs)
- Partitioning, sharding, read replicas, Citus: NOT NEEDED (38 MB, 58 users, 100% cache hit).
- Connection pooling: PostgREST and Supavisor already pool; 29/60 connections. Not a problem now.
- The one infrastructure lever with evidence: compute tier. Tail latency (max 5–41 s on cached point reads) fits a CPU-starved smallest instance. Confirm first in the Supabase dashboard (CPU, Database health) for the spike windows (NOT VERIFIED here).
