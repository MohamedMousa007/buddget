# W2b - Admin Portal audit (read-only)

Scope: `src/app/api/admin/**` (45 route files), `src/lib/server/admin/**`, `src/components/features/admin/adminClient.ts`, the RPCs they call (latest definitions in `supabase/migrations`). No DB queried, nothing run. "Proven" = visible in code/SQL read here. "Potential" = depends on table size or load that was not measured. No row counts or timings are claimed.

## 1. Architecture

- Hosting: same Next.js deployment, same Supabase project and same service-role key as the main app. `admin.buddget.app` is a host rewrite in `src/proxy.ts`/`lib/admin/host.ts`; `/api/admin/*` also stays reachable on `buddget.app` for the native apps (docs/ADMIN_PORTAL.md "Admin domain setup"). So an admin request shares serverless instances, DB pool and DB CPU with end-user traffic. No isolation of admin load from app load.
- Auth model: own sign-in, not the app session. Staff email + admin password (scrypt) + emailed 6-digit code -> opaque 12h session (60 min idle, biometric 4h), hashed in `admin_sessions`; cookie `__Host-bdg_admin` (HttpOnly, SameSite=Strict) or `X-Admin-Session` header on native. Mutations need `X-Requested-With: buddget-admin` (`guard.ts:96-99`).
- `guardAdmin` (`guard.ts:94-113`): CSRF header (writes) -> session lookup -> `loadStaff` (GoTrue `auth.admin.getUserById` + `admin_staff` + `admin_roles`) -> permission check (`canAny`). All 45 routes call it; every route passes a `permission` or checks `can()` itself. Permission is per route, per op for multi-op POSTs (`REQUIRES` map in `users/[id]/route.ts:64`).
- Service role: every route uses `createServiceRoleClient()` (RLS bypass) created per request. Authorization is therefore 100% application code; there is no DB-side defence except `admin_has_grant` for financial reads, the owner-immutability trigger and the append-only audit trigger.
- Step-up for dangerous ops (`stepUp.ts`): emailed code or admin password, 12/15 min rate limit, shares the 5-failure lockout.

## 2. Tables and lists

| List | Route | Pagination | Server/client | Max rows | Search/filter | Sort determinism |
|---|---|---|---|---|---|---|
| Users | `users/route.ts` -> `admin_user_directory` | LIMIT/OFFSET, `limit` max 100 (UI 25), offset capped 1,000,000 | server | 100/page + `total` | `ILIKE '%q%'` on auth.users.email, profiles.name/display_name (trigram only on the two profiles columns), `raw_user_meta_data->>'full_name'` | `created_at DESC` final tiebreak, no `id` |
| Audit log | `audit/route.ts` | keyset on `id` | server | 200 | `action ILIKE 'x%'`, `actor_email ILIKE '%x%'` | `id DESC`, deterministic |
| SMS logs | `sms/logs/route.ts` | keyset on `received_at` only | server | 200 | `sender ILIKE '%x%'`, OR-chain for queue=errors, user_id eq | `received_at DESC`, ties can skip rows |
| Email log | `emails/log/route.ts` | keyset on `created_at` only | server | 51 | `to_email ILIKE '%x%'` (PII roles) | ties can skip rows |
| Support tickets | `support/tickets/route.ts` | none, hard `limit(200)` | server | 200 | `subject/requester_email ILIKE '%x%'` OR | created_at/last_message_at, no tiebreak |
| Leads | `leads/route.ts` | keyset (created_at,id) | server | 200 | kind eq | deterministic |
| Crashes | `crashes/route.ts` | none, `limit(200)` + 5000-row stats read | server | 200 / 5000 | eq filters | `last_seen DESC` only |
| SMS templates | `sms/templates/route.ts` op=list | none, `limit(500)` of `select('*')` | server | 500 (+200 senders) | none | `match_count DESC` |
| Staff, roles, grants, plans, flags, loyalty ledger | various | none | server | unbounded (staff/roles/flags/plans, small by nature); grants 200; ledger 25 | none | order by key/created |
| Transactions / billing lists | no admin list of user transactions exists; per-user financial data only via grant-gated tabs | n/a | | | | |

