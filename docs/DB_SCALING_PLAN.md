# Database scalability and reliability plan

Status: proposal, nothing in this document has been applied. Written 2026-10-20 after a read-only audit of the live
Supabase project (`ydihurtbcnoflhormgzi`), the migrations, and the app code (client sync, server routes, admin,
SMS pipeline, crons, email).

Evidence tags: **[DB]** measured on the live database today. **[Code]** read in this repository. **[Inferred]** a
conclusion drawn from the above, not directly measured. Anything not tagged is a recommendation.

---

## 1. Summary

1. **The database is tiny and the instance is the smallest one.** 27 MB, 44 auth users, 69 public tables, 213 indexes
   [DB]. The compute is `t4g.nano` (shown in the dashboard) with `max_connections = 60`, `shared_buffers = 224 MB`,
   `work_mem = 2 MB` [DB]. Memory is not the constraint: cache hit rate is ~100% [DB]. The constraint is disk IO and
   the number of round trips.
2. **"Unhealthy" is a symptom of IO starvation plus a restart loop, not of data volume** [Inferred]. Evidence:
   PostgREST rebuilt its schema cache ~2,580 times and Realtime created its replication slot ~506 times since the
   project was created [DB]. Each PostgREST schema load runs a query that averages **944 ms** (`pg_timezone_names`)
   plus a 206 ms catalog query [DB]. Migration `0112` already records an earlier "PostgREST schema-cache retry
   loop" slowdown on 2026-10-17 [Code]. A saturated disk makes these loads slower, slower loads fail health checks,
   and failed checks restart services, which load again.
3. **The application generates far more database work than 44 users justify.** The biggest sources, in order:
   - 22 unbounded `select *` queries on every app open and resume (no cursor, no pagination) [Code].
   - One analytics insert request per 45 s per open tab, ~80 per hour per active user [Code]. 25.9K insert requests so
     far, 20% of all authenticated API requests [DB].
   - One SMS costs ~12-16 sequential round trips, 5-6 writes to one wide row, 15-40 keyword-counter RPCs and
     3-6 follow-up reads on the client [Code].
   - Realtime change feed on `sms_parse_log`: 1.47M polling calls, 40% of all database time over the project's
     lifetime [DB]; 14 indexes on that table [DB].
4. **Corrections to what I told you earlier** (see section 11): the 51% / 40% Realtime figure is a 211-day lifetime
   total, not the recent spike; "51 unused indexes" is meaningless at 27 MB and I withdraw the "drop them" advice;
   RLS is already init-plan optimised (0 of 114 policies use a bare `auth.uid()`) [DB].
5. **The recent spike is not yet attributed.** Lifetime counters cannot show it. Phase 0 starts with measurement.
6. **Direction:** stop doing full pulls and per-event writes. Move to delta sync with cursors, a nudge channel
   (Broadcast) instead of Postgres Changes, one atomic database function per SMS, queue-backed background work,
   pre-aggregated admin metrics, and scheduled retention. Upsize compute temporarily to break the restart loop, but
   treat that as a bridge, not the fix.

---

## 2. Why the database keeps becoming unhealthy

| Link in the chain | Evidence | Confidence |
|---|---|---|
| Disk IO at 93% (compute 93%, CPU 57%, RAM 49%) | Infrastructure page screenshot | High (observed) |
| Cache hit ~100%, WAL only 1.1 GB in 8 months | `pg_stat_database`, `pg_stat_wal` [DB] | High |
| Writes are small but constant, on a tiny hot set (full-page images after every 5-minute checkpoint) | 60,757 timed checkpoints; `wal_fpi` 208K [DB] | Medium |
| 785 GB of temp-file writes since 2026-02-12, 324K temp files | `pg_stat_database` [DB]. Only ~1.8 GB is attributable to tracked statements (Studio / pg-meta introspection, 191 calls, 1.7 GB) | **Unexplained**, must be traced |
| PostgREST schema-cache reload ~2,580x, ~1.2 s of IO each | `pg_stat_statements` [DB] | High |
| Realtime restart loop (506 slot creations, 600 subscription resets) | `pg_stat_statements` [DB] | High |
| Each DDL (migration) triggers a PostgREST schema reload | PostgREST behaviour; we ran several migrations today | Medium |
| Admin and dashboard introspection adds load | `count_estimate`, `with f as (...)` queries from Studio | Medium |

