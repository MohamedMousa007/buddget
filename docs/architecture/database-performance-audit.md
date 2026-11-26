# Database & data-access performance audit

Date: 2026-11-26. Scope: the Supabase Postgres database behind the main app and the admin portal, and every code path that reads or writes it. Companion reports: [application architecture](application-architecture-audit.md), [skills](skills-evaluation-and-installation.md), [roadmap](performance-optimization-roadmap.md), [diagrams](architecture-diagrams.md). Raw evidence: [`_work/`](_work/) (W1a inventory, W2a main-app code audit, W2b admin, W2c frontend, W2e live DB).

Audit only: no code, schema, migration, config or data was changed.

## 1. Method and evidence quality

| Evidence | Source | Quality |
|---|---|---|
| Schema, indexes, constraints, sizes | Live catalog reads (`pg_class`, `pg_index`, `pg_constraint`, `pg_stat_user_tables`), project `tzioppxwsljhlglyducm` | Measured |
| Query timings | `pg_stat_statements` (already installed), 2026-11-16 03:45 to 2026-11-26, about 10.7 days | Measured, but QA-dominated and pre-launch; maxima cannot be dated |
| Advisors | Supabase `get_advisors` (performance and security) | Measured |
| Cron health | `cron.job_run_details`, last 7 days | Measured |
| N+1, pagination, over-fetching | Code reading (Sonnet sub-audits, then spot-checked) | Code-level; no request tracing |
| Query plans | Not collected. Every hot table is under 1.2k rows, where the planner seq-scans whatever the index set, so a plain `EXPLAIN` proves nothing yet. No `EXPLAIN ANALYZE` ran on live (project rule). | Not available |

Every live query was read-only, one at a time, bounded, and returned counts or ids only. Labels used below: **Measured** (live numbers), **Proven** (the code makes the behaviour certain), **Potential** (depends on growth not measured), **NOT VERIFIED**.

Severity scale (same in every report):
- **CRITICAL**: data loss, data leak or outage now. None found.
- **HIGH**: a defect that hurts users or security now, whatever the data size.
- **MEDIUM**: proven code-level risk that bites at modest growth (hundreds to low thousands of users), or a cheap-to-exploit hardening gap.
- **LOW**: needs large growth, or a minor optimisation.
- **INFORMATIONAL**: context, docs drift.

## 2. Discovered architecture (database)

- Engine: PostgreSQL 17.11 on Supabase, eu-central-1 (Frankfurt), project created 2026-11-16. Status `ACTIVE_HEALTHY`.
- Access: supabase-js 2.119 straight to PostgREST, with no ORM. The client uses the `authenticated` role under RLS, and server routes use a service-role client (RLS bypass). One PostgREST pre-request hook (`private.db_pre_request`) runs three gates on every request: minimum app version, session still live, second factor.
- Size: **38 MB**, **58 users** (internal testers plus QA synthetic users). The largest table, `sms_parse_log`, is 2.6 MB with about 1.2k rows. Cache hit ratio is 99.99%.
- Capacity: `max_connections` 60 and `shared_buffers` 64 MB, which matches the smallest compute class (tier name NOT VERIFIED). 29 connections were open and 2 active when sampled.
- Pooling: PostgREST holds its own pool, and Supavisor fronts direct connections. The app never opens raw Postgres connections from Vercel.
- Scheduling: 16 active pg_cron jobs, all succeeded over 7 days (heaviest 382 ms), plus 7 Vercel crons (`vercel.json`). `/api/cron/notifications` is called only by pg_cron, by design.
- Migrations: 341 files in `supabase/migrations/`, numbered and applied with `execute_sql` per `CLAUDE.md`; the ledger table is informational only.
- Extensions in use: `pg_stat_statements`, `pg_cron`, `pg_net` (in `public`, accepted as QA-101), `pg_trgm`, `pgcrypto`, `uuid-ossp`, `supabase_vault`.
- Read replicas, Redis, partitioned tables: none.

## 3. Schema assessment (Phase 2)

Live counts: 121 tables in `public`, all with a primary key and RLS on. 168 foreign keys (98 `CASCADE`, 68 `SET NULL`, 2 `NO ACTION`), 22 unique and 202 check constraints, 24 enums, 40 json/jsonb columns, 0 `timestamp without time zone` columns.