All lists are server-paginated; the client (`UsersView`) holds only the current page. Search for tickets/users is server side.

## 3. Aggregates / dashboards

- Overview and Analytics: `adminMetrics()` (`lib/server/admin/metrics.ts`) reads 8 keys from `admin_metrics_cache`. If any needed key is >=15 min old it calls `admin_refresh_metrics_if_stale` (advisory-xact-lock, single refresher) which recomputes ALL 8 metrics in-request (migration 0300). The pg_cron refresh was removed in 0300 (hourly job unscheduled), so the first admin page load after 15 min of inactivity pays the whole recompute. Docs still say pg_cron refreshes every 15 min (stale doc).
- What they compute (0139/0125/0175): `admin_overview` (counts over auth.users, `app_activity_days` DISTINCT user windows, expenses, sms_parse_log 24h/7d, support_tickets, user_entitlements); `admin_feature_adoption` = 12 `count(DISTINCT user_id)` over whole tables (expenses, income_sources, budget_plans, debts, subscriptions, goals, savings_accounts, receipts, sms_parse_log, push_tokens, biometric_devices) plus `count(*)` on auth.users and user_settings; `admin_sms_health`, `admin_retention`, `admin_funnel`, `admin_retention_days`, series functions.
- Non-cached aggregates (every call): `sms/health` (RPC over window + 2 `count exact` over `expenses`), `plans` GET (`count exact` on profiles + RPC), `loyalty` GET (7 queries/RPCs incl. `admin_loyalty_summary`, `admin_billing_counts`), `ai/cost`, `emails/log` (`admin_email_status_counts` GROUP BY over the filtered window on every page), `support/tickets` (`admin_ticket_counts` full GROUP BY + `count exact`), `analytics/onboarding` (`admin_onboarding_funnel`, uncached), `analytics?days!=30` (series RPCs live).
- Cadence: user-driven only, except `SupportDeskBadge` polling `support/summary` every 60 s per open portal tab (bounded 500 rows, partial index).

## 4. N+1 / per-row

No per-row `auth.users` lookups in lists (the directory joins in SQL). Per-row/loop patterns found: W2b-09 (promotion loop), W2b-10 (staff role loop), `wipeUserData` per table (W2b-08). `sms/logs`, `sms/queue-health` batch profile emails with one `IN` query (good).

## 5. Findings

### W2b-01  Live search runs the full user-directory scan per keystroke
- File: `src/components/features/admin/useAdminLiveSearch.ts:10-35`, `src/app/api/admin/users/route.ts:24-41`, `supabase/migrations/0131_admin_user_name_fallback.sql` (cheap CTE) + `0246` patch.
- Code: `adminFetch('/api/admin/users?limit=5&q=...')` debounced 250 ms, min 2 chars -> `rpc('admin_user_directory')`. SQL: `WHERE (q IS NULL OR u.email ILIKE '%'||q||'%' OR p.name ILIKE ... OR p.display_name ILIKE ... OR u.raw_user_meta_data->>'full_name' ILIKE ... OR u.id::text = q)` and `'total', (SELECT count(*) FROM cheap)`.
- Problem: leading-wildcard ILIKE OR-ed across a column set that includes un-indexed `auth.users.email` and a JSON field, so the profiles trigram indexes (0139) cannot be used for the OR; the planner must scan all of auth.users joined to profiles/user_entitlements/user_settings. The exact `total` count runs over the whole matched set even though the caller wants 5 rows. Also each request runs the guard (3-5 round trips), `allowAttempt` RPC for `user_search` audit and a 2nd for `user_list`, plus (tickets) 4 more queries in the same keystroke (`support/tickets?view=all&q=`: tickets, staff, `admin_ticket_counts`, count exact; `view=all` is not a known view so it just means "no status filter").
- Evidence: code above; no trigram index on `auth.users.email` (owned by Supabase; 0139 comment says so).
- Status: scan shape proven; cost depends on user count (not measured). Potential.
- Fix: for the type-ahead call a dedicated lean RPC (email prefix / `lower(email) LIKE q||'%'`, id equality, limit 6, no count, no aggregates), or search `profiles` (indexed, trigram) which mirrors email. Skip total when `limit<=5`. Raise min chars to 3, add per-staff rate limit.
- Complexity: M.

