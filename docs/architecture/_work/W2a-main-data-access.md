# W2a. Main-app data access audit (read-only, code-level)

Scope: main (end-user) app API routes, `src/lib/**` (sms, server, store, sync, finance), client hooks that hit Supabase, cron routes. Admin portal excluded. Method: read the code behind the W1a leads (section 3) plus `CLAUDE_CONTEXT.md` and `docs/DB_SCALING_PLAN.md`. No telemetry, no database access, no row counts: every "proven" below means the code makes the behaviour certain; every "potential" depends on data volume that this audit did not measure. Index claims come from `supabase/migrations/` only and were not checked against the live database (the baseline schema may hold more indexes than the folder shows): confirm with `EXPLAIN` before acting.

Already fixed by the team (not re-reported as problems, see Strengths): delta sync with a probe (`sync_changed_since`), hydrate hooks removed, `sharedFetch` de-dupe, notification cron made set-based and resumable, SMS route reduced to one claim insert, price self-heal debounce, `updated_at` indexes for the sync probe.

Severity key: P1 fix first, P2 plan, P3 note. Complexity L (hours), M (a day or two), H (multi-day / design).

---

## Top findings (ranked)

| Rank | ID | One line |
|---|---|---|
| 1 | W2a-01 | Month-carry cron: users processed strictly one at a time, 30-60 queries per due user, no persisted cursor, so a run that hits its budget restarts from the first user next day |
| 2 | W2a-02 | First pull, forced-full pull and the legacy fallback load every live row of every table (full history) into the client; no cap, no paging in the RPC path |
| 3 | W2a-03 | `useSubscriptionDetector` reads 90 days of SMS log with no limit under an ascending sort; past PostgREST's 1000-row cap it silently keeps the OLDEST rows and drops the latest sightings |
| 4 | W2a-04 | `plans` and `feature_flags` (global, near-static) are read from the database on every entitlement check and every `/api/flags` call; the project rule says cache these |
| 5 | W2a-05 | `loadCycle` is re-run per closed cycle (3x) for the same user, repeating 4 identical per-user queries and pulling `select('*')` of accounts, goals, expenses, income events, sources |
| 6 | W2a-06 | Payment-method reads repeated 6-9 times inside one SMS booking (known and deferred in the scaling plan) |
| 7 | W2a-07 | `sweepMaskedStores` (cron) re-reads and rewrites every masked row of three growing tables daily inside a 55 s window; `complete` can become permanently false |
| 8 | W2a-08 | Client write path has no batch-size cap (one upsert of N rows) and `.in('id', [...])` tombstones/deletes with unbounded id lists (URL length) |

---

## 1. N+1 and queries in loops