What I could not determine: what changed on 2026-10-20 to push IO to 93%. `pg_stat_statements` has not been reset since
2026-03-22, so it averages 211 days. **Phase 0, step 1 is to take a snapshot and start a clean measurement window.**

---

## 3. System map (as built)

- **Clients** (web, iOS, Android via Capacitor) hold a full local copy in a Zustand store (persisted to localStorage)
  and talk to Supabase PostgREST directly with the user's JWT and RLS [Code].
- **Sync:** `pullAll` does 22 parallel `select *` (profiles, user_settings, 20 tables), filtered `deleted_at IS NULL`,
  no limit, no cursor. It runs on mount, on every visibility change (10 s throttle only), on app resume, on network
  reconnect and on pull-to-refresh. Writes are row-level diffs (500 ms debounce), one upsert per table, no batching
  cap, no retry queue [Code].
- **Server routes** (Next.js on Vercel, region sin1) use the service-role key over HTTPS PostgREST for everything;
  there is no pooled direct Postgres connection [Code].
- **Auth:** middleware calls `auth.getUser()` (a network call) on every request including `/api/*`, and routes call it
  again [Code].
- **SMS:** device captures SMS, POSTs to `/api/sms/parse` (1,585 lines, one synchronous request), which dedupes,
  matches the template funnel (curated, curated DB, learned template, Gemini), creates the transaction, writes the
  log row several times, pushes a notification, then learns in `after()`. The app also subscribes to Postgres
  Changes on `sms_parse_log` to render the result and POSTs an ack per row [Code].
- **Admin portal:** every request re-runs auth, staff, role, credentials and session lookups; analytics come from
  uncached SQL functions that scan big tables [Code].
- **Background:** two Vercel crons (notifications 06:00 UTC, prices 03:00 UTC); retention exists only for analytics
  and AI reservations and is triggered by the prices cron; `pg_cron` is not installed [Code][DB].

---

## 4. Findings

Ranked by contribution to load now and growth risk at 10K+ users. "Fix" is detailed in sections 6-7.

### Sync and client reads
- **F1. Full-history `select *` x22 on every open/resume** [Code: `src/lib/supabase/remote/sync.ts:329-358`,
  `SupabaseFinanceSync.ts:171,339-349,375-402`]. Cost grows with each user's lifetime rows; at 10K users opening the
  app 5-10 times a day that is 1.1-2.2M queries a day [Inferred]. Fix: delta sync (6.1).
- **F2. Eight page hydrate hooks duplicate the same unbounded selects on a guard miss** [Code]. Fix: remove them.
- **F3. Echo writes:** rows ingested from Realtime or push are not re-baselined, so the next flush upserts them back;
  a partial failure re-sends every table that already succeeded; no batch-size cap [Code: `AppShell.tsx:163-198`,
  `SupabaseFinanceSync.ts:253-257`, `sync.ts:51-56`]. Fix: 6.1.
- **F4. Redundant writes become real writes:** `set_updated_at()` runs on every UPDATE and always changes
  `updated_at`, so an identical upsert still writes a new row version and fires the SMS-signal trigger (3 extra
  SELECTs per SMS-linked row) [DB: triggers on `expenses`, `income_events`]. `expenses` shows 927 inserts vs
  36,399 updates [DB] (90% HOT, so cheaper, but still WAL and fsync). Fix: `WHEN (OLD.* IS DISTINCT FROM NEW.*)` on
  triggers, `suppress_redundant_updates_trigger`.
- **F5. `useAssetPrices` fan-out:** K mounted instances each add their own resume listener and each run an unfiltered
  whole-table select, unthrottled [Code]. Fix: one module-level subscriber, in-flight de-dupe, CDN-cached read.