### W2b-02  Users list: OFFSET to 1,000,000, whole-set count(*) per page, expensive sorts
- File: `users/route.ts:12,30`; `0131` directory body.
- Code: `MAX_OFFSET = 1_000_000`; `LIMIT lim OFFSET off`; `'total', (SELECT count(*) FROM cheap)`; for `order=active_desc|expenses_desc` or `state=inactive` the "heavy" branch computes `(SELECT count(*) FROM expenses x WHERE x.user_id=u.id ...)` and a `max(last_event_at)` correlated subquery for EVERY user before sorting/limiting.
- Problem: deep OFFSET and per-page full count are paid on every page click; the sort-by-expenses/active options do N correlated subqueries over all users for a 25-row page. The only tie-break is `created_at`, so equal timestamps can repeat or skip rows across OFFSET pages.
- Evidence: SQL read in full. Proven shape; impact depends on user count.
- Fix: keyset on `(created_at, id)` for the default orders; cap offset to e.g. 10,000; return `total` from the cached `admin_overview.users_total` when no filter is active; compute aggregates only for the page (as the cheap branch already does) and sort by a maintained column (e.g. `app_activity_days` max) via a materialised helper. Add `id` as final tiebreak.
- Complexity: M-H.

### W2b-03  Metric refresh runs synchronously inside an admin request, after the cron was removed
- File: `lib/server/admin/metrics.ts:32-37`, migration `0300_db_load_phase_a.sql:28-56`.
- Code: `if (needsRefresh) { await service.rpc('admin_refresh_metrics_if_stale', { p_max_age: '15 minutes' }) ... }` -> `admin_refresh_metrics()` recomputes all 8 aggregates (12-way DISTINCT counts, retention, funnel).
- Problem: the unlucky admin waits for the full recompute (no statement timeout configured in these routes; PostgREST/service-role default applies) and holds a function instance meanwhile. If the lock is held by another admin, the second caller returns false and then, for keys older than 45 min or missing, runs `live()` per key (up to 8 parallel heavy RPCs) - so a cold cache plus two admins runs the heavy set twice. Also overview/analytics may be the only visits for hours, so every first visit after an idle period is the slow path.
- Evidence: code + 0300 comment "removed; refreshed on admin view".
- Status: proven design; impact potential.
- Fix: restore a low-frequency pg_cron refresh (e.g. every 30-60 min, one set-based call; cheap vs the idle-load savings 0300 targeted), keep the on-view refresh only as fallback with `SET LOCAL statement_timeout`, and serve stale-while-revalidate instead of waiting. Update docs/ADMIN_PORTAL.md (still says pg_cron every 15 min).
- Complexity: L-M.

### W2b-04  Per-request guard cost: 4-5 sequential round trips, one of them to GoTrue over HTTP
- File: `guard.ts:50-68,94-113`, `session.ts:validateAdminSession`, `staff.ts:resolveStaff`.
- Code: `validateAdminSession` (select, + update `last_seen_at` every 60 s) -> `service.auth.admin.getUserById` (HTTP to Auth) -> `resolveStaff` (`admin_staff` select, then `admin_roles` select, claim updates on first visit). Reads cache `{user, staffCtx}` for 5 s in a module Map (per serverless instance); every write calls `staffCache.clear()` and re-reads fresh.
- Problem: the 5 s per-instance cache barely helps on serverless (instances cold/different), and the session lookup is never cached. Each page open fans out several admin GETs (Overview = 1 request, Support = 4 requests incl. the badge poll, User detail = 6 parallel queries), each paying the guard again. Writes always pay the GoTrue HTTP call (`getUserById`) even though the session row already names the user. `guardSignIn` adds `user_id_by_email` RPC.
- Evidence: code; docs say "20 s" and "5s" in different sections (ADMIN_PORTAL.md "Performance notes" vs "Security model"), actual constant is 5 s.
- Status: proven (count of calls); latency impact not measured.
- Fix: collapse session + staff + role into one RPC (`admin_resolve_session(token_hash)` returning staff, role, permissions, ban state); drop `getUserById` and read `email_confirmed_at`/ban from `auth.users` in that same RPC. Keep writes fresh via the RPC (one trip instead of four). Fix the doc.
- Complexity: M.