### W2a-01 (P1, potential, M-H) Month-carry cron is per-user sequential with a non-persisted cursor
- File: `src/app/api/cron/month-carry/route.ts:185-197` (`carryUser`), `:222` (cursor from `?after=`), `:238-252` (loop), `:38,241` (time budget).
- Code: `for (const s of settings) { if (Date.now()-startedAt > TIME_BUDGET_MS) { partial = true; break scan } ... carried += await carryUser(service, s, rates, now, dry) }`; `carryUser` begins with `.from('savings_month_summary').select('month_key').eq('user_id', userId).order('month_key', {ascending:false}).limit(1).maybeSingle()`.
- Problem:
  - Queries per user = 1 (latest summary) for every user in `user_settings`, every day, even when no cycle is due. The user scan itself is keyset-paged (500 per page, `gt('user_id')`), which is fine, but the per-user probe is one round trip per user.
  - For a user with a closed, unswept cycle the cost is about: 1 + `loadCycle` 7 queries (profile + 6 `allRows`) + `closedCycleDrift` (1 summary read + up to 3 x (`loadCycle` 7 + `rowsChangedSince` up to 3)) + one `claimCarryAdjustment` per stale prior month + `allocateGoalFunding` (1 run read + `primaryTrackedAccountId` + per goal: claim insert, optional pocket create and link, `adjust_pocket_balance` RPC, optional notification with push) + `primaryTrackedAccountId` again + dedupe check + deposit RPC + summary insert + notification. Roughly 30-60 round trips for one due user, all sequential (no concurrency, unlike the notification cron's `CONCURRENCY = 8`).
  - The cursor lives only in the response (`nextCursor`) and a manual `?after=` param. Vercel cron calls it daily with no params (`vercel.json`, 05:00 UTC). If the first N users consume the 50 s budget, users after them wait until the earlier ones have summary rows and become cheap. On a month boundary where many users are due on the same day, throughput per day is bounded by sequential per-user latency. Compare `cron/notifications/route.ts:89-91,294-299`, which stores `notification_cron_cursor` in `platform_settings`.
- Evidence: code only. Capacity is not measured here; the shape (sequential, no stored cursor, no candidate filter) is certain.
- Fix: (a) a set-based candidate RPC (`month_carry_due_users(p_now, p_after, p_limit)`) that returns only users whose latest `savings_month_summary.month_key` is behind the expected closed key (same shape as `notification_due_users`), replacing the per-user probe; (b) persist the cursor in `platform_settings` like the notification cron; (c) process users in chunks of 4-8 with `Promise.all` (users are independent, claims are compare-and-set); (d) rates are already fetched once. Money writes stay idempotent per `(user, month_key)`.

### W2a-05 (P2, proven for the repeats, M) `loadCycle` repeated per cycle; 4 queries are identical across the 3 iterations
- File: `src/lib/server/carryCycle.ts:65-79` (`loadCycle`), `:150-151` (loop over `DRIFT_CYCLES = 3`), `:156` (`rowsChangedSince`).
- Code: `for (const r of rows) { const ctx = await loadCycle(service, userId, r.month_key as string, monthStartDay, rates) ...}`; inside, `allRows(() => service.from('savings_accounts').select('*').eq('user_id', userId).is('deleted_at', null), 'accounts')`, the same for `goals` and `income_sources`, plus a profile read.
- Problem: per iteration the month-independent reads (profile, accounts, goals, income_sources) repeat 3 times for the same user, and the loop is sequential. Used by `GET /api/savings/carry` (on a user tap, plus an external FX fetch with a 6 s timeout on every request, `carryCycle.ts:18`) and by the cron through `closedCycleDrift` (`month-carry/route.ts:78`). `select('*')` on `expenses` and `income_events` fetches every column to compute sums.
- Fix: split `loadCycle` into `loadUserContext` (profile, accounts, goals, sources: once per user) and `loadCycleRows(monthKey)` (expenses, events, deposits; run the 3 months in `Promise.all`); select only the columns `cycleCarryFigures` reads; ideally one RPC `cycle_carry_inputs(user, from, to)` returning pre-summed figures by currency (also removes the JS aggregation, see W2a-17).

### W2a-09 (P3, proven, L) Sequential identical reads inside `resolvePaymentMethodByProvider`
- File: `src/lib/sms/createSmsExpense.ts:371-396`.
- Code: `for (const token of tokens) { ... const { data } = await service.from('payment_methods').select('id, name, last4').eq('user_id', userId).eq('type','wallet').is('deleted_at', null) ...}`.
- Problem: the query does not depend on the token, only the in-memory match does. With 2-3 tokens it repeats the same query. Bounded (about 3). One of the repeated reads in W2a-06.
- Fix: hoist the query out of the loop.

### W2a-10 (P3, proven, L) Per-crash RPC pairs in the iOS crash cron
- File: `src/app/api/cron/ios-crashes/route.ts:33-37`.
- Code: `for (const c of crashes) { const userId = c.email ? ((await service.rpc('user_id_by_email', ...)).data ?? null) : null; await service.rpc('record_client_crash_v2', ...) }`.
- Problem: 2 RPCs per crash, sequential, and the 3-day lookback (`LOOKBACK_MS`) re-submits the same crashes every day (idempotent by event id, but the work repeats). Bounded by crash count; low impact.
- Fix: skip submission ids already recorded (cursor in `platform_settings`), or one RPC taking an array.

### Bounded or fixed-size loops (not problems)
- `flushDiff` runs one upsert per table (17-23 tables, parallel within a tier, tiers sequential): fixed, by design for FK order (`sync.ts:285-310`).
- `userData.ts` `wipeUserData` / `deleteOwned` (`:96-105`, `:205-211`): one DELETE per table, about 58 tables, sequential. Fixed list, user-initiated and rare. A power user's single `DELETE ... WHERE user_id` on `sms_parse_log` or `expenses` is unbatched (statement-timeout risk, not an N+1).
- `parse/route.ts:1657` shadow verdicts: one RPC per shadow-matched template inside `after()`, bounded by the 10-50 template candidate limit.
- `pairing.ts:683-700` `settleSibling` polls up to `SETTLE_MAX_POLLS`; `flag-action/route.ts:251` loops over at most 2 retracted income legs.
- `harvest.ts:92-103`: 200-row batch, stamped 20 at a time in parallel, 5 batches max per cron run.

---

## 2. Unbounded reads

### W2a-02 (P1, proven shape / potential volume, H) First pull, forced-full pull and the legacy fallback load all live rows
- Files: `supabase/migrations/0142_sync_pull.sql:10-25` (`sync_table_delta`: `jsonb_agg(to_jsonb(t))` with `deleted_at IS NULL`, no `LIMIT`), `src/lib/supabase/remote/delta.ts:112-123`, `src/lib/supabase/remote/sync.ts:593-666` (`pullAll`), `:534-556` (`fetchLive`, keyset by id, PAGE_SIZE 1000), `src/components/sync/SupabaseFinanceSync.ts:757-762` (catch path).
- Code: `'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]'') FROM public.%I t WHERE t.user_id = (SELECT auth.uid()) AND t.deleted_at IS NULL'` for 17 tables in one function call; `pullAll` runs 23 `fetchLive` calls in parallel (`select('*')`, loop until a short page).
- Problem:
  - First sign-in on a device, a wipe-on-reset, a cursor older than 60 days (`needs_full`) and the `catch` of `pullAndMerge` (which also calls `clearSyncCursors()` and falls to `runLegacyFullSync`) all load the user's whole history in one JSON value (RPC) or 23 unbounded paged reads (legacy). Size grows with account age; the RPC has no cap and no page protocol. The response is built in memory inside Postgres, then parsed and mapped on the device.
  - The legacy fallback is the old F1 (22x `select *`) that the scaling plan marked fixed: it still runs as the failure path. Any exception in the delta path (a mapper throwing on one bad row, a network error) demotes the device to the heavy path and wipes the cursor, so the next boot is heavy too.
  - On every non-empty delta, `sync_pull` also returns all live `budget_plans`, `budget_categories`, `budget_subcategories` and `budget_plan_activations` regardless of the window (`0233:30-41`). Small per user, but it is full-set transfer on every change.
- Evidence: SQL and client code; the design is a whole-snapshot client store (111 feature files read `useFinanceStore`).
- Fix: (a) a keyset-paged first pull (`sync_pull_page(p_table, p_after, p_limit)`) or `fetchLive`-style paging per table so no response is unbounded; (b) in `pullAndMerge`, retry a transient delta error instead of dropping the cursor, and park a row the mapper cannot read; (c) filter the budget tables by `updated_at > win`; (d) longer term, load old months on demand (changes the product model: H).

### W2a-03 (P1, proven, L) `useSubscriptionDetector` is unbounded and sorts ascending: truncation keeps the oldest rows
- File: `src/hooks/useSubscriptionDetector.ts:44-55` (lookback constant at `:17`).
- Code: `.from('sms_parse_log').select('merchant, ..., raw_sms_summary').eq('parsed_ok', true).in('kind', ['purchase','online_purchase']).gte('created_at', since).order('received_at', { ascending: true })` with no `.limit()`; `LOOKBACK_DAYS = 90`.
- Problem: the repo has no `supabase/config.toml`, and other code states PostgREST answers at most 1000 rows (`cron/notifications/route.ts:40`, `userData.ts:119`). A user with more than 1000 card purchases in 90 days gets the first 1000 by time ascending, so the most recent sightings (the comment at `:53` says the last row must be "genuinely the LATEST sighting") are the ones dropped, and `scanned` reports 1000. The read is scoped by RLS to the user, so volume is per user, not global. It also fetches `raw_sms_summary` per row.
- Fix: order descending and add an explicit `.limit(1000)`, or move the "recurring charge" grouping to an RPC (`GROUP BY merchant_normalized` with counts and last date) so the device receives tens of rows.

### W2a-11 (P2, potential, L) `usePaymentMethodDetector`: limit 300, no order, raw text fetched
- File: `src/hooks/usePaymentMethodDetector.ts:123-131`.
- Code: `.select('account_last4, bank_name, sender, payment_instrument, raw_body').eq('parsed_ok', true).not('account_last4','is',null).gte('created_at', since).limit(300)`.
- Problem: no `ORDER BY`, so the 300 rows are arbitrary rather than the newest; a user with more than 300 matching messages may never see a newly appearing account. `raw_body` (full SMS text, the widest and most sensitive column) is fetched for up to 300 rows only to extract patterns on the device.
- Fix: an RPC with `DISTINCT ON (account_last4, bank_name) ... ORDER BY ..., received_at DESC` returning no raw body; at minimum add `.order('received_at', {ascending:false})`.

### W2a-12 (P2, potential, L) `findUnplacedForTail` / `findUnplacedForAccount`: unbounded `in(...)` id list
- File: `src/lib/accounts/unplacedForTail.ts:36-41, 64-69`.
- Code: `.from('sms_parse_log').select('expense_id, account_last4, bank_name, sender').in('expense_id', unplaced.map((e) => e.id))`.
- Problem: supabase-js sends the list in the URL (36-char ids, about 40 bytes each with separators). A few hundred unplaced expenses can exceed URL limits and the request fails; the code treats `data ?? []` as "no logs", so the failure reads as "nothing to place" (silent wrong answer). No limit either.
- Fix: chunk at 100 ids (as `cron/notifications/route.ts:41,61` does with `IN_LIST`), or filter server side with `expense_id is not null and account_last4 = tail` first.

### W2a-13 (P2, potential, L) `fetchHeldStockTickers` reads every stock holding of every user
- File: `src/lib/prices/fetchKeyed.ts:74-86`; used by `lib/prices/runPriceRefresh.ts:100` (cron `/api/cron/prices`).
- Code: `.from('savings_holdings').select('asset_symbol').eq('asset_type','stock').is('deleted_at', null)` then `new Set(...)` in JS.
- Problem: global, unfiltered, no order or range. The response is capped at 1000 rows, so with more than 1000 stock holdings the distinct list is built from an arbitrary 1000 rows and some held symbols never get a quote. It transfers one row per holding when only distinct symbols are needed. Finnhub quotes are then fetched sequentially (`fetchFinnhubQuotes`, 6 s timeout each), so many tickers can overrun `maxDuration = 60`.
- Fix: `SELECT DISTINCT asset_symbol` via an RPC (`held_stock_tickers()`), cap tickers per run and rotate with a cursor, quote with a small concurrency limit.

### W2a-14 (P3, potential, L) `data-retention` cron: one unbounded UPDATE returning every id
- File: `src/app/api/cron/data-retention/route.ts:21-28`.
- Code: `.update({ to_email: '[erased]' }).is('user_id', null).lt('created_at', cutoff).neq('to_email','[erased]').select('id')`.
- Problem: one statement over all matching `email_log` rows with `RETURNING id` sent back over the wire only to count them; response size and lock time grow with the backlog (worst on the first run). Output uses only `data?.length`.
- Fix: an RPC with `LIMIT` batches returning a count.

### W2a-15 (P3, potential, L) `asset_prices` read is whole-table with no limit
- File: `src/hooks/useAssetPrices.ts:55-61, 83-86`.
- Code: `.from('asset_prices').select('symbol, currency, price, as_of, asset_class, confidence')` (twice on self-heal).
- Problem: global shared table (symbol x currency), bounded by catalogue size, not users; no `.limit()`, so past 1000 rows it would truncate silently. Today's size is not measured here. Latent cap, plus an uncached read per device resume (throttled by `MIN_GAP_MS`).
- Fix: explicit order and a comment now; later serve it from a CDN-cached `GET /api/prices` (scaling plan F5).

### Per-user reads that are bounded (checked)
`GET /api/notifications` (limit 80), `GET /api/support/tickets` (limit 50), `support/board` (limit 100), support thread (limit 200, signed URLs in one storage call), `useSmsConfirmations` (limit 20, 30-day window), `useOwnTransferReview` (limit 20), `useGoalAllocationRuns` (limit 1500), `useNetWorthHistory` (limit 450, day window), `fetchLegacyLastSms`/`fetchLastReceived` (limit 1).

---

## 3. Over-fetching

### W2a-16 (P2, proven, L-M) `select('*')` on hot paths where few columns are used
| Place | Used by | Columns actually needed |
|---|---|---|
| `lib/server/carryCycle.ts:73-77` (`savings_accounts`, `goals`, `expenses`, `income_events`, `income_sources`) | month-carry cron, `/api/savings/carry` | amounts, currency, dates, category, kind, refund fields; not notes, receipt links, SMS flags |
| `cron/notifications/route.ts:128,129,136` (`subscriptions`, `goals`, `expenses` for subscription alerts) | hourly cron, chunks of up to 96 users, expenses over 401 days | the fields `subscriptionFromRow` / `expenseFromRow` read |
| `lib/server/devices/registry.ts:82,107,142` and `api/devices/route.ts:35` (`user_devices select('*')`) | device heartbeat (every 4 h per phone), `GET /api/devices` | about 12 columns |
| `lib/supabase/remote/sync.ts` `fetchLive`, `profiles`, `user_settings` | legacy pull | mappers need nearly all columns, acceptable |
| `sync_table_delta` returns `to_jsonb(t)` (every column) | every delta | acceptable because mappers consume them, but expenses carry SMS and refund columns the client rarely uses |
- Also `useSubscriptionDetector` selects `raw_sms_summary` and `usePaymentMethodDetector` selects `raw_body` (W2a-03, W2a-11).
- Fix: name columns; for the two crons an RPC returning pre-aggregated figures is better than a column list.

---

## 4. Repeated queries and waterfalls

### W2a-04 (P1, proven, L) `plans` and `feature_flags` read from the DB on every call, contrary to the project rule
- Files: `src/lib/entitlements/server.ts:7-20` (`loadEntitlements`: `service.from('plans').select('key, name, limits, features, trial_days, is_default')`, no filter, no cache), `src/app/api/flags/route.ts:22-24` (`feature_flags` full table + `admin_staff` + entitlements).
- Callers: `/api/entitlements/me` (once per boot via `BillingHost`), `/api/flags` (once per page load via `useFeatureFlag`'s memo), `buddgy/turn/route.ts:57`, `ai/route.ts:49`, `budget/ai/route.ts:44`, and `requireFeature` inside `reserveAiQuota` (`lib/server/ai/quota.ts:97`), which runs on every paid AI call (chat turn, voice, receipt scan, goals).
- Problem: `CLAUDE.md` ("Cache what does not change per request (settings, plans, prices) in the server with a TTL") is not followed here. `platformCache.ts` (`cachedSetting`, 300 s, tagged), the 5-minute spark-products cache (`entitlements/me/route.ts:83-100`) and `clientGate` (60 s) show the pattern. Each AI turn pays an extra `plans` read plus a `user_entitlements` read before the quota RPC. `requireFeature` also issues a second `user_entitlements` query for non-paid keys (`server.ts:38`).
- Fix: wrap the `plans` and `feature_flags` reads in `cachedSetting` (tag-invalidated by the admin plan and flag routes, TTL 60-300 s); keep the per-user `user_entitlements` read. In `/entitlements/me` the plan resolution (`:23`) runs after the `entitlements_state` RPC as a second step; once cached it costs nothing.

### W2a-06 (P2, proven, M) Payment-method table read repeatedly inside one SMS booking
- Files: `src/lib/sms/createSmsExpense.ts:382, 430, 466, 506, 546, 754, 942, 946`; `src/lib/sms/ownAccounts.ts:56`; `src/lib/sms/accountPlacement.ts:83`; `src/lib/sms/providerCascade.ts:151`; `src/app/api/sms/parse/route.ts:1596` (in `after()`); `lib/sms/dispatch.ts:822`.
- Code (example): `findUniqueByLast4` does `.from('payment_methods').select('id, name, last4, last4_aliases, provisional, closed_at').eq('user_id', userId).is('deleted_at', null)`; `namesUntrackedAccount` then calls it and two `maybeSingle` reads by id (`:466-468`).
- Problem: one SMS can touch the same user's `payment_methods` several times (by provider, by last4, default account, provisional, cash fallback, tracking check, the soft-signal read in `after()`), each a separate round trip. The scaling plan lists this as known and deferred (section 12: "payment-method read memo inside the SMS dispatch: its tests stub per-call queries and need a deliberate rewrite"). Per user the table is small, so the cost is round-trip count, not scan cost.
- Fix: load the user's methods once per request into a request-scoped object and pass it down; make tests stub that loader instead of individual queries.

### W2a-18 (P2, proven, L) `sendNativePush`: three sequential reads before every push
- File: `src/lib/server/sendNativePush.ts:36-60`.
- Code: `await service.from('push_tokens')...` then `await service.from('user_devices')...` then `await service.from('user_settings').select('privacy, language')...`.
- Problem: a waterfall of 3 awaited queries where `user_devices` and `user_settings` could run in parallel with the token read. Used by every `emitNotification` (cron alerts, month-carry, device events) and SMS pushes. `getUserDictionary` (`lib/server/userDictionary.ts:6`) re-reads `user_settings` for the same row in several callers (for example `devices/registry.ts` `promoteMain`).
- Fix: `Promise.all` the three reads; let callers that already hold `language`/`privacy` pass them in.

### W2a-19 (P3, potential, L) `useNotifications` fetches per mounting instance and on every `user` object change
- File: `src/lib/notifications/useNotifications.ts:95-103, 109-125`.
- Code: `useEffect(() => { ... apiFetchAuth('/api/notifications') ... }, [user])`.
- Problem: consumers are `notifications/page.tsx` and `NotificationInbox` (two instances can mount together); each runs a `GET` (2 queries: 80-row page + exact unread count). The dependency is the `user` object, not `user.id`, so any auth emission that creates a new object (token refresh) refetches. No shared de-dupe, though `sharedFetch` exists.
- Fix: depend on `user?.id`; route through `sharedFetch('notifications:'+id, 30_000, ...)`.

### Smaller duplicate and waterfall notes
- `entitlements/me` (`route.ts:22-28`): state RPC, billing switch and spark products in parallel, then `getUserEntitlements` (2 queries), then `trialLength` (a 4th), in sequence. Once per boot; acceptable once the plan read is cached (W2a-04).
- `devices/registry.ts` `upsertSelf` (`:84-153`): `select('*')` all devices (live and revoked), a write, then a final `select('*')` re-read: 3 round trips minimum, throttled to every 4 h per phone (`lib/devices/client.ts:7`), more on first registration or promotion.
- `useSmsTracking`: three independent reads started together (`:201-203`); `getSession()` is local, no network. Fine.
- `isAccountActive` (`lib/auth/accountActive.ts:23-38`): one Auth admin `getUserById` per user per minute per instance on SMS and push routes; the cache is per instance, so many cold instances repeat the lookup. Low cost.
- `useBalanceView`: one RPC per opened account card; no loop.

---

## 5. Pagination: user-facing lists

| List | Method | Where | Max rows retrieved | Bounded? | Deep-pagination concern | Sort determinism |
|---|---|---|---|---|---|---|
| Expenses / transactions (Flow ledger, Expenses) | none server-side; whole live history synced into the client store, rendered by day groups with "Show more" (`FlowLedger.tsx:46,62`, 40 days per page) | client (render only) | all live rows (W2a-02) | No (data volume) | no paging in the data path; cost is the initial load and in-memory scans on each store change | in-memory date sort; not DB |
| Income events, savings transactions, debts, debt payments, subscriptions, goals, receipts | same (full set in store) | client | all live rows | No | same | same |
| Sync pull (first / forced full) | RPC `sync_pull_v2` single JSON, or `fetchLive` keyset on `id`, PAGE_SIZE 1000 (`sync.ts:534-556`) | backend | all live rows | RPC no; `pullAll` pages but total unbounded | keyset on `id`: no OFFSET issue | `order('id')` deterministic |
| Delta pull | `updated_at > cursor - 2 min`, 17 tables, one JSON (`jsonb_agg`) | backend | all rows changed since cursor (approaches full after an offline stretch up to 60 days) | No cap | none (windowed) but a large window is a large response | `jsonb_agg` has no `ORDER BY`; consumers merge by id, so harmless |
| Notifications | `limit(80)` `created_at desc`, no cursor (`notifications/route.ts:26-31`) | backend | 80 | Yes | cannot see rows older than the newest 80 (no next page); unread is a separate exact count | `created_at` only, no `id` tie-breaker: rows with equal timestamps (several alerts from one cron run) may reorder between calls |
| Support tickets | `limit(50)` `last_message_at desc nullsFirst false` | backend | 50 | Yes | no next page | no `id` tie-breaker |
| Support thread | `limit(200)` `created_at desc`, reversed in memory (`tickets/[number]/route.ts:44-50`) | backend | 200 | Yes | keeps newest 200, drops oldest | `created_at` only |
| Feedback board | `limit(100)` `votes desc` (`board/route.ts:13-18`) | backend | 100 | Yes | none | ties on `votes` have no secondary key, so equal-vote ideas can swap order |
| SMS review (pending confirmations) | `limit(20)` `received_at desc`, 30-day window (`useSmsConfirmations.ts:33-37`) | backend | 20 | Yes | the 21st waiting message is invisible until one is resolved | `received_at` only |
| Own-transfer review | `limit(20)` `received_at desc`, 30 days | backend | 20 | Yes | same | `received_at` only |
| SMS log (user-facing) | no user-facing list; only the review hooks above and the detector hooks | | | | | |
| Goal allocation runs | `limit(1500)` `period desc`, `sharedFetch` 60 s | backend | 1500 | Yes | silently drops oldest runs beyond 1500 | `period` not unique; harmless for grouping |
| Net-worth snapshots | `limit(450)` `day asc`, 400-day window | backend | 450 | Yes | n/a | unique per (user, day, currency, basis) |
| Buddgy chat history | no server read: chats are device-local (`useBuddgyChats`, `savedChats.ts`: `MAX_CHATS = 50`, `MAX_ITEMS = 80`, localStorage) | client | 50 chats x 80 items | Yes | n/a | sorted by `updatedAt` in memory |
| Devices | `select('*')`, no limit, `last_seen_at desc` | backend | live devices (cap `MAX_LIVE_DEVICES = 20`) plus revoked rows (not in that cap; `upsertSelf` reads all) | Practically | n/a | `last_seen_at` |
| Purchase history (Pro page) | `BillingHistory` slices client-side (`BillingHistory.tsx:35`) from `entitlements_state` | backend RPC | decided in SQL (not audited) | unknown | unknown | unknown |

Summary: server paging for the money lists does not exist because the architecture is whole-snapshot sync. No list uses `OFFSET`. Every list that has a `limit` is bounded but offers no way to reach older rows (no cursor) and orders on a non-unique key.

---

## 6. Aggregations done in JS that the database could do

### W2a-17 (P2, proven, M) Server crons and routes aggregate full row sets in JS; client recomputes per instance
- Month-carry: `cycleCarryFigures(...)` (`carryCycle.ts:92-101`) sums a cycle's expenses, income events and deposits after pulling every row (`select('*')`, paged 1000), and again for each of 3 prior cycles (W2a-05). `GET /api/savings/carry` repeats it per user tap.
- Notification cron: `normalizeRuns`, `median`, per-goal balance sums over bulk-prefetched small rows (`cron/notifications/route.ts:215-250`): acceptable.
- `fetchHeldStockTickers`: distinct in JS over all holdings (W2a-13).
- Client: `useMonthlyStats` has 14 call sites, each with its own `useMemo` (`useMonthlyStats.ts:57-87`), recomputing `computeMonthlyStatsShared` over the whole `expenses`, `incomeEvents` and `savingsTransactions` arrays whenever any listed store slice changes. With several instances mounted on a screen and a growing history, work scales with instances x history, and each sync pull that touches `expenses` triggers all of them. Net worth is also computed from the full store (`useNetWorth`).
- Fix: server: one RPC returning `sum(amount) group by currency, kind` for a cycle. Client: one shared derived store for the stats keyed by `monthFilter`, with instances reading it. Measure before changing: client cost depends on history size, which this audit did not measure.

---

## 7. Cron jobs

| Job | Shape | Per-user loop? | Time budget | Cursor / resume | Verdict |
|---|---|---|---|---|---|
| `cron/notifications` (hourly via pg_cron `notifications-hourly`) | `notification_due_users` RPC returns due users in pages of 500, bulk prefetch per 96 users (`allRowsIn`: 100 ids per `in`, 1000 rows per page), 8 users in parallel | alerts per user; writes only for users with alerts | `TIME_BUDGET_MS = 48_000` | stored in `platform_settings.notification_cron_cursor`, resumable | Good model (Strengths). Remaining: `select('*')` (W2a-16); `emitNotification` is sequential per alert with 4+ round trips (insert, 3 push lookups, FCM, possible delete), bounded by alert count |
| `cron/month-carry` (daily) | all `user_settings` rows, page 500, one user at a time | Yes, W2a-01 | `TIME_BUDGET_MS = 50_000` | `?after=` only, not stored | candidate RPC, stored cursor, concurrency |
| `cron/prices` (daily) | `runPriceRefresh` + `harvestLegacySms(…, 500)` (capped to `BATCH = 200`) | no | 60 s function limit | none | `fetchHeldStockTickers` unbounded (W2a-13); sequential Finnhub quotes |
| `cron/sms-harvest` (daily) | `harvestBatch` up to 5 batches, then `sweepMaskedStores` over 3 tables | per-row updates | batches 40 s, sweep 55 s | none | W2a-07 |
| `cron/loyalty` (daily) | 3 RPCs (`loyalty_grant_founders`, `loyalty_close_periods`, `rewards_daily` with `p_budget_ms: 20_000`) | set-based in SQL | 20 s in SQL | in SQL | Good |
| `cron/data-retention` (daily) | one UPDATE ... RETURNING id | no | none | none | W2a-14 |
| `cron/ios-crashes` (daily) | fetch App Store Connect, 2 RPCs per crash | per crash | none | none | W2a-10 |
| `cron/sms-canary`, `cron/integrations` | single probe / `drainOutbox(…, 20)` | no | n/a | n/a | fine |
| pg_cron jobs (`sms-tick`, retention, housekeeping, ...) | in SQL | n/a | SQL not audited here | | covered by `DB_SCALING_PLAN` |

### W2a-07 (P2, potential, M) `sweepMaskedStores` rescans whole tables daily and may never complete
- File: `src/lib/sms/remaskStores.ts:43-71`; caller `src/app/api/cron/sms-harvest/route.ts:50-54`.
- Code: for each of three stores (`sms_corrections.redacted_body`, `sms_parse_log.masked_body`, `sms_tracking_templates_ai.template_sample`): `select('id, col').not(col,'is',null).order('id').limit(200)` in a keyset loop, one `UPDATE` per changed row, one JS `scanForLeaks` per row.
- Problem: every run walks every non-null masked row from the start (no resume cursor), 200 rows per round trip, with per-row updates when the masker version changed. The loop stops at 55 s and returns `complete: false`; the `sms_leak_scan_passed_at` stamp is earned only on a complete sweep (`route.ts:54`). `sms_parse_log` grows with SMS volume (raw bodies purge at 30 days, masked bodies stay), so once the walk no longer fits the window the stamp that unlocks raw-text retention is never earned. A function of table growth, not measured.
- Fix: persist a resume cursor per store in `platform_settings`; visit only rows whose `masked_version` is behind (`WHERE masked_version < $current`); re-mask set-wise in SQL where possible; keep a rolling leak scan instead of a full re-scan.

---

## 8. Client write path

### W2a-08 (P2, potential, M) Upserts are not chunked; id lists in `in(...)` are not chunked
- File: `src/lib/supabase/remote/sync.ts:111-139` (`upsert` -> one `this.from(table).upsert(batch, { count: 'exact' })`), `:190-218` (`delete`/`tombstone` with `.in('id', ids)`).
- Problem: a flush sends every changed row of a table in one request. A first sign-in with imported or restored history, or a long offline stretch, produces one multi-thousand-row POST (payload and statement-time risk). A row-level error triggers recursive bisection (`write(batch.slice(0, mid)); write(batch.slice(mid))`): one bad row in a batch of N costs about 2 log2(N) extra requests, and if many rows fail (a bad migration) up to about 2N-1. `delete` and `tombstone` put every id in the URL (`.in('id', group)`): a bulk delete of a few hundred rows can exceed URL limits and fail wholesale. `DB_SCALING_PLAN.md` F3 lists "no batch-size cap" as known, and no chunking exists in `src/lib/supabase/remote/*.ts` or `src/components/sync`.
- Fix: cap batches at 200-500 rows per request and chunk id lists at 100; keep bisection only for row errors inside a chunk.

---

## Notable things done right (strengths)

- Delta sync with a cheap probe: `hasChangesSince` (`delta.ts:102`), `sync_changed_since` with early-exit `EXISTS` per table, `needs_full` guard at 60 days, tombstones for cross-device deletes, resume throttled (`RESUME_THROTTLE_MS`), Realtime reduced to a broadcast nudge (`AppShell.tsx:206-222`) instead of a change-feed.
- Indexes added for the probe: `(user_id, updated_at)` on 5 high-volume tables (`0330`) plus BRIN on `updated_at` (`0332`); partial indexes on `sms_parse_log` (`format_key`, hash index on `masked_body`, pairing, expense/income links).
- Notification cron: set-based candidate RPC with cursor, bulk prefetch through `allRowsIn` (bounded `in` lists, paged 1000), concurrency 8, time budget, persistent cursor ("S8C-07: never one per user").
- Loyalty cron delegates to set-based SQL with an in-SQL time budget.
- SMS ingest: one claim insert relies on the unique index for idempotency (no pre-select), curated templates from a 60 s in-memory cache (`curatedDbCache.ts`), keyed template lookup with `limit(10)`, background work in `after()`.
- Client read hygiene: `sharedFetch` TTL plus in-flight de-dupe on SMS detectors and goal runs, a reference-counted resume listener for asset prices, debounced price self-heal (`claimPriceRefresh` is one atomic conditional UPDATE), buffered analytics (`analytics_touch`), net-worth snapshot gated to one upsert per day.
- Bounded reads with `limit` and index-friendly filters on most list endpoints (notifications 80, tickets 50, board 100, thread 200, SMS review 20, snapshots 450); `GET /api/notifications` counts unread in the database instead of counting the page.
- Local JWT verification on hot routes (`resolveApiUserId`); `isAccountActive` caches the ban check for 60 s.
- Buddgy chat history kept on the device with hard caps (50 chats x 80 items): no server read path to scale.
- Single-RPC screens: `entitlements_state` (Pro, usage, rewards, history in one call), `ai_quota_status`, `balance_view`, `referral_my_summary`.
- Caches already built for other settings: `platformCache.cachedSetting` (5 min, tagged), `clientGate.getMinVersions` (60 s), spark products (5 min), billing switch.
- Keyset pagination where rows are scanned in bulk: `fetchLive` (id), `month-carry` user scan (`gt('user_id')`), `sweepMaskedStores`, `notification_due_users(p_after, p_limit)`.

---

## Checked and not reported

`sms/parse/route.ts` (about 12 distinct queries on the hot path, mostly point lookups with indexes), `sms/flag-action`, `sms/own-transfer`, `sms/confirm`, `sms/undo`, `push/register`, `devices/[id]`, `billing/*`, `referrals/redeem`, `analytics/onboarding`: single-purpose, user-initiated, bounded loops. Not read in depth: `sms/dismiss`, `sms/ack`, `receipt/scan`, `ai/route.ts`, `buddgy/turn` DB use (quota RPCs only), `lib/sms/{refundMatch,matchSalary,captureGuard,balanceReport,matchSubscription,walletBrand}.ts` (point lookups by id, or by user plus a narrow filter).

To verify live with `EXPLAIN` (project rule; migrations do not show an index): the per-SMS category lookup `expenses ... ilike('description', ...)` filtered by `user_id` (`lib/sms/merchantCategoryCache.ts:104-114`), `(user_id, expense_date)` on `expenses` and `(user_id, received_date)`/`occurrence_date` on `income_events` for `loadCycle`, and `(user_id, account_last4)` on `sms_parse_log` for `providerCascade.ts:145`. These may be covered by baseline indexes outside the migrations folder.

## Suggested order

1. W2a-03 (small fix, wrong result today), W2a-04 (cache plans and flags), W2a-08 (cap batches).
2. W2a-01 and W2a-05 together (month-carry / `loadCycle`): one refactor serves both.
3. W2a-02: design a paged first pull and make the delta catch path less eager to fall back.
4. W2a-06, W2a-18, W2a-12, W2a-13, W2a-11, W2a-07, then the P3 items.