| Area | Finding | Status |
|---|---|---|
| Keys | Every table has a PK; uuid PKs on user data (client-generated ids for offline sync). | Correct for an offline-first sync model. The skill's advice to prefer `bigint identity` or UUIDv7 does not fit here: ids are minted on the device. |
| Foreign keys | 0 unindexed FKs (advisor plus own check). Cascades on user-owned rows make account deletion one statement per root. | Correct |
| User isolation | 84 tables carry `user_id`. 9 have a nullable `user_id`, all by design (system or anonymous rows: `email_log`, `client_crashes`, `support_tickets`, `trial_claims`, `billing_events`, `founders`, `admin_staff`, `sms_stats_outbox`, `sms_tracking_templates_ai`). 3 have `user_id` with no FK: `billing_events` (webhooks can arrive before or after the account exists), `sms_repair_audit` and `admin_financial_exclusions` (audit rows meant to outlive the user). | Intentional; document it in the table comments |
| Money types | 37 money columns are `numeric`. Integer columns hold micro-units or points (`cost_usd_micro`, `price_micros`, `points_balance`, `price_*_cents`). One `float8` column: `support_tickets.triage_confidence` (a score, not money). | Correct |
| Time | No `timestamp without time zone`. Local dates are `date` columns (`expense_date`, `occurrence_date`) alongside `timestamptz`. | Correct |
| Soft delete | `deleted_at` on 21 tables (the synced finance tables). Partial indexes `WHERE deleted_at IS NULL` exist on the hot ones, and tombstones carry deletes across devices. | Correct |
| Normalisation | Normalised user tables. Deliberate denormalisation exists where measured or needed: `admin_metrics_cache`, `app_analytics_daily` rollups, `savings_month_summary`, `loyalty_accounts` counters. | Appropriate |
| Large columns | `profiles.avatar_image_path` stores a data URL. Live maximum is 163,743 characters, with no CHECK constraint; it is synced with `select('*')`. See [F-05](application-architecture-audit.md#f-05). `sms_parse_log.raw_body` is purged after 30 days, while `masked_body` stays. | F-05 |
| Growth tables | `sms_parse_log`, `expenses`, `income_events`, `ai_usage_events`, `email_log`, `notifications`, `api_rate_limits`, `admin_audit_log`, `app_analytics_events`. Retention jobs exist for all except `admin_audit_log` ([F-23](#f-23)) and `ai_usage_events` (NOT VERIFIED: not in the cron list read). | See F-23 |
| Index weight | 405 indexes. Index bytes exceed heap bytes on most hot tables (`expenses` 1.7 of 2.0 MB; `sms_parse_log` has 30 indexes, `expenses` 15). | [F-14](#f-14) |
| Migrations | Idempotent DDL (`IF NOT EXISTS`, `DO` blocks), grants reset by 0315/0316, lockdown defaults for new functions. | Good discipline |

## 4. Query performance and N+1 (Phase 3)

### 4.1 Measured hot statements

Taken from `pg_stat_statements`, 10.7 days, QA-heavy. Full table in [`_work/W2e`](_work/W2e-live-db-evidence.md).

| Statement | Calls | Mean ms | Max ms | Buffers/call | Note |
|---|---|---|---|---|---|
| `entitlements_state(p_user)` | 12,664 | **433** | 40,957 | 610 | Read path that writes ([F-01](#f-01)) |
| `sync_pull_v2` (delta) | 12,887 | 143 | 9,767 | 706 | |
| `sync_pull_v2` (full) | 2,412 | 262 | 7,022 | 1,149 | [F-10](#f-10) |
| `db_pre_request()` authenticated / service | 93,819 / 288,193 | 15.0 / 2.4 | 13,463 / 2,506 | small | Runs on every PostgREST call |
| `analytics_touch` | 6,256 | 111 | 14,403 | 176 | Writes 4.8 WAL records per call |
| `api_rate_hit` | 11,915 | 28 | 26,000 | 51 | [F-18](application-architecture-audit.md#f-18) |
| `loyalty_week_summary` | 5,777 | 74 | 5,833 | 155 | |

How to read this: a few hundred cached buffer hits cost single-digit milliseconds of CPU, and nothing is read from disk. Means of 15 to 433 ms, with maxima in seconds even for `set_config` (0.4 ms mean, about 0.8 s max), point at **waiting** (CPU on a small instance and/or row locks), not at plans or indexes ([F-02](#f-02)). Service-role requests are three times authenticated ones: server routes issue many small PostgREST calls.

### 4.2 N+1 and round-trip findings

| ID | Where | Pattern | Queries | Fix | Status |
|---|---|---|---|---|---|
| [F-11](#f-11) | `src/app/api/cron/month-carry/route.ts:185-252`, `src/lib/server/carryCycle.ts:65-79,150` | Users processed one at a time; `loadCycle` repeated for 3 cycles | 1 per user per day, and about 30-60 for a due user, sequential | Candidate RPC, stored cursor, concurrency 4-8, load the user context once | Proven, Potential at scale |
| F-21a | `src/lib/sms/createSmsExpense.ts:382-946`, `ownAccounts.ts:56`, `providerCascade.ts:151` | `payment_methods` read 6-9 times in one SMS booking (one hoistable inside a loop, `:371-396`) | 6-9 per SMS | Load once per request and pass it down (already deferred in `DB_SCALING_PLAN.md` §12) | Proven |
| F-21b | `src/lib/server/sendNativePush.ts:36-60` | 3 sequential reads before every push | 3 | `Promise.all` | Proven |
| F-21c | `src/lib/notifications/useNotifications.ts:92-125` | Fetch per mounted instance, and again on every `user` object change | 2 per instance | Depend on `user?.id`, route through `sharedFetch` | Proven |
| F-21d | `src/app/api/cron/ios-crashes/route.ts:33-37` | 2 RPCs per crash, and the 3-day lookback resubmits | 2 x crashes | Array RPC or cursor | Proven, low impact |
| — | `admin_user_directory` sort by expenses or activity | A correlated subquery per user before the limit | N users | See [F-13](application-architecture-audit.md#f-13) | Proven, Potential |

Not N+1 (checked): `flushDiff` (one upsert per table, fixed), the notification cron (set-based candidate RPC, bulk prefetch, concurrency 8), the loyalty cron (set-based SQL), SMS ingest (one claim insert keyed on a unique index).

### 4.3 Unbounded or truncating reads

| ID | Where | Problem | Status |
|---|---|---|---|
| [F-04](#f-04) | `src/hooks/useSubscriptionDetector.ts:44-55` | 90 days of SMS, no limit, **ascending** sort: past the PostgREST row cap it keeps the oldest rows and drops the newest | Proven. The cap value is NOT VERIFIED (the repo assumes 1000, and no `config.toml` is checked in) |
| [F-10](#f-10) | `supabase/migrations/0300_db_load_phase_a.sql:122`, `0142_sync_pull.sql:10-25`, `src/lib/supabase/remote/sync.ts:593-666`, `SupabaseFinanceSync.ts:757-762` | First and full pull returns every live row in one `jsonb_agg`. Any delta error clears the cursor and falls back to the legacy 23-table full pull | Proven; size grows with account age |
| F-22a | `src/lib/prices/fetchKeyed.ts:74-86` | Every stock holding of every user, distinct taken in JS, truncated at the row cap | Proven, Potential |
| F-22b | `src/lib/sms/remaskStores.ts:43-71` | Daily full rescan of 3 masked stores with no resume cursor inside a 55 s window; the leak-scan stamp that unlocks retention may never be earned | Proven, Potential |
| F-22c | `src/app/api/cron/data-retention/route.ts:21-28` | One unbounded `UPDATE ... RETURNING id`, used only to count | Proven, low |
| — | `usePaymentMethodDetector.ts:123-131` | `limit(300)` with no order, so the rows are arbitrary, and it fetches `raw_body` | Proven, low |
| — | `unplacedForTail.ts:36-69` | Unchunked `in(...)` id list. A URL-length failure reads as "nothing to place" (silent) | Proven, Potential |

### 4.4 Over-fetching

`select('*')` on server hot paths where few columns are used: `carryCycle.ts:73-77`, `cron/notifications/route.ts:128-136`, `devices/registry.ts:82,107,142`. `sync_table_delta` returns `to_jsonb(t)` (every column), which is acceptable because the mappers consume them. The worst single column is the avatar data URL ([F-05](application-architecture-audit.md#f-05)).

## 5. Indexing strategy (Phase 4)

What is right:
- 0 unindexed foreign keys and 0 RLS init-plan warnings; RLS uses `(select auth.uid())`.
- Composite and partial indexes match the hot predicates: `(user_id, updated_at)` for the sync probe, `(user_id, expense_date DESC)`, `(user_id, received_date) WHERE deleted_at IS NULL`, `(user_id, account_last4)`, the SMS dedup and pairing partials.
- Specialised types are used where an operator needs them: hash on `masked_body` (equality only), trigram GIN on `profiles` names (admin search), BRIN on `updated_at`.

Leads closed by live evidence: the code audit (W2a) asked for `(user_id, expense_date)`, `(user_id, received_date)` and `(user_id, account_last4)`. All three **exist** on live. The per-SMS `expenses.description ILIKE` lookup has no trigram index, but it is filtered by `user_id` first, so it scans one user's rows. That is fine until a single user holds tens of thousands of expenses.

<a id="f-14"></a>**F-14 (LOW, Database, Both). The index set is heavier than the workload.**
- Evidence: 405 indexes, index bytes above heap on most tables, 31 `unused_index` advisor notices.
- Four non-unique indexes are strict prefixes of another index with the same predicate (verified `indisunique = false`):
  - `idx_debt_payments_user` ⊂ `idx_debt_payments_user_updated`
  - `idx_expenses_live` ⊂ `idx_expenses_live_user_id`
  - `idx_income_events_user` ⊂ `idx_income_events_user_updated`
  - `idx_savings_transactions_user` ⊂ `idx_savings_transactions_user_updated`
- Risk: every index costs a write on hot sync tables.
- Why not now: "unused" rests on 10 days of stats over tables under 1.2k rows, where the planner rightly prefers seq scans.
- Action: drop the four strict-prefix indexes in one migration (Phase B). Re-check `pg_stat_user_indexes.idx_scan` after 30 or more days of real traffic before dropping any other index.
- Do not add indexes on new evidence-free grounds.

<a id="f-25"></a>**F-25 (LOW, Database, Admin). There is no index for the SMS promotion eligibility scan.**
- `check_sms_promotion_eligibility` filters `sms_parse_log` by `(sender, created_at)`, and live has no index leading with `sender`.
- The table has about 1.2k rows today, so this waits.
- Trigger: add `(sender, created_at)` when `sms_parse_log` passes about 100k rows, or when the admin promotion run takes over 2 s.

GIN, GiST and BRIN: no new specialised index is justified. JSONB columns are read whole, not searched with `@>`. The existing BRIN indexes are unused at this size, and they become useful only on append-mostly tables in the millions of rows.

## 6. Pagination (Phase 5)

Main app: no list uses `OFFSET`. The money lists (expenses, income, savings, debts) have **no server paging by design**: the whole live history syncs to the device, and the UI pages by day groups (`FlowLedger.tsx:46-65`). The cost shows up as first-pull size ([F-10](#f-10)), not as paging queries.

| List | Method | Max rows | Bounded | Concern |
|---|---|---|---|---|
| Finance history (all money tables) | Client store, full sync | All live rows | No (by design) | F-10 |
| Delta pull | `updated_at > cursor - 2 min` | All changes since the cursor | No cap | Large after a long offline stretch |
| Notifications | `limit(80)`, `created_at desc` | 80 | Yes | No next page; no `id` tie-break |
| Support tickets / thread | `limit(50)` / `limit(200)` | 50 / 200 | Yes | No next page |
| Feedback board | `limit(100)`, `votes desc` | 100 | Yes | Ties unstable |
| SMS review, own-transfer review | `limit(20)`, 30 days | 20 | Yes | The 21st item is invisible until one is resolved |
| Goal runs / net-worth snapshots | `limit(1500)` / `limit(450)` | Bounded | Yes | — |
| Admin users | `LIMIT/OFFSET` up to 1,000,000 plus full `count(*)` | 100/page | Yes | [F-13](application-architecture-audit.md#f-13) |
| Admin audit log, leads | Keyset `(created_at, id)` / `id` | 200 | Yes | Correct |
| Admin SMS log, email log | Keyset on one non-unique timestamp | 200 / 51 | Yes | Rows sharing a timestamp are skipped ([F-16](#f-16)) |
| Admin tickets, crashes | `limit(200)`, no paging | 200 | Yes | Older rows unreachable |

<a id="f-16"></a>**F-16 (LOW, Database, Both). Sorts and cursors lack a unique tie-breaker.**
- Where: `sms/logs/route.ts:39`, `emails/log/route.ts:33`, and the notifications, board and ticket orders.
- Fix: add `id` as the final sort key, and use a `(ts, id)` cursor as `leads/route.ts` already does. Effort S.

## 7. Caching from the database's point of view (Phase 7)

The full layer table is in [application report §5](application-architecture-audit.md#5-caching-strategy-phase-7). Database-relevant points:

<a id="f-03"></a>**F-03 (MEDIUM, Backend, Both). `plans` and `feature_flags` are read from the database on every call.**
- Where: `src/lib/entitlements/server.ts:7-20` (`loadEntitlements` reads the whole `plans` table) and `src/app/api/flags/route.ts:22-28` (`feature_flags` + `admin_staff` + `getUserEntitlements`, which reads `plans` + `user_entitlements`: 4 reads per call).
- Callers include `requireFeature` inside `reserveAiQuota` (`lib/server/ai/quota.ts:97`), so every paid AI, voice and receipt call pays for it.
- This breaks the `CLAUDE.md` rule "Cache what does not change per request (settings, plans, prices)".
- Evidence: Proven in code; per-call cost not separately measured.
- Fix: wrap both in the existing `cachedSetting` (`src/lib/server/platformCache.ts`, tagged `platform-settings`, 300 s). Three details:
  - `loadEntitlements` must **throw** on a read error, because `cachedSetting` only refuses to cache thrown errors. Otherwise an empty result is cached for 300 s.
  - The admin plan and flag write routes do not call `invalidatePlatformSettings()` today, so that call must be added.
  - Keep the per-user `user_entitlements` read.
- Impact: saves 1 read per paid AI call and 2 per `/api/flags` call. Effort S. Risk low (an admin plan edit takes effect after invalidation).

Redis: **not justified**. Global reference data fits the Next data cache, and per-user counters already live in Postgres.

## 8. Scalability techniques (Phase 9)

| Technique | Status | Reasoning and trigger |
|---|---|---|
| Partitioning | **NOT NEEDED AT CURRENT SCALE** | 38 MB total; the largest table is about 1.2k rows. Candidates later: `sms_parse_log`, `ai_usage_events`, `admin_audit_log`, `app_analytics_events` (time-based, with retention). Trigger: one table above about 50M rows or 20 GB, or a retention `DELETE` that runs longer than its window. |
| Read replicas | **NOT NEEDED AT CURRENT SCALE** | 100% cache hit, and the bottleneck is waiting, not read volume. Supabase offers replicas on paid compute. Trigger: sustained CPU above 70% on a right-sized instance with reads dominating `pg_stat_statements`, after F-01/F-03 are fixed. Only staleness-tolerant reads would move (admin analytics, public rates). Replicas are not HA. |
| Sharding | **NOT APPLICABLE** at foreseeable scale | One Postgres comfortably holds this per-user workload into the hundreds of thousands of users. Note: `user_id` is a natural shard key if it is ever needed. |
| HA / failover clustering | **CANNOT VERIFY** | Plan-level Supabase setting; check the dashboard. Backups and PITR status are also not visible from SQL. |
| Physical clustering (`CLUSTER`) | **NOT NEEDED** | Tiny tables; `CLUSTER` locks the table. |
| Cache clustering (Redis) | **NOT APPLICABLE** | No Redis. |
| App-server clustering | **ALREADY IMPLEMENTED CORRECTLY** | Vercel serverless scales horizontally; per-instance in-memory caches are documented as best-effort. |
| Connection pooling | **ALREADY IMPLEMENTED CORRECTLY** | PostgREST pool and Supavisor; no direct Postgres clients from Vercel; 29 of 60 connections open. Trigger to revisit: above 45 connections or pool-wait errors. |
| Compute right-sizing | **RECOMMENDED NOW (measure first)** | [F-02](#f-02). |
| Materialised views / precomputed aggregates | **ALREADY IMPLEMENTED** (as tables) | `admin_metrics_cache`, `app_analytics_daily`, `savings_month_summary`. The admin metrics refresh needs a schedule again ([F-12](application-architecture-audit.md#f-12)). |
| Background jobs | **IMPLEMENTED BUT NEEDS IMPROVEMENT** | pg_cron plus Vercel cron, all healthy. Month-carry and the masked-store sweep need cursors ([F-11](#f-11), F-22). |
| Denormalisation for reads | **NOT NEEDED** beyond what exists | Per-user tables are small. |
| Search service | **NOT NEEDED** | Admin search over 58 users. Trigger: more than 10k users with search above 300 ms; trigram on `profiles` first. |
| Vacuum / maintenance | **ALREADY IMPLEMENTED CORRECTLY** | Autovacuum ran within the last day on hot tables; dead tuples are low. |
| Statement timeouts | **IMPLEMENTED BUT NEEDS IMPROVEMENT** | Platform defaults apply. Admin heavy RPCs and bulk wipe or export set none ([F-24](application-architecture-audit.md#f-24)). |
| Slow-query observability | **IMPLEMENTED BUT NEEDS IMPROVEMENT** | `pg_stat_statements` is on, but nobody reads it on a schedule. Add a weekly top-20 review, and reset only after a recorded snapshot. |

## 9. Database security notes (Phase 10, database side)

- RLS on all 121 tables. 60 tables have RLS on with no policy: service-role-only tables, which is correct deny-by-default.
- 25 `SECURITY DEFINER` functions are callable by `authenticated` (the money-movement, loyalty and referral RPCs). These are the intended API, but each must check ownership with `auth.uid()` inside its body; that was **not re-verified** function by function. Recommended as a review item (S).
- One anon-callable definer, `referral_inviter_first_name(p_code)`, serves the invite landing page. It is intended; it returns a first name per guessable code, so it should be rate limited.
- Leaked-password protection is disabled (Supabase Auth setting); turning it on is an owner action.
- `pg_net` sits in `public` and is accepted (QA-101).

## 10. Findings in this report

Each entry gives severity, area, affected app, location, evidence, fix, effort and when to act. The remaining IDs live in the [application report](application-architecture-audit.md#8-finding-register).

<a id="f-01"></a>
### F-01 HIGH · Database · Main app: `entitlements_state` is a read that writes, and it is the slowest statement
- **Location:** the function in the live DB (latest definition in `supabase/migrations/`), called from `src/app/api/entitlements/me/route.ts:75`, refreshed by `useBillingStore.refresh()` (`src/lib/billing/billingStore.ts:62-78`) from about 12 call sites: sign-in (`BillingHost.tsx:36`), the Pro, Usage, Rewards, Invite and Founders pages, limit-denied, balance view, Sparks packs, and purchase polling (`refreshUntilStore`, 6 x 2 s).
- **Existing:** `VOLATILE SECURITY DEFINER` (latest definition `0309`). It first runs `rewards_touch(p_user)` (last redefined in `0332:205`: referral evaluation, banked promo, `loyalty_refresh_tier`) and `referral_ensure_code(p_user)` (insert if missing), then about 20 sub-selects into one JSON. `loyalty_refresh_tier` (`0307:65`) takes `SELECT ... FOR UPDATE` on the user's `loyalty_accounts` row on **every** call.
- **Evidence:** Measured: 12,664 calls, mean 433 ms, max 41 s, 610 cached buffers per call, 1.4 WAL records per call. Proven: writes, and a row lock, on the read path. The cause of the 41 s tail is NOT VERIFIED (lock waits were not sampled, and the whole instance shows long tails, F-02), but concurrent `/me` calls for one user must serialise on that row lock. Severity rests on the proven lock plus the measured mean; the sample is QA-dominated.
- **Hidden dependencies the fix must keep:** `me/route.ts` runs the state call first on purpose, because `promo_apply_banked` can start banked Pro weeks that the plan resolution must then see. `0332` also uses app-open as the retry point for `awaiting_native` referrals.
- **Risk:** every Pro or Rewards screen waits about 0.4 s or more. Concurrent calls for one user can serialise on the same loyalty and referral rows. Upkeep runs about 22 times per user per day instead of once.
- **Fix:**
  - Move the upkeep out of the read: run `rewards_touch` from the daily `rewards_daily` cron and from the events that change it (purchase webhook, referral redeem, week check, native first-launch for `awaiting_native` referrals).
  - Apply banked Pro weeks when they are banked or when the previous period ends, not on read; or keep a cheap guarded call (`promo_apply_banked` only when a banked grant exists, with no row lock otherwise) so the plan resolution still sees them.
  - Make `loyalty_refresh_tier` lock only when the tier actually changes (compare first, then `UPDATE ... WHERE tier_key <> new`).
  - Create the referral code at sign-up.
  - Make `entitlements_state` a pure `STABLE` read.
  - Optionally keep a 30-60 s per-user memo on the route.
- **Impact:** the slowest statement should fall to the 20-70 ms range of comparable reads (estimate, to be measured), and it removes lock contention.
- **Complexity:** M. **Prerequisites:** a test that pins the JSON contract (`docs/launch/PRO_REWARDS_CONTRACT.md`); a deep-technical change under the owner's testing rule. **Risk:** missed upkeep (a tier not refreshed) if an event path is forgotten; keep the daily sweep as a safety net. **Act:** now (Phase A).

<a id="f-02"></a>
### F-02 MEDIUM (provisional, needs measurement) · Infrastructure · Both: instance-wide tail latency on a tiny, fully cached database
- **Evidence:** Measured: cached point reads with means of 2-30 ms show maxima of 2.5-26 s (`db_pre_request` 13.5 s, `api_rate_hit` 26 s, `second_factor_verified` 9.6 s), and even `set_config` reaches about 0.8 s. Standard deviation exceeds the mean everywhere. The configuration matches the smallest compute class. The window is QA-dominated and the maxima cannot be dated.
- **Reading:** this looks like CPU starvation or steal, or lock waits, on the smallest instance. It is NOT VERIFIED.
- **Action:**
  1. Open Supabase dashboard, Reports, Database: CPU, memory and IO for 2026-11-16 to 11-26. If CPU regularly saturates during QA runs, move one compute tier up (an owner billing decision, reversible).
  2. Re-measure `pg_stat_statements` over a week of real use after F-01 and F-03, with a recorded snapshot before any reset.
- **Complexity:** S (check), S (resize). **Act:** measure now; resize only on CPU evidence.

<a id="f-04"></a>
### F-04 MEDIUM · Database · Main app: the subscription detector silently drops the newest SMS past the row cap
- **Location:** `src/hooks/useSubscriptionDetector.ts:44-55` (lookback at `:17`).
- **Evidence:** Proven: `.order('received_at', { ascending: true })` with no `.limit()`. The code's own comment at `:53` needs the last row to be the latest sighting. The cap value is NOT VERIFIED (the code base assumes 1000).
- **Risk:** wrong subscription detection for a heavy card user (more than about 1000 purchases in 90 days). It is a correctness bug, not a speed one.
- **Fix (primary):** one RPC grouping by `merchant_normalized` that returns counts and the last date (tens of rows instead of up to 1000). A quick alternative is to sort descending with an explicit limit and **reverse in memory**, since the downstream code assumes the last row is the latest. **Complexity:** S. **Act:** now.

<a id="f-10"></a>
### F-10 MEDIUM · Database · Main app: full pulls are unbounded, and any delta error demotes the device to them
- **Location:** `supabase/migrations/0300_db_load_phase_a.sql:122` (`sync_pull_v2`), `0142_sync_pull.sql:10-25` (`sync_table_delta`), `src/lib/supabase/remote/delta.ts:112-123`, `sync.ts:593-666`, `SupabaseFinanceSync.ts:757-762`.
- **Evidence:** Measured: the full `sync_pull_v2` path ran 2,412 times (mean 262 ms, 1,149 buffers). Proven: one `jsonb_agg` per table with no `LIMIT`. Also proven: `sync_pull_v2` is `VOLATILE` and runs `sms_run_my_pending_discards()` on every pull (`0300:128`), so the hottest read also writes. That is cheap while nothing is pending, but it belongs in a cron or the SMS path rather than on every pull. The `catch` in `pullAndMerge` calls `clearSyncCursors()` and falls back to `runLegacyFullSync`, so the next boot is heavy too.
- **Risk:** cost grows with account age. One bad row or a network error turns every later boot into a full pull.
- **Fix:**
  - (a) Now: retry transient delta errors with backoff, keep the cursor, and park a row the mapper cannot read instead of failing the batch.
  - (b) Later: a keyset-paged first pull per table.
  - (c) Filter the always-returned budget tables by `updated_at`.
- **Complexity:** (a) S-M, (b) H. **Act:** (a) now, (b) when the p95 full-pull payload exceeds about 2 MB or takes more than 3 s on a mid-range Android.

<a id="f-11"></a>
### F-11 MEDIUM · Backend · Main app (cron): month-carry processes users one at a time with no stored cursor
- **Location:** `src/app/api/cron/month-carry/route.ts:185-252`, `src/lib/server/carryCycle.ts:65-79,150`.
- **Evidence:** Proven: 1 probe per user per day, about 30-60 queries per due user in a few sequential waves (`loadCycle` runs its 7 reads in one `Promise.all`), a 50 s budget, and a cursor only in `?after=`, which Vercel cron never passes.
- **Risk:** on a month boundary with a few hundred due users, runs end partial. A carried user gets a `savings_month_summary` row and is cheap the next day, so the carry spreads over several days rather than restarting from nothing. Idempotency holds, so the result is delay, not money errors.
- **Fix:** a due-user candidate RPC (same shape as `notification_due_users`), a cursor in `platform_settings`, concurrency 4-8, and `loadCycle` split into a per-user context plus per-month rows run in parallel (a set-based `cycle_carry_inputs` RPC is better still). **Complexity:** M-H. **Act:** before the user count reaches the low hundreds.

<a id="f-23"></a>
### F-23 LOW · Database · Admin: `admin_audit_log` has no retention, and its append-only trigger blocks a purge
- **Evidence:** Measured: 379 rows, 280 kB. Proven: there is no purge statement in `0141_retention.sql`, and the trigger in `0123` raises on `DELETE`.
- **Fix:** decide a retention period (a compliance decision for the owner). When needed, use monthly partitions and detach old ones, which keeps the append-only rule. **Act:** later; trigger above 1M rows or 1 GB.

F-21 (repeated reads) and F-22 (cron sweeps) are covered by the tables in §4.2 and §4.3. Both are LOW, proven, and grouped in the roadmap.

## 11. Skill references used

Installed for this repo: `supabase-postgres-best-practices` (see the [skills report](skills-evaluation-and-installation.md)). Where its rules informed a finding, and where they did not apply:

| Finding | Skill rule | Agreement |
|---|---|---|
| F-14 | `query-missing-indexes`, `query-composite-indexes`, `schema-foreign-key-indexes` | Agrees that FK indexes and composite order matter. The live data shows the opposite problem (over-indexing), so no new indexes are proposed. |
| F-16, F-13 | `data-pagination` | Agrees: keyset with every sort column. |
| F-21 | `data-n-plus-one` | Agrees: batch with `any($1)` or load once. |
| F-01 | `lock-short-transactions` | Agrees: keep writes off hot read paths. |
| §8 partitioning | `schema-partitioning` (its rule of thumb is above 100M rows) | Agrees: not now. |
| §9 | `security-rls-performance` (`(select auth.uid())`, definer functions check `auth.uid()`) | Live advisor shows 0 init-plan warnings; definer ownership checks are a review item. |
| Not followed | `monitor-explain-analyze` | Conflicts with the project rule (plain `EXPLAIN` only on live). |
| Not followed | `conn-*` (`ALTER SYSTEM`, `pgbouncer.ini`) | Not available on managed Supabase; Supavisor is the pooler. |
| Not followed | `monitor-pg-stat-statements` (`create extension`, `pg_stat_statements_reset()`) | Already installed; a reset would destroy the only evidence. |
| Not followed | `schema-primary-keys` (bigint identity or UUIDv7) | Client-minted UUIDs are required by offline sync. |

Official sources cross-checked: Supabase docs for the database linter lints 0001/0005/0028/0029 (linked from `get_advisors`), and the Postgres 17 docs on index-only scans and partitioning.