### W2b-05  Audit log has no retention or purge; append-only trigger blocks any purge
- File: `supabase/migrations/0123_admin_portal_core.sql:116-140`; `0141_retention.sql` (no `admin_audit_log` statement).
- Code: `admin_audit_log_immutable BEFORE UPDATE OR DELETE ... RAISE EXCEPTION 'The audit log is append-only'`; housekeeping purges email_log, admin_sessions, sms raw_body etc. but not the audit log.
- Problem: unbounded growth, with `metadata jsonb` that stores `before` snapshots (plans, entitlements, role permissions, notification bodies). `auditPiiRead` writes at most one row per staff/subject/10 min, so growth is moderate, but there is no archive path. Three indexes ((created_at), (actor_id,created_at), (target_type,target_id,created_at)) grow with it. No size/rate evidence collected.
- Status: proven (no purge); size impact potential. Compliance angle: also no documented retention period.
- Fix: monthly partitioning by `created_at` (detach/archive old partitions instead of DELETE, which keeps append-only semantics), or an archive job that copies >12-month rows to cold storage under a controlled `ALTER TABLE DISABLE TRIGGER` in a migration. Document the retention policy.
- Complexity: M.

### W2b-06  Audit rows are written after the action and failures are ignored on most destructive paths
- File: `audit.ts` (returns boolean, never throws); `users/[id]/route.ts:133,139,...,249-264` (`await log(...)` result unused); `crashes/route.ts`, `plans/route.ts`, `staff/route.ts` `await ctx.audit(...)` unchecked.
- Code: `case 'delete': ... deleteUserCompletely(...); await log('user.delete', ...)`; only `dsr.export`, `pii.sms.reveal` check `audited === false`.
- Problem: if the audit insert fails (DB blip, timeout) or the function dies between the mutation and the audit insert, the user delete / reset / suspend / role change succeeds with no trail, only a `console.error`. `auditPiiRead` is even weaker: if the rate-limit RPC errors, `allowAttempt` returns false and the audit is skipped (fail-open for PII-read logging).
- Evidence: code.
- Status: proven design gap; likelihood potential.
- Fix: write an "intent" audit row before irreversible ops (`user.delete`, `reset_data`, role/permission changes) and refuse on failure (pattern already used for DSR export); better, do mutation + audit in one SQL function/transaction. In `auditPiiRead` treat RPC error as "log anyway".
- Complexity: M.

### W2b-07  Admin sign-in IP throttle keys on the raw IPv6 address, not the /64
- File: `guard.ts:126` uses `clientIp(req)`; `lib/server/clientIp.ts` has `rateBucketIp` (IPv6 /64) built for exactly this (S8A X-3) but guard does not use it.
- Code: ``allowAttempt(service, `admin-signin-ip:${clientIp(req)}`, 900, 40)``.
- Problem: one IPv6 host can rotate addresses within its /64 and never hit the 40/15 min IP limit. The remaining protections are per-account (`admin-login:<uid>` 12/15 min, 5-failure 15 min lockout), so credential stuffing across many accounts is only slowed by the lockout, not the IP limit. Also `admin-code`/`admin-setup` are per-account only.
- Status: proven.
- Fix: `rateBucketIp(clientIp(req))` in `guardSignIn`. One line plus a test.
- Complexity: L.

### W2b-08  Lockout can be triggered by anyone who knows a staff email (including the public owner address)
- File: `credentials.ts:recordFailure`, `auth/code/route.ts:48-56`, `auth/login/route.ts`.
- Problem: 5 wrong passwords against `POST /auth/code` locks the target for 15 min (`LOCKOUT_MS`), then repeatable. The owner email is a constant in `permissions.ts` and in the docs. The per-IP limit (40/15 min) allows ~8 lockouts per window per IP (more with IPv6, see W2b-07). Effect: owner/staff cannot sign in, and step-ups (shared lockout) also fail. A legitimate bulk operation in an already-open session still works (sessions are not killed), but any step-up needed for it fails while locked.
- Status: proven mechanism; abuse is potential (requires knowing email, which is the documented owner address).
- Fix: keep lockout per account but make it progressive and exempt a known device/biometric path; alert (email) the account on lockout; consider keying failures on (account, IP bucket) in addition to account.
- Complexity: M.