- **F6. Unbounded or N+1 SMS reads on the client:** `usePaymentMethodDetector` (raw SMS bodies, no limit),
  `useSubscriptionDetector` (90 days, no limit, two components), `useSmsCounterparty` (one query per row),
  `useGoalAllocationRuns` (no period filter, many consumers) [Code].
- **F7. Net-worth snapshot upsert + select on every change** and two extra `auth.getUser()` per mount in
  `useSmsTracking` [Code].

### Analytics and telemetry
- **F8. Heartbeat insert per 45 s per open tab, plus a row per foreground and per session** [Code:
  `AnalyticsHeartbeat.tsx`]. 25.9K inserts and 20.8K deletes in `app_analytics_events` for 44 users [DB]. The
  `pathname` dependency re-creates the interval on every route change. Estimate at 10K daily users (20 active
  minutes): 270-400K single-row inserts per day [Inferred, from the agent's model]. The old rate-limit policy is
  already gone (only `analytics_insert_own` exists) [DB].

### SMS
- **F9. Synchronous chain of ~12-16 round trips** before the response on a curated hit, including a fire-and-forget
  "self-heal" update that Vercel may cut off [Code: `sms/parse/route.ts`].
- **F10. 5-6 writes to one `sms_parse_log` row per SMS** (insert, promote, `sms_mark_acked`, `sms_mark_pushed`,
  learn outcome, self-heal) [Code]; 1,588 inserts vs 7,258 updates [DB]. The table has 14 indexes [DB], including
  a duplicate of the unique `(user_id, sms_hash)` key (`sms_parse_log_hash_idx` and `sms_parse_log_user_hash_idx`),
  and `idx_sms_parse_log_status (status, received_at)` indexes a column that changes on every status transition,
  which defeats HOT updates [DB]. Every non-HOT update touches all 14.
- **F11. Keyword pooling: one RPC per distinct word, sequential** (15-40 per SMS) into one global table
  [Code: `route.ts:983-995`]. `sms_keyword_pool` shows 822 inserts vs 7,355 updates; `sms_sender_pool` /
  `sms_sender_currency` ~740 updates for ~52 rows each [DB]: hot rows rewritten per SMS.
- **F12. Template bookkeeping per match:** three queries (`recordTemplateUser`) on every match, plus counters
  [Code]. **F13. Learn path:** up to 3 Gemini calls at 18 s inside the request budget, then a global promotion scan
  per learn [Code]. **F14. 10% of SMS run a full-table aggregate** (`detect_zero_variance_templates`:
  `count(distinct raw_body)` over the whole log) [Code].
- **F15. Realtime Postgres Changes on `sms_parse_log`**, unfiltered, 2 events per SMS, then 1-3 `select *` and an
  ack POST per event; up to 50 acks per mount in a loop [Code]. This is the only publication member [DB].

### Admin and ops
- **F16. Guard overhead on every admin request:** two auth network calls plus staff, role, credentials and session
  lookups (4-5 sequential round trips) [Code]. Opening the main app also calls the admin status endpoint for every
  user (`useStaffAccess`) [Code].
- **F17. Admin analytics scan big tables uncached:** `admin_overview` (4x `count(*)` on `auth.users`, 2x on
  `expenses`, 3x `count(distinct)` on events), `admin_feature_adoption` (`count(distinct user_id)` over 10 tables,
  no time bound), `admin_retention` (measured at 17 s on 50K users earlier), `admin_user_directory` (`ILIKE '%q%'`
  with no trigram index, a full re-count per page, correlated subqueries before paging) [Code]. Overview and
  analytics tabs run three of the same RPCs twice.
- **F18. Unbounded reads aggregated in JS** (`plans`, `loyalty`, `support tickets`, `push-health`, SMS templates
  list) [Code].
- **F19. Email system (mine):** `ensureSeeded` runs on every cold start, `email_log` has no retention and stores
  `to_email`, the log API issues 7 queries per page, publish is delete-then-promote (a short window with no
  published row) [Code].

### Platform
- **F20. No retention for most growing tables** (`sms_parse_log` with raw bodies, `notifications`, `ai_usage_events`,
  `ai_chats`, `email_log`, `admin_sessions`, learning tables); `housekeeping()` is a single transaction and runs
  only if the prices cron finishes [Code].
- **F21. AI quota costs ~4 writes and 6-10 reads per AI call** (advisory lock, window scans over two tables) and
  tool-loop hops repeat it; `ai_usage_events` is never pruned [Code]. `/api/ai` keeps its rate limiter in
  per-instance memory and `aiRuntimeConfig` reads a file on every request [Code].
- **F22. Cron fan-out is a sequential per-user loop** capped by a 60 s function limit with no cursor (about 80 users
  per run at current round-trip times) [Code]. `month-carry` does a non-atomic read-modify-write on balances and
  must be fixed before it is ever scheduled [Code].
- **F23. Price refresh debounce can be defeated** by any permanently stale row (currently all 21 rows are fresh)
  [Code][DB]. Every client reads the table directly instead of a CDN-cached route.
- **F24. API surface and security hygiene:** 43 SECURITY DEFINER functions in the exposed `public` schema; the
  advisor flags 4 callable by `anon` (including trigger functions and `rls_auto_enable`) and 13 by `authenticated`;
  leaked-password protection is off; one function has a mutable `search_path` [DB advisor]. A large exposed schema
  also makes every PostgREST schema load heavier.

Not findings (checked): RLS init-plan wrapping is done [DB]; foreign-key index gaps are minor (11, mostly admin
tables) [DB advisor]; WAL volume is small [DB]; the 29 "unused indexes" are an artefact of a tiny dataset [DB].

---

## 5. Target architecture and principles

1. **Never poll, never full-pull.** Clients ask "what changed since cursor N" and are told "something changed"
   by a cheap channel.
2. **One round trip per user action** on the server. Multi-step server logic lives in one SQL function (atomic,
   idempotent), not in a chain of HTTPS calls.
3. **Append-only for logs, aggregates for dashboards.** Logs are inserted once and never updated; dashboards read
   pre-aggregated tables refreshed on a schedule.
4. **Everything unbounded has retention and, if large, partitions** (drop a partition instead of deleting rows).
5. **Work that is not user-visible goes through a queue** with batching and idempotency.
6. **Small exposed surface:** internal functions live in a non-exposed schema; the public API schema holds only what
   clients call.
7. **Measure before and after** (pg_stat_statements windows, IO budget, p95 latencies, alerts).

Industry reference points: delta sync with server cursors and tombstones (the model behind PowerSync, Replicache,
ElectricSQL and most mobile finance apps); Broadcast or push instead of change-feed subscriptions at scale
(Supabase's own guidance); queue-based job processing (pgmq, SQS-style); partitioned, time-bounded event tables
(pg_partman); materialised or cached admin metrics; statement and idle timeouts on application roles; load testing
before launches.

---

## 6. Domain designs

### 6.1 Sync (the biggest read and write lever)
- **Pull:** one RPC `sync_pull(cursors jsonb)` returning, per table, rows with `updated_at > cursor` **including
  tombstones** (`deleted_at` set), plus the new cursor. Index `(user_id, updated_at)` per synced table. First install
  gets the active window (current and previous budget cycle plus open debts, goals, subscriptions, savings) and pages
  older history on demand.
- **Triggers for a pull:** app open (always, but it is now a few KB), a nudge from the channel, pull-to-refresh, and
  resume only after a 5-minute staleness threshold.
- **Push:** keep row-level diffing, but chunk to 200-500 rows, rebaseline after server-sourced writes, track success
  per table, bounded retry with backoff, and a persisted dirty set so offline edits survive a restart. Optionally a
  `sync_push(batch, client_mutation_id)` RPC for atomic multi-table writes with idempotency.
- **Server-side:** triggers skip no-op updates; `updated_at` stays server-assigned.
- **Cross-device deletes** now work (they currently don't, because the pull hides tombstones) [Code].

### 6.2 Instant updates without Postgres Changes
- A private Broadcast channel per user, `user:{id}`. The server sends a tiny message after relevant writes:
  `{table, id, cursor}`. Clients pull the delta (or render from the payload for SMS). This one channel makes SMS feel
  instant **and** syncs other devices instantly.
- Background: the existing push notification carries the parsed transaction in its data payload.
- Safety net: delta pull on open/resume covers any missed Broadcast (it is best-effort, at-most-once).
- Then remove `sms_parse_log` from the Realtime publication.
- Authorisation: a policy on `realtime.messages` checked once at join, not per message.

### 6.3 SMS ingest v2 (accuracy unchanged, plumbing replaced)
1. `sms_ingest(user_id, sms_hash, sender, redacted_body, ...)` **one RPC**: dedupe via `INSERT ... ON CONFLICT DO
   NOTHING RETURNING`, load the user's context bundle (payment methods, base currency, language, sender currency,
   subscription brands, push tokens) in the same call.
2. Parsing stays in application code (curated patterns, cached templates in memory, Gemini only on a miss).
3. `sms_commit(...)` **one RPC** writes the outcome atomically: log result, transaction, pairing, notification row.
   Status becomes timestamps written once; ack/push result move to a narrow side table. Target: 3 writes per SMS
   instead of 12-20.
4. After commit: push and Broadcast immediately; **everything else is enqueued** (pgmq) and drained by a worker:
   keyword and sender counters (batched, one UPSERT per minute per key), template-user bookkeeping, learning,
   promotion, adjudication. Aggregates run on a schedule over a bounded window, with per-template running stats
   instead of full-table `count(distinct)`.
5. `sms_parse_log`: partition by month, null out `raw_body` after 30-90 days, remove the duplicate and HOT-breaking
   indexes, dedupe via a separate small `sms_dedupe(user_id, sms_hash)` table so partitioning does not break the
   unique key.
6. Quality gates stay and get stronger: nightly replay of an anonymised SMS corpus gates template promotion; per-bank
   accuracy and p95 latency shown in the admin SMS view.
7. Optional later: ship approved templates to the app and parse on device when the app is running (Android
   background parsing still needs the server).

Latency targets (to be measured): template hit p50 < 400 ms, p95 < 1.2 s from device to push; AI path unchanged
(3-8 s, inherent), with an immediate local "processing" placeholder.

### 6.4 Analytics
Replace per-event rows with a per-user-per-day counter: an RPC `analytics_touch(seconds, path)` that updates one row
(HOT, tiny), called at most every 2-5 minutes and on hide, via a batching buffer. Keep session counts and path counts
as small jsonb. Raw events, if any are still wanted, are short-lived (14 days) and partitioned. Existing
`app_analytics_daily` becomes the source of truth for the admin portal.

### 6.5 Admin portal
- **Guard:** verify the JWT locally (`getClaims`, cached JWKS) and only call `getUser` for sensitive actions; skip
  middleware auth for `/api/*` and webhooks; cache the staff + role + credentials triple per user for 15-30 s and
  invalidate on staff/role change; a signed short-lived session token instead of a DB lookup; one RPC
  `admin_guard()` if any lookup remains.
- **Staff flag in the JWT** (custom access-token hook) so ordinary users never call the admin status endpoint.
- **Metrics:** `admin_metrics_cache` table refreshed every 5-15 min by `pg_cron`, driven from `app_analytics_daily`;
  approximate counts (`reltuples`) for totals; overview and analytics share one request.
- **Directory:** keyset pagination, estimated totals, `pg_trgm` GIN indexes on searched columns, a maintained
  `last_active_at` and `expense_count` instead of correlated subqueries.
- **Unbounded reads** become `GROUP BY` RPCs; client gets a TTL cache with in-flight de-dupe.
- **Audit log:** partition `admin_audit_log` by month now (the immutability trigger blocks deletes, so partition
  detach is the only retention path); prune `admin_sessions`.

### 6.6 AI quota, notifications, crons, prices, email
- **AI quota:** cache plan and limits (60 s), rolling per-user counters instead of 5h/24h/7d window scans, no
  reserve/settle on tool hops, prune and roll up `ai_usage_events`, move rate limiting and runtime config out of
  memory and files into `platform_settings` or a shared store.
- **Notifications cron:** a set-based SQL function returns only users with something due; the cron enqueues batches
  of ~50 users with a cursor; inserts are batched with `ON CONFLICT DO NOTHING RETURNING` and push only for new
  rows; partial index on unread; 60-90 day retention; unread count from a count query.
- **month-carry:** atomic per-user RPC with an idempotency key before it is ever scheduled.
- **Prices:** debounce on a "last attempt" row in `platform_settings`, rate-limit the public refresh endpoint,
  serve reads from a CDN-cached route, `select distinct` via RPC for held tickers.
- **Email:** seed in a migration not at boot; retention and monthly partition for `email_log`; one grouped count
  query; pass locale in; make publish atomic with one RPC.

### 6.7 Platform and operations
- **Roles and timeouts:** `statement_timeout` 8-10 s for `anon`/`authenticated`, `idle_in_transaction_session_timeout`
  30 s (current: 120 s and off) [DB].
- **Exposed schema:** move internal SECURITY DEFINER and trigger functions to a private schema, or revoke EXECUTE
  from `anon`/`authenticated`; pin `search_path`; enable leaked-password protection.
- **DDL discipline:** batch migrations, run them off-peak, use expand/contract, because each DDL reloads PostgREST.
- **Pooling:** keep PostgREST for simple CRUD; any server path that must run several statements uses one SQL function
  or a Supavisor transaction-mode connection.
- **Observability:** weekly `pg_stat_statements` snapshot to a table, log drain, alerts on IO budget, CPU, connections
  and PostgREST/Realtime restarts, a runbook for "unhealthy".
- **Extensions:** `pg_cron` (schedules), `pgmq` (queues), `pg_trgm` (search), `pg_partman` (partitions) are all
  available on Supabase.

---

## 7. Roadmap

Each phase is independently shippable, has a metric, and keeps old app builds working (expand/contract; old
endpoints and the Realtime path stay until the new client version dominates).

| Phase | Scope | Effort | Risk | User-visible effect |
|---|---|---|---|---|
| **P0 Stabilise and measure** (this week) | Snapshot then reset `pg_stat_statements`; set up alerts/log drain; **temporarily upsize compute** to break the restart loop; freeze DDL at peak; role timeouts; revoke anon/authenticated EXECUTE on internal functions; leaked-password protection; trace the 785 GB temp-file writes. Quick code wins: batch analytics, heartbeat interval fix, `sms-live` user filter, single price listener, gate `useStaffAccess`, 5-min resume staleness | S | Low. Compute change = brief restart | None. App and admin should feel faster once IO recovers |
| **P1 Cut write amplification** (1-2 wk) | SMS: batch keyword RPC, single `recordTemplateUser`, fold ack + push into promote, stop client ack POST, drop duplicate/HOT-breaking indexes, schedule sweeps. Triggers skip no-ops. Analytics -> daily counter. Client: rebaseline echo writes, chunking, per-table success. Atomic email publish | M | Low-Med (SMS regression tests required) | None. Slightly faster SMS |
| **P2 Delta sync + nudge channel** (2-4 wk) | `sync_pull` with cursors and tombstones, indexes, staleness gate, Broadcast channel, push payload carries tx, drop Realtime publication after adoption, remove hydrate hooks | L | Med (sync correctness; needs a client release) | Faster open/resume; SMS stays instant; cross-device deletes start working |
| **P3 SMS ingest v2** (3-5 wk) | `sms_ingest` + `sms_commit` RPCs, context bundle, pgmq workers, batched counters, learning and promotion off the request path, partition `sms_parse_log`, `sms_dedupe`, retention of raw bodies, accuracy gates and dashboard | L | Med-High (core flow; ship behind a flag, shadow-run both paths) | Same or faster; "processing" placeholder on AI parses |
| **P4 Admin and ops plane** (2 wk) | Guard cache/claims, JWT staff flag, metrics cache + `pg_cron`, directory keyset + trigram, GROUP BY RPCs, TTL client cache, partition audit log, email log retention | M | Low | Portal opens and switches in well under a second |
| **P5 Scale hardening** (ongoing) | Retention jobs for every unbounded table, AI quota rework, cron fan-out via queue, atomic month-carry, price debounce + CDN, shared rate limiter, k6 load tests (1K and 10K virtual users, real mix), read replica and Supavisor when thresholds hit, PITR/backup restore drill | M-L | Low-Med | None |

### Why this order
P0 stops the bleeding and gives a clean baseline. P1 is cheap and removes most write IO without any contract change.
P2 and P3 change contracts and need a client release, so they come after the baseline exists and each is measured.
P4 is independent and can run in parallel. P5 prevents regressions as users grow.

---

## 8. Capacity model and scaling triggers (order of magnitude, to be refined by P0 data)

| Active users | Today's pattern | After P1-P3 | Compute guidance (verify on pricing page) |
|---|---|---|---|
| 44 (now) | Saturates Nano | Idle on Micro/Small | Small during P0-P3 |
| 1K DAU | ~25-40K analytics inserts and ~100K full-pull queries/day | < 1K analytics writes, deltas only | Small |
| 10K DAU | 270-400K analytics inserts, 1-2M pull queries, ~1-3M SMS DB operations/day | analytics ~10K, pulls cheap, ~3 writes/SMS | Medium, add read replica for admin/reporting |
| 100K DAU | Not viable | Requires partitioned logs, queue workers on their own compute, replica(s), connection pooling | Large+, evaluate dedicated workers |

Scaling triggers (alert when any holds for a sustained window): IO budget > 70%, p95 PostgREST latency > 400 ms,
connections > 70% of max, queue lag > 60 s, replication or Realtime restarts > 0 per hour.

---

## 9. What I would deliberately not do
- **Not just buy a bigger instance.** It hides the write amplification and the restart loop and costs more every
  month. It is part of P0 only as a bridge.
- **Not drop the "unused" indexes.** At 27 MB they cost nothing; at 100x data they will be needed. Only the
  specific duplicates and the HOT-breaking status index on `sms_parse_log` are worth changing.
- **Not adopt a second database or a new sync vendor now.** Postgres with cursors, a queue extension and partitioning
  comfortably covers the next two orders of magnitude. Revisit PowerSync/Electric only if offline-first needs grow.
- **Not add Redis yet.** Use CDN caching, in-memory caches with TTL and `pg_cron` aggregates first; add a shared
  store only for rate limiting if measurement says so.

---

## 10. Decisions needed from you
1. Approve a **temporary compute upsize** in P0 (and which tier), and a short maintenance window for the restart.
2. Confirm an **SMS raw-body retention** period (30, 60 or 90 days) and that bodies are redacted before storage.
3. Confirm **analytics fidelity**: are per-session and per-path daily counters enough, or do you need raw events
   for product analysis (then 14-day raw retention in a partitioned table)?
4. **Minimum app version / update policy** to retire the old Realtime path and old sync (P2).
5. **Queue technology** for P3/P5: `pgmq` in Postgres (recommended) or an external queue.
6. **Tombstone retention** for cross-device deletes (suggest 90 days).

---

## 11. Verified, unverified and corrections

**Verified against the live database today:** table and index inventory, row and WAL statistics, policy shape
(0 bare `auth.uid()`), trigger list, publication membership (`sms_parse_log` only), advisor lints, settings,
`pg_stat_statements` leaders (lifetime), the absence of the old analytics rate-limit policy, the freshness of
`asset_prices`.

**Not verified:** the cause of the 2026-10-20 spike; the source of the 785 GB temp-file writes; per-user row-count
growth; whether `NotificationInbox` mounts app-wide; the production cron cadence beyond `vercel.json`; the exact IO
allowance per compute tier; the SMS parse route's behaviour beyond the sections the audit read.

**Corrections to my earlier messages:**
- "Realtime is 51% of database time" was a **lifetime** share (211 days), not the recent spike. It remains the
  largest single consumer, but it does not by itself explain what changed this week.
- "51 unused indexes, drop them" is withdrawn (see section 9).
- "Admin queries are not the cause" stands for database load, but the admin portal's slowness is real and comes
  from round-trip count (section 4, F16-F18).
