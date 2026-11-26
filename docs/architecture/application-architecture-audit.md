# Application architecture audit (main app and admin portal)

Date: 2026-11-26. This report covers phases 1, 6, 7, 8, 10 and 11, and holds the [finding register](#8-finding-register). The database side is in [database-performance-audit.md](database-performance-audit.md), which also defines the severity scale and the evidence labels (**Measured / Proven / Potential / NOT VERIFIED**) used here. Raw evidence: [`_work/`](_work/). Diagrams: [architecture-diagrams.md](architecture-diagrams.md).

## 1. Architecture (Phase 1)

| | Main app | Admin portal |
|---|---|---|
| Framework | Next.js 16.4 / React 19.2, client-rendered app shell (`AppViewRouter`, 33 views statically imported), zustand 5 store persisted to localStorage | Same deployment; lazy-loaded `AdminApp`, served on `admin.buddget.app` through a host rewrite in `src/proxy.ts` |
| Native | Capacitor static export (`npm run cap:build`); the bundle ships inside the app and calls the same API | Native admin uses the `X-Admin-Session` header |
| Data access | Device: supabase-js to PostgREST under RLS (sync RPCs, CRUD). Server routes: service-role client | Service-role only, through 45 `/api/admin/*` routes behind `guardAdmin` |
| Auth | Supabase Auth (email OTP, password, Google and Apple id-token on native), biometric local lock, optional 2FA gate in the DB | Separate staff sign-in: email + scrypt password + emailed code, hashed opaque session (12 h, 60 min idle), CSRF header, step-up for dangerous actions |
| Background | pg_cron x16 (SMS tick, notifications, retention, rollups), Vercel cron x7 (prices, SMS harvest and canary, iOS crashes, data retention, month-carry, loyalty) | Metrics refreshed on view (the cron was removed in migration 0300) |
| Storage | Receipts device-local (Filesystem, 60-day cleanup); support attachments in a private bucket with signed URLs; avatar inside `profiles` ([F-05](#f-05)) | Reads support attachments through signed URLs |
| Integrations | Gemini and Groq (AI, voice), RevenueCat (billing webhooks), Resend (email), FCM/APNs (push), FX, gold and Finnhub prices, Sentry | Linear outbox (drain intentionally unscheduled since QA-57) |
| Hosting | Vercel fra1; Supabase eu-central-1 | Same |

Shared: one database, one deployment and one service-role key. Admin load runs on the same serverless instances and the same database CPU as user traffic. At the current scale this is the right choice. Isolation would only become worthwhile once heavy admin reports exist (see the roadmap, Phase C).

## 2. Data-loading flows

- **Boot:** render from the persisted store, then `sync_changed_since` (cheap per-table `EXISTS` probe), then `sync_pull_v2(p_since)` when something changed. A full pull happens on first sign-in, when the cursor is more than 60 days old, or on any delta error ([F-10](database-performance-audit.md#f-10)).
- **Writes:** dirty rows are flushed per table, tiered for FK order, with one upsert per table and no batch-size cap ([F-15](#f-15)).
- **Other boot calls run concurrently, not as a chain:** `/api/app-config` (CDN-cached), `/api/entitlements/me` ([F-01](database-performance-audit.md#f-01)), `/api/flags` (de-duplicated per page load; [F-03](database-performance-audit.md#f-03)), `/api/notifications` ([F-21](database-performance-audit.md#42-n1-and-round-trip-findings)), the device heartbeat (every 4 h), and rates and gold (TTL-gated).
- **Realtime** is reduced to a broadcast "nudge" that triggers a delta pull, with no change feed.
- **Admin:** each view calls one or more `/api/admin/*` GETs. Every request pays the guard: a session lookup, a GoTrue `getUserById` over HTTP, and the staff and role reads, with a 5 s per-instance cache.

## 3. Image and file optimisation (Phase 6)

| Source | Pipeline | Delivery | Verdict |
|---|---|---|---|
| Receipt photos | Native scanner or camera, then a client canvas resize to a longest edge of 1800 px, JPEG q0.8 (`src/lib/native/cameraScanner.ts:157-185`). Max 5 images and 4 MB total; server checks `Content-Length`, type allow-list and count (`src/app/api/receipt/scan/route.ts:103-257`) | Sent inline to the AI model, **never stored server-side**; saved on the device, 60-day cleanup | Strong. Only page 1 of a multi-page scan is saved (`ReceiptScanSheet.tsx:266`): a product question. The MIME type is taken from the client ([F-26](#f-26)) |
| Avatar | Cropped 512 px JPEG q0.86 (`src/lib/profile/avatarPhoto.ts`) | Stored as a data URL in `profiles.avatar_image_path`, synced with `select('*')` | [F-05](#f-05) |
| Bank and provider logos | Static files in `public/` | Raw `<img>` in fixed-size boxes (no CLS), `onError` monogram fallback, not lazy | Oversized: `banquemisr.svg` and `nbe.svg` 114-118 KB, `valu.png` 269 KB for a tile of about 40 px ([F-17](#f-17)) |
| Subscription icons | 135 WebP files, 2.9 MB | `next/image` with width and height; `unoptimized` on native | Files far larger than the 40-72 px they render at |
| Marketing screens | WebP, up to 267 KB | `next/image` `PhoneShot` with dimensions and `sizes`, `priority` opt-in, but `unoptimized` on web too | The optimiser is bypassed on web |
| Support attachments | 4 files, 5 MB, 5 MIME types; the bucket re-checks | Private bucket, signed URLs, `loading="lazy"` | Strong |
| Buddgy art | `public/buddgy/buddgy-square.png` 494 KB, `buddgy-cutout.png` 332 KB | No reference from `src/` (verified by grep; only an old QA doc names them) | Likely dead weight in every native build |

`public/` holds 9.6 MB and ships in every native build. On native, image weight costs binary size and decode time, not download. On web, Vercel serves `public/` from its edge. The admin portal shows no user images apart from signed support attachments, so its handling matches the main app's.

## 4. Frontend performance (Phase 8)

Strengths: cache-first instant boot, an in-memory view shell (removes route-fetch latency and the WebView "wedge"), lazy Buddgy chat, charts (`recharts` only loads on Reports), admin and modal sheets, debounced persistence that is flushed on hide, `useShallow` in 86 files guarded by a test, foreground-only polling, a day-paged ledger, and in-flight de-dupe (`sharedFetch`, `useFeatureFlag`).

| Item | Evidence | Assessment |
|---|---|---|
| Main bundle holds all 33 shell views (`AppViewRouter.tsx:6-62`) | Proven, by design | The trade-off is documented. **Measure with the bundle analyser before changing.** Candidates for lazy loading: rarely used settings leaves, `/budget-setup`, `/start`, `/budget-history`. Effort H, regression risk on WebView navigation |
| `useMonthlyStats` recomputed per instance (14 call sites) over the whole history | Proven | Cost grows with instances x history; measure on a large seeded account first (LOW) |
| Large lists | No virtualisation; month and day filters bound the DOM | Fine for now |
| Skeleton, empty and error states | `EmptyState` (22 users), `SkeletonList`, route `loading.tsx` and `error.tsx`, `SheetFallback`, `SyncFailureBanner` | Primitives exist and are reused. Per-view consistency was not checked exhaustively (NOT VERIFIED); some views may show zeros while hydrating instead of a skeleton |
| Duplicate requests | `useNotifications` fetch is written twice and depends on the `user` object | F-21c |
| Admin tables | Server-paged; the client holds one page; 15 s response cache | Stale after writes ([F-12](#f-12) notes) |

## 5. Caching strategy (Phase 7)

| Layer | Data | TTL / invalidation | Isolation |
|---|---|---|---|
| `unstable_cache` via `cachedSetting` (`src/lib/server/platformCache.ts`) | Platform settings, AI runtime and pricing, billing switch, Sparks products | 300 s, tag `platform-settings`, invalidated after admin writes; errors never cached | Global data only: safe |
| In-memory per instance | Minimum app version (60 s), daily AI spend (60 s), account-suspended verdict (60 s, by user id), second-factor verified (60 s, by session id), admin staff (5 s), email templates (5 min) | TTL; invalidation applies to the writing instance only | Keyed per user or session: safe |
| CDN `Cache-Control` | `/api/rates` (2 h + 4 h stale-while-revalidate), `/api/gold` (15 min), `/api/app-config` (60 s) | TTL | Public data, reads no cookies: safe. Cache-busting query strings bypass it ([F-18](#f-18) note) |
| `private, no-store` | Every per-user route | n/a | Correct |
| Client | Persisted zustand store, flag memo, 15 s admin response cache, service worker (hashed static assets only; never `/api` or pages) | Reset hooks on account switch and lock | Per device: safe |

**Verdict:** no private data was found under a shared cache key. The one clear gap is [F-03](database-performance-audit.md#f-03) (plans and flags). Redis is not justified. Opportunities:

| Data | Today | Suggested layer, TTL and invalidation |
|---|---|---|
| `plans`, `feature_flags` | DB read per call | `cachedSetting`, 60-300 s, invalidated by the admin write routes (F-03) |
| FX and gold upstream crawl | CDN only | Optional `unstable_cache` around the provider chain (15-60 min) so cache-busting cannot multiply upstream calls (LOW) |
| Admin metrics | DB cache table refreshed inline | Restore a schedule and serve stale-while-revalidate ([F-12](#f-12)) |
| Brand catalogue, categories | Static in code | Nothing to do |

## 6. Throttling and API protection (Phase 10)

Mechanisms:
- A shared Postgres counter, `api_rate_hit` (one upsert per guarded request; hourly cleanup cron).
- A memory-first proxy limiter for `/api/gold` and `/api/rates` (240 per 60 s per IP, falling back to the shared counter after 120 hits per instance).
- A layered AI quota (`ai_quota_reserve_v2`: rate, hourly, daily, 5 h, 24 h and 7 d windows, per feature) plus a global daily spend cap.
- An anti-spoof client IP helper with IPv6 /64 bucketing (`rateBucketIp`), which only some routes use.

Limited today: check-email (fail closed), site lead and site event, feedback, support (submit, attachments, thread, vote), referral redeem (per user and per IP), billing sync, push send, SMS parse (1200/h, answers 503 with `Retry-After` on a counter outage), SMS setup token, biometric sign-in, re-auth, account delete, savings carry, `/api/ai`, admin sign-in, step-up and per-action admin limits.

Gaps:
- [F-09](#f-09): AI routes have no burst limit, and the receipt body is read before the quota check.
- [F-06](#f-06): the admin sign-in IP key ignores the IPv6 /64.
- [F-07](#f-07): lockout DoS on staff accounts.
- [F-18](#f-18): DB write per request on the public site endpoints.
- `/api/prices/refresh` has no IP limit (debounced in the DB; LOW).
- No general per-staff limit on heavy admin GETs (LOW: one generous per-staff bucket would not hinder legitimate bulk work, since there is no batch endpoint apart from `bulk_toggle`).
- Supabase Auth's own OTP and sign-in limits are configured in the dashboard: NOT VERIFIED from code.

Correct layer: limits sit in the route or proxy, keyed per user for authenticated routes and per IP for public ones, and are shared across instances through Postgres (or memory-first for very hot public data). That is appropriate for Vercel serverless; no distributed cache is required.

## 7. Main app vs admin portal (Phase 11)

| | Main app | Admin portal |
|---|---|---|
| Current architecture | Offline-first full-snapshot sync, RLS, per-user data | Service-role reads behind one guard, server-paged lists, cached aggregates |
| Key performance risks | F-01 entitlements read; F-10 full pulls; F-03 uncached plans and flags; F-11 month-carry cron; F-02 instance tail | F-12 inline metrics refresh; F-13 directory search with wildcard, count and OFFSET; guard cost per request (4-5 round trips) |
| Key security risks | F-05 avatar size; F-09 body before gate; F-26 MIME sniff | F-07 lockout DoS and staff enumeration (with F-06); F-08 audit after action; F-20 bulk toggle and in-app confirm |
| Strengths | Delta sync with a probe; cache-first boot; device-local receipts; layered AI quota; no `OFFSET` anywhere | Permission per operation on all 45 routes; DB-enforced owner immutability and append-only audit; PII masking; keyset on audit and leads; advisory-lock single refresher |
| Recommended now | F-01, F-03, F-04, F-10a | F-07 + F-06 |
| Shared or app-specific | F-03 cache, F-02 compute and F-16 tie-breakers are **shared**. Everything else is app-specific | Admin needs its **own** data-access style (server paging, keyset, cached totals); it must not reuse the main app's full-snapshot model. **Separate databases are not needed** |

## 8. Finding register

All findings, most severe first. "Act" says whether to act now or wait for metrics. Details for findings owned by this report follow the table; DB findings link to the [database report](database-performance-audit.md#10-findings-in-this-report).

| ID | Sev | Area | App | Location | Finding | Evidence | Effort | Act |
|---|---|---|---|---|---|---|---|---|
| [F-01](database-performance-audit.md#f-01) | HIGH | Database | Main | `entitlements_state`, `api/entitlements/me/route.ts:75` | Read path does upkeep writes; mean 433 ms | Measured + Proven | M | Now |
| [F-02](database-performance-audit.md#f-02) | MEDIUM (provisional) | Infra | Both | Supabase compute | Instance-wide tail latency; cause unconfirmed | Measured, cause NOT VERIFIED | S | Measure now |
| [F-03](database-performance-audit.md#f-03) | MEDIUM | Backend | Both | `lib/entitlements/server.ts:7-20`, `api/flags/route.ts:22-28` | Plans and flags read on every call | Proven | S | Now |
| [F-04](database-performance-audit.md#f-04) | MEDIUM | Database | Main | `hooks/useSubscriptionDetector.ts:44-55` | Ascending, no limit: drops the newest rows past the cap | Proven | S | Now |
| [F-05](#f-05) | LOW | Security/Storage | Main | `profiles.avatar_image_path`, `validImageDataUrl.ts:6` | Avatar data URL with no DB cap, synced on full pulls and profile deltas | Measured (164 KB, 0 CHECK) + Proven | S-M | Near term |
| [F-06](#f-06) | LOW | Security | Admin | `lib/server/admin/guard.ts:126` | Sign-in IP throttle ignores the IPv6 /64 (widens F-07) | Proven (verified) | S | With F-07 |
| [F-07](#f-07) | MEDIUM | Security | Admin | `src/lib/admin/credentials.ts`, `auth/code/route.ts:43-56` | Anyone can lock out a staff account whose email is known; the lockout reply also reveals that an address is staff | Proven (verified) | M | Now |
| [F-08](#f-08) | LOW | Security | Admin | `users/[id]/route.ts:116`, `audit.ts` | Audit result ignored after destructive actions; fails open only on a DB error | Proven | M | Near term |
| [F-09](#f-09) | LOW | Backend | Main | `api/receipt/scan/route.ts:239-290` | Up to 4 MB parsed before the plan gate and quota (a per-minute rate layer already exists) | Proven | S | Near term |
| [F-10](database-performance-audit.md#f-10) | MEDIUM | Database | Main | `0142_sync_pull.sql`, `SupabaseFinanceSync.ts:757-762` | Unbounded full pull; delta error demotes to it | Measured + Proven | S-M / H | (a) now |
| [F-11](database-performance-audit.md#f-11) | MEDIUM | Backend | Main | `cron/month-carry/route.ts:185-252` | Sequential per-user cron, no stored cursor | Proven, Potential | M-H | Before the low hundreds of users |
| [F-12](#f-12) | LOW | Admin | Admin | `lib/server/admin/metrics.ts:32-37`, `0300` | Metrics recompute inside an admin request; docs stale | Proven | S | Near term |
| [F-13](#f-13) | LOW | Admin/DB | Admin | `admin_user_directory`, `users/route.ts:12,30`, `useAdminLiveSearch.ts` | Wildcard OR search, full count, OFFSET to 1M, per-user subqueries | Proven, Potential | M | Trigger |
| [F-14](database-performance-audit.md#f-14) | LOW | Database | Both | 405 indexes | Over-indexing; 4 strict-prefix duplicates | Measured | S | Near term |
| [F-15](#f-15) | LOW | Backend | Main | `remote/sync.ts:111-218`, `unplacedForTail.ts` | Upserts not chunked; `in(...)` lists not chunked (one silent failure) | Proven | M | Near term |
| [F-16](database-performance-audit.md#f-16) | LOW | Database | Both | `sms/logs`, `emails/log`, notifications, board | No unique tie-breaker on sort or cursor | Proven | S | Near term |
| [F-17](#f-17) | LOW | Storage | Both | `public/` (9.6 MB) | Oversized logos and icons; unreferenced Buddgy PNGs | Measured sizes | S | Near term |
| [F-18](#f-18) | LOW | Backend | Main | `lib/server/rateLimit.ts`, `site/event` | One DB write per limited request, including public endpoints | Measured (11.9k calls, max 26 s) | M | Near term |
| [F-19](#f-19) | LOW | Backend | Main | `api/auth/welcome/route.ts`, `AuthProvider.tsx:241-256` | Failed send gives the claim back; client retries with no backoff | Measured incident (3,410 failures, 18-19 Nov) | S | Near term |
| [F-20](#f-20) | LOW | Security | Admin | `sms/templates/route.ts:80-87`, `stepUp.ts:28` | Table-wide `bulk_toggle` without step-up; in-app confirm for delete and reset | Proven | S | Near term |
| F-21 | LOW | Backend | Main | see [DB §4.2](database-performance-audit.md#42-n1-and-round-trip-findings) | Repeated reads (SMS payment methods, push, notifications, crash cron) | Proven | S-M | Near term |
| F-22 | LOW | Backend | Main | see [DB §4.3](database-performance-audit.md#43-unbounded-or-truncating-reads) | Cron sweeps without cursors or caps | Proven, Potential | M | Trigger |
| [F-23](database-performance-audit.md#f-23) | LOW | Database | Admin | `admin_audit_log` | No retention | Measured (379 rows) | M | Trigger |
| [F-24](#f-24) | LOW | Admin | Admin | `lib/server/userData.ts:189-224` | Wipe and export unbatched, no `maxDuration` or statement timeout | Proven, Potential | M | Trigger |
| [F-25](database-performance-audit.md#f-25) | LOW | Database | Admin | `check_sms_promotion_eligibility` | No `(sender, created_at)` index | Measured (no index) | S | Trigger |
| [F-26](#f-26) | LOW | Security | Main | `api/receipt/scan/route.ts:254-257` | MIME type trusted from the client | Proven | S | Near term |
| [F-27](#f-27) | INFO | Docs | Both | `docs/SCHEDULED_JOBS.md`, `docs/ADMIN_PORTAL.md` | Docs drift (region, integrations cron, staff cache, metrics cron) | Proven | S | Near term |
| [F-28](#f-28) | INFO | Security | Both | Supabase advisors and Auth | Definer ownership checks, anon definer, leaked-password protection, Auth limits | Measured advisors; Auth NOT VERIFIED | S | Review |
| [F-29](#f-29) | INFO | Security | Admin | `guard.ts` `allowAttempt` | Admin sign-in fails closed when the rate-limit RPC errors, so a DB stall locks all staff out | Proven | S | Review |

Counts: 1 HIGH, 6 MEDIUM (F-02 provisional), 19 LOW, 3 INFO.

Separated by kind:
- **Confirmed defects:** F-04, F-06, F-07 (including the staff-existence leak), F-15 (the silent `in()` failure), F-19 (past incident).
- **Measured bottlenecks:** F-01; F-02 (cause unverified).
- **Code-level risks:** F-03, F-05, F-08, F-09, F-10, F-12, F-18, F-20, F-21, F-26, F-29.
- **Future scalability:** F-11, F-13, F-22, F-23, F-24, F-25.
- **Optional:** F-14, F-16, F-17, F-27.
- **Cannot verify:** HA, backups and PITR; Auth rate limits; PostgREST max rows; bundle size; real-device frame timing.

Refuted during cross-checking: three "missing index" leads from the code audit (the indexes exist on live, [DB §5](database-performance-audit.md#5-indexing-strategy-phase-4)). The `welcome_email_sent_at` write volume is not a missing guard (F-19). The integrations cron is unscheduled on purpose (F-27).

Independent re-check (Wave 4, a fresh Sonnet pass over the code, [`_work/W4-verification.md`](_work/W4-verification.md)) changed:
- severities: F-05, F-06, F-08 and F-09 from MEDIUM to LOW; F-02 marked provisional;
- added F-01's per-read row lock, F-07's staff-existence leak, `sync_pull_v2` writing on every pull (in F-10), and F-29;
- corrected F-03's cost and fix, F-04's fix, and F-11's round-trip shape;
- removed an F-12 claim.

<a id="f-05"></a>
### F-05 LOW · Security/Storage · Main: avatar data URL with no server-side size cap
- **Location:** `src/lib/profile/validImageDataUrl.ts:6` (a client-side validator allowing up to 8,000,000 characters), `profileMapper.ts:47,84`, `remote/sync.ts:547,598` (`profiles` with `select('*')`), `0142:48` (the profile is returned on any delta where it changed).
- **Evidence:** Measured: one avatar stored at 163,743 characters; no CHECK constraint on `profiles` mentions the avatar. Proven: RLS lets a user update their own profile.
- **Risk:**
  - A modified client can store several MB in its own row.
  - That row travels on every full pull and every profile delta, and is persisted to localStorage, which has a quota.
  - Only the row's owner is affected; server reads that name their columns (for example the welcome route) do not load it.
  - This makes it a hardening gap, not a shared performance risk.
- **Fix:**
  - Now: lower the validator to about 300 KB and add `CHECK (length(avatar_image_path) < 300000)` (a migration; check the row counts first).
  - Later: upload to the existing `avatars` bucket and store the path (the column is already named `_path`).
- **Complexity:** S (cap), M (bucket). **Risk:** an existing oversized row would fail the CHECK; add it `NOT VALID` first, then validate.

<a id="f-06"></a>
### F-06 LOW · Security · Admin: sign-in IP throttle keyed on the raw IPv6 address
- **Location:** `src/lib/server/admin/guard.ts:126`: ``allowAttempt(service, `admin-signin-ip:${clientIp(req)}`, 900, 40)`` (verified).
- **Evidence:** Proven. `rateBucketIp` (IPv6 /64) exists in `lib/server/clientIp.ts` for exactly this and is used by check-email.
- **Why LOW:** password guessing is already bounded per account (5 failures, then a 15-minute lockout, plus per-user code limits). What the bypass lifts is the per-IP cap on F-07's lockout DoS and on address probing, so fix it together with F-07.
- **Fix:** `rateBucketIp(clientIp(req))`, plus a test. **Complexity:** S. **Risk:** none (stricter grouping).

<a id="f-07"></a>
### F-07 MEDIUM · Security · Admin: account lockout usable as denial of service
- **Location:** `src/lib/admin/credentials.ts` (`recordFailure`), `src/app/api/admin/auth/code/route.ts:43-56`.
- **Evidence:** Proven: 5 wrong passwords lock an account for 15 minutes, and this can be repeated. The owner email is a constant in `src/lib/admin/permissions.ts` and in the docs. Also proven (verified): a locked staff account gets a distinct 429 "Too many failed attempts", while a non-staff address always gets the uniform 401. So five bad passwords reveal that an address belongs to staff, contradicting the route's own uniform-error intent.
- **Risk:** a stranger can keep the owner and staff locked out of the portal. Step-ups share the lockout. Staff addresses can be enumerated.
- **Fix:** key failures on account plus IP bucket (with F-06), make the lockout progressive, keep a trusted-device or biometric path open, email the account when it is locked, and return the uniform 401 for a locked account too. **Complexity:** M.

<a id="f-08"></a>
### F-08 LOW · Security · Admin: destructive actions can succeed with no audit row
- **Location:** `src/app/api/admin/users/[id]/route.ts:116` (`await log(...)` result unused on delete, reset, suspend and role change), `lib/server/admin/audit.ts`. `auditPiiRead` skips the audit when its rate-limit RPC errors (`credentials.ts:50-55` returns false).
- **Evidence:** Proven. Only DSR export and SMS reveal check that the audit was written. A staff member cannot trigger the gap on purpose: it fails open only on a database error between the action and the audit insert. Destructive actions also pass `stepUp`, which writes its own audit row.
- **Fix:** write an "intent" audit row before irreversible operations and refuse if it fails (the DSR pattern), or do the mutation and the audit in one SQL function. Treat an RPC error in `auditPiiRead` as "log anyway". **Complexity:** M.

<a id="f-09"></a>
### F-09 LOW · Backend · Main: the receipt body is parsed before the plan gate and quota
- **Location:** `src/app/api/receipt/scan/route.ts:239-290`.
- **Evidence:** Proven.
  - A per-minute burst limit does exist: `ai_quota_reserve_v2` has a `rate` layer (`ai_req_per_min`: 10 free, 20-30 paid; `0290:122`, `0296:41`, `0298:86`), covering voice, Buddgy and budget AI as well.
  - The body size is capped by `tooLargeByHeader` before parsing.
  - The remaining gap is that up to 4 MB of multipart is parsed before the plan gate and the rate layer run.
- **Fix:** run `requireFeature` and `reserveAiQuota` (estimating from `Content-Length`) before calling `formData()`. **Complexity:** S.

<a id="f-12"></a>
### F-12 LOW · Admin: metrics refresh runs inside an admin request
- **Location:** `src/lib/server/admin/metrics.ts:32-37`; migration `0300_db_load_phase_a.sql:28-56` removed the cron.
- **Problem:** the first admin load after 15 minutes waits for 8 aggregates, including 12-way `count(DISTINCT user_id)`; `pg_try_advisory_xact_lock` (`0300:46-52`) ensures only one refresher runs. At 58 users this is cheap; it grows with the tables.
- **Fix:** a 30-60 min pg_cron refresh, stale-while-revalidate on view, and `SET LOCAL statement_timeout`. Also fix `docs/ADMIN_PORTAL.md`. Related: the 15 s client cache shows stale lists after admin writes (`adminClient.ts:73-123`); add `invalidate(prefix)` from `useAdminAction`. **Complexity:** S.

<a id="f-13"></a>
### F-13 LOW · Admin/DB: user directory search and paging
- **Location:** `useAdminLiveSearch.ts:10-35` (a request per keystroke, 250 ms debounce), `src/app/api/admin/users/route.ts:12,30`, `admin_user_directory` (`0131` and the `0246` patch).
- **Problem:**
  - A leading-wildcard `ILIKE` OR'd across `auth.users.email` (no trigram index), the `profiles` names and a JSON field.
  - A whole-set `count(*)` even for 5-row type-ahead.
  - `OFFSET` up to 1,000,000 with `created_at` as the only tie-break.
  - Sorting by expenses or activity runs a correlated subquery for every user.
- **Fix:** a lean type-ahead RPC (prefix match on `profiles`, id equality, limit 6, no count), keyset `(created_at, id)`, the cached total from `admin_overview`, and aggregates only for the page. **Trigger:** more than about 5k users, or directory p95 above 300 ms. **Complexity:** M.

<a id="f-15"></a>
### F-15 LOW · Backend · Main: client writes and id lists are not chunked
- **Location:** `src/lib/supabase/remote/sync.ts:111-139` (one upsert per table; a row error triggers recursive bisection), `:190-218` (`.in('id', ids)` for deletes and tombstones), `src/lib/accounts/unplacedForTail.ts:36-69` (a URL-length failure reads as an empty result).
- **Fix:** batches of 200-500 rows, id lists in chunks of 100, and check `error` in `unplacedForTail`. **Complexity:** M (sync code is deep-technical; tests are mandatory).

<a id="f-17"></a>
### F-17 LOW · Storage · Both: static images heavier than their display size
- Optimise the two 114-118 KB SVGs with SVGO.
- Re-export the provider PNGs (152-269 KB) as WebP at 2x their render size, and resize the 135 subscription icons (2.9 MB).
- Confirm and delete the unreferenced `buddgy-square.png` and `buddgy-cutout.png` (about 826 KB).
- Benefit: a smaller native binary and less decode work on logo-heavy screens. **Complexity:** S.

<a id="f-18"></a>
### F-18 LOW · Backend · Main: the shared rate counter writes on every limited request
- **Evidence:** Measured: `api_rate_hit` 11,915 calls, 28 ms mean, max 26 s, 2.7 WAL records per call. Proven: blocked callers still increment the counter.
- **Fix:** reuse the proxy's memory-first pattern for the unauthenticated hot paths (`site/event`, `site/lead`, `check-email`, `prices/refresh`), and add `Retry-After` to 429s. Optional: `unstable_cache` the FX and gold provider crawl so cache-busting URLs cannot multiply upstream calls. **Complexity:** M.

<a id="f-19"></a>
### F-19 LOW · Backend · Main: welcome-email retry loop
- **Evidence:** Measured: 3,410 `welcome` failures with "RESEND_API_KEY is not set" on 2026-11-18/19, against 5 delivered. The environment is NOT VERIFIED. About 16k `welcome_email_sent_at` UPDATEs in the stats window, in two statement shapes of about 8.3k (the claim) and 7.9k (the give-back).
- **Mechanism:** the route claims atomically, and a failed send hands the claim back. The client marks "asked" only on a 2xx, so it retries on every mount for 72 hours.
- **Fix:** store a short backoff (a `welcome_attempted_at` column, or a localStorage timestamp) and stop after N failures. Alert when the email key is missing at boot. **Complexity:** S.

<a id="f-20"></a>
### F-20 LOW · Security · Admin: one-click table-wide actions
- `sms/templates` `bulk_toggle` (`route.ts:80-87`) disables AI on every template, needing only `sms.manage`, with no step-up and no row count in the audit.
- Owner and admin roles pass step-up for delete and reset with `confirmed: true` (`stepUp.ts:28`, `src/lib/admin/permissions.ts:12-18`). The code marks this "TEMPORARY while the app is pre-public (BUD-94)", with a one-line revert, so the fix is simply to do that revert before launch.
- `run_auto_promote` loops over senders sequentially with no time budget.
- **Fix:** require a real factor for delete, reset and bulk toggle; write affected counts into the audit; add a time budget and cursor to the promotion run. **Complexity:** S.

<a id="f-24"></a>
### F-24 LOW · Admin: wipe and export are unbatched with no time limits
- **Location:** `src/lib/server/userData.ts:189-224`, `users/[id]/export/route.ts`.
- **Problem:** there is one `DELETE` per table, and the export builds up to 20,000 rows per table in memory. No admin route sets `maxDuration`.
- **Fix:** a batched delete RPC with a statement timeout; stream the export to Storage and return a signed URL. **Trigger:** the first account above about 10k rows in any table. **Complexity:** M.

<a id="f-26"></a>
### F-26 LOW · Security · Main: receipt MIME type trusted from the client
- **Location:** `src/app/api/receipt/scan/route.ts:254-257`.
- **Problem:** nothing is stored, so the only cost is a wasted quota reservation and an upstream rejection.
- **Fix:** check the magic bytes (JPEG, PNG, WEBP, HEIC) and return 415 on a mismatch. **Complexity:** S.

<a id="f-27"></a>
### F-27 INFO · Docs drift
- `docs/SCHEDULED_JOBS.md` lists region `sin1` and an integrations cron at 05:30. The live setup is `fra1`, and the drain has been intentionally unscheduled since commit `91acda3e` (QA-57); the outbox is empty.
- `docs/ADMIN_PORTAL.md` says the staff cache is 20 s (the code says 5 s) and that a metrics cron runs every 15 min (it was removed in 0300).
- `cameraScanner.ts:157` says 2048 px where the constant is 1800.

<a id="f-28"></a>
### F-28 INFO · Security posture items to review
- The 25 `SECURITY DEFINER` RPCs callable by `authenticated` should each be confirmed to enforce `auth.uid()` ownership.
- The anon-callable `referral_inviter_first_name` should be rate limited.
- Turn on leaked-password protection (Auth setting).
- Confirm the Supabase Auth OTP and email rate limits in the dashboard.

<a id="f-29"></a>
### F-29 INFO · Security · Admin: admin sign-in fails closed on a rate-limit outage
- `allowAttempt` in `guardSignIn` denies when the `admin_rate_hit` RPC errors, so a database stall (see F-02) locks every staff member out of the portal.
- That is a defensible security choice. Document it, and consider a narrow fail-open for an already-trusted device or biometric path.