### W2b-09  `sms/promotion` run_auto_promote loops per sender sequentially; `bulk_toggle` is a table-wide write with no step-up
- File: `sms/promotion/route.ts:70-82`, `sms/templates/route.ts:80-87`.
- Code: `for (const sender of new Set(...)) await checkAndAutoPromote(sender, service, ...)` (each does replay cases load); `bulk_toggle`: `update({ai_enabled}).neq('id','000...')` -> every row of `sms_tracking_templates_ai`, one statement, `sms.manage` only, no confirmation proof, no step-up, no row count in the audit entry, and disabling does not flag affected parsed rows (unlike `kill`/`demote`).
- Problem: (a) N sequential replays inside one HTTP request, no time budget; the check also runs `check_sms_promotion_eligibility`, which does a correlated scan of `sms_parse_log` per template (`WHERE l.sender = t.sender AND l.created_at > t.created_at`, run twice: select list and WHERE) - no index on (sender, created_at) was found in migrations (`sms_parse_log_zero_variance_idx` is on matched_template_id). (b) One click disables AI parsing for every template; reversible only by re-enabling active ones (the code comment admits `kill` marks cannot be told from disabled).
- Status: loop and missing step-up proven; scan cost potential.
- Fix: add `(sender, created_at)` index or precompute per-sender failure stats; wrap run in a time budget with a cursor; require `stepUp` for `bulk_toggle` and write the affected count in the audit row.
- Complexity: M.

### W2b-10  Sequential per-table wipe/export with no batching or timeout for big accounts
- File: `lib/server/userData.ts:217-224` (`wipeUserData`), `189-214` (`exportUserData`), `users/[id]/export/route.ts:12`.
- Code: `for (const table of USER_DATA_TABLES) await admin.from(table).delete().eq('user_id', uid)`; export: per table `select('*', {count:'exact'}).limit(20000)` then, if truncated, re-reads page by page with OFFSET.
- Problem: delete is one unbatched DELETE per table (a heavy user = long single statement, FK cascades, WAL spike; no `statement_timeout`; partial failures are reported ("Run it again") which is idempotent, good). Export builds an in-memory JSON of up to 20,000 rows x ~40 tables and returns it as one response; Vercel serverless response size/time limits (4.5 MB body; function maxDuration not set on any admin route - none of `maxDuration` found in `app/api/admin`) can break large exports, and the double read (count read then page read) repeats work. `incomplete` is reported, so failure is visible, not silent.
- Status: potential (depends on account size). Idempotency: wipe/delete are idempotent by design.
- Fix: batch deletes (`DELETE ... WHERE id IN (SELECT id ... LIMIT n)` loops) via an RPC with a statement timeout; stream the export to Storage and return a signed URL; set `maxDuration`.
- Complexity: M.

### W2b-11  15 s client response cache shows stale lists after admin writes
- File: `adminClient.ts:73-123` (`STALE_MS = 15_000`, `MAX_CACHED = 60`).
- Code: a response younger than 15 s is not refetched on remount; `useAdminAction` only calls the caller's `onDone`, no global invalidation.
- Problem: suspend/restore a user, change a plan or a flag, then go back to the list (UsersView, SupportView, FlagsView, PlansView) within 15 s: the cached list renders without revalidating, so the change appears missing. Different paths are separate cache keys, so e.g. the ticket detail reply does not invalidate `?view=active` list or the support badge. In-flight dedupe is fine. Cache is cleared on the lock event, but not on a permission change (a role downgrade shows old data up to 15 s; the server still enforces).
- Status: proven; severity low (visual only, no data loss).
- Fix: export `invalidate(prefix)` from adminClient and call it from `useAdminAction` (prefix by resource), or force revalidate-on-mount when the previous action touched that resource.
- Complexity: L.

### W2b-12  Server-side staff cache: 5 s per instance, cleared only on the writing instance; docs disagree
- File: `guard.ts:42-56,97`; docs/ADMIN_PORTAL.md "Performance notes" says 20 s, "Security model" says 5 s, code says 5 s.
- Problem: a suspension or role change on instance A is not seen by reads on instance B for up to 5 s. Writes are always fresh, and sessions are revoked immediately on role/permission change (`revokeAllAdminSessions`), so exposure is reads only and small. Other server caches: `platformCache` / `curatedDbCache` invalidated per instance only (`invalidatePlatformSettings()` after a write), so a maintenance toggle or template kill reaches other instances only when their own TTL expires.
- Status: proven design; low risk.
- Fix: fix the doc; if instant propagation matters, drop the staff cache for permission-sensitive reads or add a version counter in a row read with the session lookup.
- Complexity: L.

### W2b-13  No general rate limit on authenticated admin endpoints (only per-action limits)
- File: `guard.ts` (no limiter in `guardAdmin`); limits exist only for sign-in (`guardSignIn`), step-up, `uact:*` user actions (`staffActionGuards.ts`), `sms-reveal` (60/h), `dsr-export` (5/h), `email-test` (10/h), invites, `piiread` audit dedupe.
- Problem: a stolen/automated session (12 h life) or a runaway client loop can hammer the heavy reads in this report (W2b-01/02/03), every one of which is service-role and shares DB capacity with the app. No per-staff request budget, no `Retry-After`. Counter-point: the heavy reads are used by the same few staff, so legitimate bulk operations are not hindered by the lack of a limit; if a generic limiter were added it should be per-staff and generous (bulk ops here are single requests, there is no batch endpoint, apart from `bulk_toggle`).
- Status: potential.
- Fix: a per-staff-per-minute bucket in `guardAdmin` on GETs of heavy routes (users search, emails/log, analytics) via `admin_rate_hit`, ~60-120/min, 429 with Retry-After. Reuse the existing function.
- Complexity: L.

### W2b-14  `confirmed: true` in-app step-up for owner/admin roles
- File: `stepUp.ts:28`, `permissions.ts:18` (`INAPP_CONFIRM_ROLES = [owner, 'admin']`).
- Problem: for these roles `delete`, `reset_data`, role/permission changes and maintenance mode accept `confirmed: true` from the request body with no fresh factor. Anyone holding a live admin session cookie/token (12 h; XSS in the portal, or a stolen device) can delete users or wipe accounts without re-proving. By design (UX choice, documented), and the role comes from the server session, but it is the weakest link in the destructive path. It is rate limited (12/15 min) and audited (`auth.step_up_inapp`).
- Status: proven, design trade-off.
- Fix: require a real factor for `delete` and `reset_data` at least; keep in-app confirm for reversible actions.
- Complexity: L.

### W2b-15  Keyset cursors on a single non-unique column (SMS logs, email log)
- File: `sms/logs/route.ts:39` (`received_at < cursor`), `emails/log/route.ts:33` (`created_at < cursor`); `leads` and `audit` do it correctly.
- Problem: rows sharing the cursor timestamp are skipped between pages (bursts of SMS arriving in the same instant are plausible). `crashes`, `tickets` have no pagination at all (200 cap): older rows are unreachable from the UI.
- Fix: (ts,id) compound cursor like `leads/route.ts:parseCursor`; add paging to tickets/crashes.
- Complexity: L.

### W2b-16  `sms/logs` and ticket search: unindexed ILIKE, OR filters
- File: `sms/logs/route.ts:32,38`; `support/tickets/route.ts:34`; `audit/route.ts:15`; `emails/log/route.ts:32` + RPC `admin_email_status_counts`.
- Problem: `ILIKE '%x%'` on `sender`, `subject`, `requester_email`, `actor_email`, `to_email` cannot use a btree. Planner choice for `queue=errors` (OR of three predicates) is likely to walk `sms_parse_log_received_idx` backwards until 200 matches; if errors are rare, that is a long walk. `email_log` count RPC re-runs a GROUP BY over the whole filtered window on EVERY page of the log (and with `q` an ILIKE over the window, 180-day retention). `support_tickets` filters/aggregates are over a small table today (partial indexes exist: needs-reply, triage); `admin_ticket_counts` is a full GROUP BY each call.
- Status: potential; scale-dependent (repo note 0215: `sms_parse_log` had 877 rows when last measured, so unmeasured today).
- Fix: trigram GIN on `sender`/`requester_email` (or prefix match), partial index for `status IN ('failed','add_failed')`; compute email counts once per filter change (not per cursor page), or cache 30 s.
- Complexity: L-M.

### W2b-17  Unbounded or loose reads in a few routes
- `crashes/route.ts:27` reads up to 5,000 rows then computes stats in JS (stats could be a GROUP BY RPC); also `select('*')` for the list.
- `sms/templates` list returns `select('*')` for 500 rows.
- `plans/route.ts:27` `count exact` over `profiles` per call (to compute "implicit members"); `admin_overview.users_total` already has it cached.
- `staff/route.ts:15` reads all live `admin_sessions` (small).
- `users/[id]/route.ts:28` 6 parallel queries + `admin_user_overview` (`count(*)` x12 per user via per-user indexes; fine, user-scoped).
- Status: potential, small tables today.
- Complexity: L.

### W2b-18  Non-transactional multi-step writes
- `plans` `set_default` (two updates; failure between leaves no default plan; the unique partial index prevents two defaults but not zero), `ai/cost` price change (close row then insert; has a manual rollback), `staff` role/permission changes loop per role and per holder, `users/[id]` `set_limits` read-then-write. Each is idempotent on retry. Fix: wrap in SQL functions. Complexity: L-M.

### W2b-19  Duplicate/outdated docs about caching and cron
- ADMIN_PORTAL.md says staff cache 20 s vs 5 s (code), says pg_cron refreshes metrics every 15 min (removed in 0300; `metrics.ts` header comment is correct). Fix docs. Complexity: L.

### W2b-20  `proxy.ts` runs the app-session pipeline for `/api/admin/*`
- `src/proxy.ts:140-156`: `/api/admin` requests go through the Supabase cookie/auth refresh and `apiSecondFactorRefusal` for the app session even though admin ignores that session. Cannot confirm without reading proxy flow end-to-end whether a GoTrue call is made per admin request; treat as "verify". Complexity: L.

## 6. Protection summary (item 6)

- Login: IP 40/15 min (W2b-07 caveat), per-account 12/15 min, 5 failed -> 15 min lock, uniform 401 (timing equalised via `hashPassword`), code sends 8/h per account + 1/min from Supabase, invite 30/h per staff and 5/h per address. Rate-limit RPC error -> deny (fail closed) for sign-in, but fail-open for PII audit (W2b-06).
- Authenticated endpoints: no general throttle (W2b-13). CSRF: custom header required on writes + SameSite=Strict `__Host-` cookie; native uses header token. A throttle would not block legitimate bulk work as long as it is per-staff and generous.
- Destructive: step-up (code/password) except in-app confirm for owner/admin (W2b-14); target guards (`blockedTarget`, owner immutable trigger, rank checks); per-op hourly limits on harassing actions.

## 7. Strengths

- Single guard for all 45 routes, permission per op, rank/ownership rules, owner immutable by DB trigger, append-only audit trigger.
- Own session model: hashed tokens, idle and absolute expiry, immediate revoke on role/suspend, `__Host-` cookie, CSRF header.
- PII discipline: masking by default, masked-email search matching (`p_match_email`), financial access grants verified in the DB (`admin_has_grant`), reveal/export need reason + rate limit + audit-before-release.
- Heavy aggregates already cached in `admin_metrics_cache` with advisory-lock single refresher and a 45-min max-age fallback.
- Most lists have hard caps; keyset for audit/leads; DSR export capped; user actions rate limited per staff and per target; invite spam limits.
- Rate limiter uses floored buckets (0126/0322), hourly cleanup indexed on `window_start`.
- Client cache is bounded (60 entries), dedupes in-flight requests, is cleared on lock.
- Error handling: sign-in never leaks which factor failed; failures logged server-side, user-safe messages returned.

## 8. Audit/activity logs (item 8)

- `admin_audit_log`: append-only, no purge (W2b-05). `admin_sessions`: purged 30 days after revoke/expiry by housekeeping (`0141`). `api_rate_limits`: hourly cleanup. `email_log`: 180 days (365 for bounces). `site_leads`: 180 days (0238). `app_analytics_events`/`app_activity_days` are outside this audit.
