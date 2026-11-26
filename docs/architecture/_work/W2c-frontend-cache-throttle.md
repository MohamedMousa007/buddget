# W2c: Frontend, images, caching, throttling audit

Read-only static audit. No builds, tests, dev servers or DB queries were run. All paths relative to the repo root. "Proven" = read in code; "potential" = depends on traffic or runtime behaviour not measured. No metrics were measured; none are claimed.

## Summary table

| ID | Area | Sev | Proven? | Cx |
|---|---|---|---|---|
| W2c-01 | Throttle: authenticated unrated routes (voice, receipt, buddgy) rely only on quota RPC; body is read before quota | Med | Proven | L |
| W2c-02 | Receipt MIME validated from client-declared `File.type` only | Low-Med | Proven | L |
| W2c-03 | Receipt photo saved is page 1 only for multi-page scans | Low | Proven | L |
| W2c-04 | `/api/flags` does 3 DB reads per call, flags + plans uncached | Med | Proven (code), load potential | L |
| W2c-05 | Plans table re-read per entitlement check (every paid AI call and /entitlements/me) | Med | Proven (code) | M |
| W2c-06 | Per-isolate rate/verdict Maps do not share state across instances | Low | Proven (by design) | L |
| W2c-07 | `api_rate_hit` writes one DB row-upsert per limited request | Low-Med | Proven | M |
| W2c-08 | Unauthenticated `/api/prices/refresh` has no IP limit; each call hits DB | Low | Proven | L |
| W2c-09 | Whole shell (33 views) statically bundled into main chunk | Med | Proven (by design), cost potential | H |
| W2c-10 | Bank logos: two 114-118 KB SVGs, PNG/WebP up to 270 KB served raw via `<img>`, no `width/height` | Low-Med | Proven | L |
| W2c-11 | Avatar stored as a data URL inside `profiles.avatar_image_path`, pulled by `select('*')`; validator cap 8,000,000 chars | Med | Proven (code), size potential | M |
| W2c-12 | Hero PNGs (`buddgy-*.png` 330-490 KB, `og-*.png`) unoptimised; `unoptimized: true` on native, `<Image unoptimized>` on web | Low | Proven | L |
| W2c-13 | No `Retry-After` on 429s from shared limiter (except sms/parse 503) | Low | Proven | L |
| W2c-14 | `useNotifications` fetches in its own effect plus a second copy of the same fetch | Low | Proven | L |
| W2c-15 | Stale comment/constant mismatch: 2048px vs `MAX_EDGE = 1800` | Info | Proven | L |
| W2c-16 | Public cached `/api/gold`, `/api/rates` accept cache-busting query strings | Low | Potential | L |
| W2c-17 | Admin `adminClient` 15 s response cache is global per tab, keyed by path only (OK today) | Info | Proven | - |

## A. Images (Phase 6)

### Sources and handling

| Source | Where / format | Handling | Notes |
|---|---|---|---|
| Receipt photos | Camera / VisionKit / ML Kit scanner, gallery, web `<input capture>`; JPEG | Client canvas downscale to longest edge 1800 px, JPEG q0.8 (`src/lib/native/cameraScanner.ts:157-185`); `Camera.getPhoto` quality 80 (`:100`). Up to 5 images (`src/app/api/receipt/scan/route.ts:250`), 4,000,000 bytes total (`:103`), multipart. Stored on device only: `Directory.Data/receipts/<id>.jpg`, 60-day cleanup on boot (`src/lib/native/receiptImages.ts:9-75`). Offline captures queue in `pending-ai/<id>` (`src/lib/store/usePendingAiJobs.ts:95-143`) and are wiped on account change. | Fits the "device-local by design" rule. |
| Avatar | Cropped square 512 px JPEG q0.86 (`src/lib/profile/avatarPhoto.ts:2-81`), input up to 25 MB, types jpeg/png/webp/gif | Stored as a data URL in `profiles.avatar_image_path` (`profileMapper.ts:47,84`). Rendered with raw `<img width=96 height=96>` (`src/components/features/settings/ProfileBody.tsx:25`). `avatars` bucket is only used for removal (`src/lib/server/userData.ts:232`). | See W2c-11. |
| Bank logos | `public/logos/banks/*` svg/png (1.5 MB dir) | Raw `<img>` with `onError` monogram fallback (`src/components/features/accounts/BrandMark.tsx:~56`), no lazy, no dimensions on the `<img>` (parent box is fixed size, so CLS is contained). | Two SVGs are 114-118 KB (`banquemisr.svg`, `nbe.svg`), `qib.svg` 61 KB; PNGs up to 59 KB. |
| Provider logos | `public/providers/*` png/webp/svg (744 KB) | Raw `<img>` + `onError` (`src/components/features/debts/redesign/ProviderBadge.tsx:50`). | `valu.png` 269 KB, `aman.png` 207 KB, `tamara.png` 152 KB for a ~40 px tile. |
| Subscription icons | `public/subscription-icons/*.webp`, 135 files, 2.9 MB total, up to 158 KB | `next/image` with explicit width/height (`BrandTile.tsx`), `unoptimized` on native build. | WebP already; largest files are far bigger than the 40-72 px they render at. |
| Marketing site screens | `public/site/screens`, `public/guides/sms/*` (webp, up to 267 KB) | `next/image` `PhoneShot` with width 780, height 1688, `sizes`, `priority` prop, `unoptimized` (`src/components/site/PhoneShot.tsx:12`). | Dimensions given, so no CLS. `priority` is opt-in per use. |
| Support attachments | Private bucket `support-attachments`, signed upload/read URLs | `SignedImage` raw `<img loading="lazy">` (`.../support/SignedImage.tsx:13`). Limits 4 files, 5 MB, 5 MIME types (`src/lib/support/attachments.ts:4-22`); bucket re-checks. | Good. |
| App icons / OG | `public/icons`, `og-*.png`, `opengraph-image.png` | Static. | `icon-512*.png` ~200 KB each, `og-en.png` 268 KB. |
| Buddgy art | `public/buddgy/buddgy-square.png` 494 KB, `buddgy-cutout.png` 332 KB | Not referenced from `src` by name in my grep (possibly SVG/orb instead). | Candidate dead weight in the native bundle; verify with a reference search. |

### next/image vs `<img>` and static export
- `next/image` in 5 files only. Raw `<img>` in ~20, all with an eslint-disable and a stated reason (static logo, signed URL, data URL).
- `next.config.ts:22` sets `images: { unoptimized: true }` only inside the Capacitor branch. Web (Vercel) uses the default optimiser for `next/image` call sites that do not pass `unoptimized`; the marketing `PhoneShot` and `ReceiptScanSheet` pass it explicitly, so those bypass optimisation on web too. Hence the largest marketing images are served at source size on the web as well.
- Native is a static export served from inside the WebView (no network for images), so image size affects app binary size and WebView decode, not download time. 9.6 MB `public/` is bundled into every native build.
- CDN: the web build is served through Vercel's edge; images in `public/` are served as static assets by Vercel with its default immutable-ish caching. No `Cache-Control` override for `public/` assets in `next.config.ts` or `vercel.json`, no `images.formats` or `remotePatterns` set (none needed: no remote images).
- Lazy loading: only `SignedImage` sets `loading="lazy"`. Bank/provider logos in long lists (accounts, debts, subscriptions) are eager `<img>` or `next/image` defaults (`next/image` lazy by default). LCP images: no priority handling outside `PhoneShot`; the app shell is client-rendered, so LCP is dominated by JS boot rather than an image.
- CLS: raw `<img>` sit in fixed-size parents (`size-full object-contain`), so no layout shift in the cases read. Avatar has width/height attributes.

### Receipt pipeline findings
- Capture and compression are sound: native scanner gives perspective-corrected pages, each is re-encoded client-side to <=1800 px JPEG q0.8, which keeps a five-page set under the 4 MB cap (the comment says so).
- Server accepts only `jpeg/png/webp/heic/heif` (`route.ts:106,254-257`), 4,000,000 byte total (`:103`), `Content-Length` pre-check (`tooLargeByHeader`, `:107`, `bodyLimit.ts:4`), 5 files. Images are base64-inlined to Gemini (`:263`). Token estimate per image is a constant 1300 (`:41`), image size is not used for the quota estimate.
- Not persisted server-side: the route returns only parsed JSON; the file is dropped. The DB stores the parsed breakdown only.

**W2c-02. Receipt MIME check trusts the client.** `src/app/api/receipt/scan/route.ts:254-257`: `mimeOf` reads `img.type` (multipart part Content-Type, client-controlled). No magic-byte check. Effect: an attacker can submit arbitrary bytes labelled `image/jpeg`; they are forwarded to Gemini inline and cost a quota reservation, which Gemini would reject. Not a code execution or storage risk (nothing is stored). Evidence: no `fileTypeFromBuffer`/signature sniff in the file. Proven. Fix: sniff the first bytes (JPEG FFD8FF, PNG 89504E47, RIFF....WEBP, ftyp heic/heif) before base64; reject mismatches with 415. Complexity L.

**W2c-03. Only page one of a multi-page receipt is kept locally.** `src/components/receipt/ReceiptScanSheet.tsx:266`: `saveReceiptImage(receiptId, preview)`, and `preview` is `capturedPhotos[0].dataUrl` (`:135`). Photos 2-5 are discarded after scanning. Proven. Impact: the viewer for a long receipt shows only the top; if the stitched result is disputed the user lacks the rest. Fix: save `receipts/<id>-<n>.jpg` per page and let the viewer page through; keep the 60-day cleanup. Complexity L-M. (Treat as product question: may be intentional to limit disk.)

**W2c-15. Stale comment.** `cameraScanner.ts:157` says 2048 px, constant is `MAX_EDGE = 1800` (`:159`). Info only.

**W2c-10. Over-size logos.** Evidence: file sizes above. The 2 SVGs of >100 KB are likely vector traces with embedded gradients/paths. Potential: bigger native bundle and parse cost on screens that render many logos. Fix: SVGO the 3 SVGs, convert PNG provider logos to WebP at 2x their render size (they render ~40 px), keep `onError`. Complexity L.

**W2c-12.** `buddgy-square.png` 494 KB / `buddgy-cutout.png` 332 KB and `og-*.png`: if referenced only by OG tags (they are) they only affect crawlers; if unreferenced, delete (verify). Proven sizes, potential impact.

**W2c-11. Avatar as a data URL in a hot row.** `profileMapper.ts:47,84` map `avatar_image_path` to `p.avatar`; `src/lib/supabase/remote/sync.ts:547,598` pull `profiles` with `select('*')` on every full pull, plus the delta pull reads profile changes. The UI path produces a ~60 KB JPEG (512 px, q0.86, comment in `avatarPhoto.ts:1`), so a normal user pays ~60 KB on each cold/full pull and keeps it in persisted store (`localStorage`). The validator allows up to 8,000,000 characters (`src/lib/profile/validImageDataUrl.ts:6`) and no DB constraint was found in a quick migration grep, so a client that bypasses the UI could store several MB in its own row (RLS lets a user update its own profile). Proven (code), potential (abuse/size). Fix: lower the client validator to ~200 KB, add a DB `CHECK (length(avatar_image_path) < 300000)`; longer term upload to the `avatars` bucket and store the path (the column is already named `_path`). Complexity M.

**Strengths (images):** receipt photos never leave the device; downscale before upload; layered size and type limits; private signed support attachments; `onError` fallbacks to monograms; no remote image hosts; every `<img>` exception documented.

## B. Frontend (Phase 8)

### Code splitting
- Dynamic: `ModalProvider.tsx:61-71` loads ~11 sheets and `AIChat` (Buddgy chat) lazily with an offline-safe wrapper and a sheet fallback; `reports/page.tsx:47,52` lazy-loads `MonthlyChart` and `CategoryPieChart` (the only app imports of `recharts`; admin `Charts.tsx` is inside the lazy admin bundle); `AppShell.tsx:52` and `AdminApp.tsx:37` lazy-load the whole admin portal and its views. Native plugins (`@capacitor/filesystem`, camera) are imported dynamically.
- `firebase-admin`, `groq-sdk` are server-only. `framer-motion` is in 26 files and `date-fns` in 103 (tree-shakable named imports).

**W2c-09. All shell views are in the main bundle by design.** `src/components/layout/AppViewRouter.tsx:6-62`: 33 pages are statically imported so navigation is a synchronous swap (documented, to kill the "segment fetch wedge" on WebView). Proven. Cost: the first-load JS contains every tab (Flow, Debts, Wealth, Goals, Settings pages, budget studio, etc.). The static export already ships everything locally, so for native the cost is parse/eval time on a mid-range Android, not download. For web the cost is download + parse for every visitor. Potential (not measured). Fix options (high care, regression risk): keep tabs used in the bottom nav static and make rarely used ones (`/settings/*` leaves, `/budget-setup`, `/start`, `/budget-history`) `lazy()` with a prefetch-on-idle and the same offline-safe loader the modals use; measure with the bundle analyser first. Complexity H. Do not change without a bundle report.

### Re-renders and state
- Strong: `useShallow` in 86 files; a test (`src/lib/store/noBareStoreSubscription.test.ts`) guards bare `useStore()` subscriptions. Persist storage is debounced and flushed on hide/unload (`src/lib/store/debouncedPersistStorage.ts`) to avoid 50 ms stalls at 20k expenses. Cross-tab sync exists (`crossTabSync.ts`).
- Selectors returning new objects: grep for `=> ({` inside `useXStore(` found none outside the guarded cases (not exhaustive).
- Context fan-out: not audited in depth; the app is zustand-first, so context fan-out is limited to AuthProvider, i18n, and modal providers.

### Lists
- `FlowLedger.tsx:53-65` paginates by day groups (`FLOW_LEDGER_PAGE_DAYS`) with a "show more"; other lists use month filtering. No virtualisation library; `react-window` absent. For the persisted store at 20k expenses the month/period filters bound DOM size. Potential only: any "all months" view with a large single day group is not windowed.

### Requests on boot and duplicates
- Boot: cache-first (persisted zustand, instant render), then `pullDelta` (cursor) with a full `pullAll` fallback (`SupabaseFinanceSync.ts:735`). `pullAll` is one `Promise.all` over ~20 tables with keyset paging of 1000 (`src/lib/supabase/remote/sync.ts:497-533`); `pullCore` is a small subset. Good: parallel, bounded, resumable.
- Other boot calls: `/api/app-config` (UpdateGate), `/api/entitlements/me` (billingStore), `/api/flags` (module-level `cached` + shared `inflight`, so dedup'd, `src/lib/flags/useFeatureFlag.ts:8-15`), `/api/notifications`, `/api/buddgy/usage`, device heartbeat, FX rates and gold (TTL-gated by `ratesNeedFetch` / `GOLD_TTL_MS`). They are issued from separate hosts/effects (`AppShell`, `BillingHost`, hooks), so they run concurrently, not as a chain; no waterfall found, except that authenticated calls wait for the session. Not measured.
- **W2c-14.** `src/lib/notifications/useNotifications.ts:92-123`: the same `/api/notifications` GET is written twice (a `useCallback` and an inline effect copy). Two consumers (`notifications/page.tsx:32`, `NotificationInbox.tsx:49`) each fetch on mount. Proven, low impact. Fix: one shared fetch with in-flight dedupe like `useFeatureFlag`. Complexity L.
- Polling: `usePendingSmsPreviews` 15 s only while cards exist and native; `useForegroundPoll` pauses in background; gold timer is TTL-gated. Good.

### Loading / empty / error states
- Present: `src/components/ui/EmptyState.tsx` (22 consumers), `SkeletonList.tsx` (15 files use "Skeleton"), `(app)/loading.tsx`, `(app)/error.tsx`, `global-error.tsx`, `SheetFallback` for lazy sheets, `SyncFailureBanner`, offline fallbacks. Consistency across the ~33 views was not exhaustively checked; the primitives exist and are reused. Potential: views that render `0` while data hydrates (known: dev-bypass notes in memory) rather than skeletons.

### Strengths (frontend)
Cache-first instant boot; in-memory nav shell removes route fetch latency; lazy Buddgy chat, charts, admin, sheets; delta sync with cursor; debounced persistence; guarded store subscriptions; foreground-only polling; paginated ledger.

## C. Caching (Phase 7)

### Layers found

| # | Layer | Data | TTL | Invalidation | Staleness risk | Private-data isolation |
|---|---|---|---|---|---|---|
| 1 | `unstable_cache` via `cachedSetting` (`src/lib/server/platformCache.ts:13`) | Platform settings: `min_app_version`, `app_config_rest`, `ai_runtime`, `ai_pricing`, billing switch, `spark_products` | 300 s default | tag `platform-settings`, `invalidatePlatformSettings()` after admin writes (`revalidateTag(expire:0)`); errors never cached | Up to 5 min if a write forgets the call | Shared key, global data only. Safe. |
| 2 | `unstable_cache` health (`api/health/deep/route.ts:40`) | readiness | 60 s | none | benign | Public summary; detail needs `CRON_SECRET`. |
| 3 | In-memory `getMinVersions` (`clientGate.ts:34`) | min app version | 60 s per isolate | none (sits on top of #1) | Two layers stack: up to 60 s + 300 s | Global data. |
| 4 | In-memory `currentSpend` (`spendGuard.ts:~28`) | daily AI cost vs cap | 60 s per isolate | none | A runaway can overshoot the cap by one minute per instance | Global. |
| 5 | In-memory `verdicts` (`src/lib/auth/accountActive.ts:7`) | suspended/deleted verdict per user | 60 s, 5000 entries | clears when full | A suspension takes up to 60 s per instance | Keyed by user id, per isolate. Safe. |
| 6 | In-memory `verified` (`src/lib/server/apiSecondFactor.ts:10`) | second-factor verified per session id | 60 s, 2000 entries | clears when full | A revoked factor lingers up to 60 s | Keyed by session id. Safe. |
| 7 | In-memory `staffCache` (`src/lib/server/admin/guard.ts:48`) | admin staff row | 5 s | TTL | negligible | by user id |
| 8 | In-memory email templates (`src/lib/server/email/store.ts:8`) | published template | 5 min | `invalidateTemplate` on publish, this instance only | Other instances up to 5 min | Global data. |
| 9 | CDN `Cache-Control: public, s-maxage=7200, swr=14400` (`api/rates/route.ts:238`) | FX rates | 2 h + 4 h swr | none; error path 30 s | A bad upstream value cached up to 2 h (mitigated by `validRates`) | Public data, no user input (route reads no params). |
| 10 | CDN `/api/gold` 900/1800 s (`gold/route.ts:173`), unavailable 60/120 s | gold price | 15 min | none | stale up to 45 min under swr | Public. |
| 11 | CDN `/api/app-config` 60/300 (`app-config/route.ts:21`) | min version, maintenance, announcement | 60 s | #1 inside | up to ~6 min total for a maintenance banner | Public; `Vary: Origin` appended by native CORS (`nativeApiCors.ts:24`). |
| 12 | `private, no-store` on user routes (flags, trial, entitlements, notifications, admin by proxy) | per-user | none | n/a | none | Correct. |
| 13 | Client zustand persist (localStorage via debounced storage) | whole finance store, settings, chats | until reset/sign-out | `data_reset_at` epoch, ephemeral session guard, per-user wipe on account switch (`usePendingAiJobs` wipes `pending-ai`) | Cross-tab handled; quota toast exists | Per device. Cleared on switch (documented). |
| 14 | Client module caches: `useFeatureFlag` (`cached`, `inflight`, reset on sign-out via `resetFeatureFlags`), `adminClient` response cache (15 s, 60 entries, cleared on lock event, `adminClient.ts:78-79`), billing store | flags, admin GETs | session / 15 s | explicit reset functions | flags stale until reload | Per tab, per user, reset hooks exist. |
| 15 | Service worker (`public/sw.js`) | `/_next/static`, `/icons`, offline page | cache-first for hashed assets, max 150 | version bump | none | Never caches `/api` or pages. Strong. |
| 16 | DB-side debounce `claimPriceRefresh` (`api/prices/refresh`) and cron prices | asset prices | 1 h attempts | claim row | stale prices self-heal | Global. |

**Private-data isolation verdict:** no user-specific data found under a shared key. Server in-memory maps are keyed by user id or session id; CDN-cached routes read no cookies/params and return global data; the `Vary` in the proxy applies to the marketing rewrite only. CDN-caching a response that also carries a per-origin `Access-Control-Allow-Origin` is handled by `Vary: Origin`.

### Opportunities (rarely changing reference data)

| Data | Current retrieval | Suggested layer / TTL / invalidation |
|---|---|---|
| Feature flags | `/api/flags`: 3 queries per call (flags table, `admin_staff`, entitlements incl. plans) every app start per device (W2c-04) | Cache the `feature_flags` rows with `cachedSetting(['feature_flags'], ..., 60)`; invalidate with `invalidatePlatformSettings()` from the admin flag write route. Keep the per-user evaluation (`flagOn`) in the handler. Staff lookup is per user; fold into the entitlements read or cache 60 s per isolate. Complexity L. |
| Plans table | `loadEntitlements` (`src/lib/entitlements/server.ts:7-9`) selects all `plans` on every call: every `requireFeature` for paid features (AI, voice, receipt), `/api/flags`, `/api/entitlements/me`, `groundingLimited` (W2c-05) | `cachedSetting(['plans'], ..., 300)` with invalidation when admin edits plans. Only the `user_entitlements` row stays per-user. Complexity M (shared by many callers; tests in `entitlements`). |
| Brand catalogue / categories | Static in code and `public/` | Already zero-cost; nothing to cache. |
| FX / gold | CDN `s-maxage` plus client TTL | Adequate. Optional: add `unstable_cache` around the upstream crawl so a CDN miss on a new region does not re-run the 3-5 provider chain; 15-60 min. Complexity L, low value. |
| `spark_products` | already `cachedSetting` | ok |
| Admin overview | Admin 15 s client cache | ok |

Redis is not justified: the shared Next data cache (`unstable_cache`) already provides cross-instance sharing for global settings, and the per-user shared counters live in Postgres.

**W2c-04. Flags hot path.** `src/app/api/flags/route.ts:24-28`: `Promise.all` of `feature_flags`, `admin_staff`, `getUserEntitlements` (which itself reads `plans` + `user_entitlements`). So 4 DB reads per user per app start per device (client dedupes only within a page load: `useFeatureFlag.ts:8-15`). Proven (code); load potential. Fix as above. L.

**W2c-05. Plans re-read per call.** Evidence: `entitlements/server.ts:7-9` runs `service.from('plans').select(...)` each time. AI/voice/receipt calls hit it once via `requireFeature` (`quota.ts:~78`) and again for `/api/ai` `groundingLimited` (`ai/route.ts:49`). Fix: W2c-05 above. M.

**W2c-16.** `/api/rates` and `/api/gold` ignore query parameters, but a CDN keys on the full URL, so `?x=<random>` bypasses cache and runs the upstream chain; the proxy limiter (`proxy.ts:78`, 240/60 s per IP) bounds it per IP, not globally. Potential. Fix: `unstable_cache` around the provider crawl (global key) so cache-busting cannot multiply upstream calls. L.

**Strengths (caching):** tagged shared cache with failure-not-cached semantics and explicit invalidation; short TTLs on security-relevant verdicts; strict `no-store` on user/admin routes; service worker refuses to cache API/pages; client reset hooks on account switch.

## D. Throttling (Phase 10)

### Mechanisms
- **Shared Postgres counter.** `api_rate_hit(p_key, p_window_seconds, p_max_hits)` is a single `INSERT ... ON CONFLICT DO UPDATE` on `(key, window_start)` (migration `0322_api_rate_hit_bucket.sql`), service-role only; client helpers `rateLimitOutcome` / `isRateLimited` (`src/lib/server/rateLimit.ts:6,16`), optional `failOpen`. Old rows pruned by pg_cron `api-rate-cleanup` (0215). `admin_rate_hit` (0126) is the admin twin.
- **Proxy limiter** for `/api/gold` and `/api/rates` (`src/proxy.ts:78`): per-isolate `Map` of timestamps, 240 per 60 s per IP, 10,000-IP cap, consults the shared RPC only after 120 in-isolate hits (`publicApiRateLimit.ts:7-47`); RPC errors fall back to memory (fail open).
- **AI quota** (separate from rate limit): `reserveAiQuota` -> RPC `ai_quota_reserve_v2` with layers `rate`, `chats_hour`, `chats_day`, `window_5h/24h/7d`, `session`, `week`, `chat_messages_day`, `receipts_month`, `voice_day`, `sms_day/month`, `sparks` (`src/lib/server/ai/quota.ts:9-26`); plan feature gate; plus a global daily spend cap (`spendGuard.ts`, cap multiple 3x for essential `sms` and `receipt`). `/api/ai` also has `ai:<user>` window limiter configurable from admin and `ai-grounded:<user>` per day.
- IP source `clientIp` uses `x-real-ip` or the LAST `x-forwarded-for` hop (anti-spoof); IPv6 bucketed to /64 via `rateBucketIp` (used by check-email; other routes use raw `clientIp`).

### Rate-limited routes

| Route | Key | Store | Limit |
|---|---|---|---|
| `/api/gold`, `/api/rates` | `public-api:<ip>` (after memory) | Map + PG | 240/60 s |
| `/api/auth/check-email` | `check-email:<ip /64>`, `check-email-day:<ip>` | PG, fail closed | 30/60 s, 300/day |
| `/api/site/lead` | `site-lead:<ip>`, `site-lead-email:<email>`, `site-lead-day` | PG, fail open | 5/60 s, 3/h per email, 3000/day global |
| `/api/site/event` | `site-event:<ip>` | PG, fail open | 120/60 s |
| `/api/feedback` | `feedback:<user>` | PG | per hour |
| `/api/support/submit`, `/attachments`, `/tickets/[n]`, `/board/[n]/vote` | `support-*:<uid>` | PG | e.g. uploads 30/h |
| `/api/referrals/redeem` | `referral-redeem:<user>`, `...-ip:<ip>` | PG | 20/10 min, 300/h per IP |
| `/api/billing/sync` | `billing-sync:<user>` | PG, fail open | 6/60 s |
| `/api/billing/paywall-view`, `/api/analytics/onboarding` | helper / direct RPC | PG | see routes |
| `/api/push/send` | `push-send:<uid>` | PG | per hour |
| `/api/sms/parse` | `sms-parse:<user>` | PG via `rateLimitOutcome`, answers 503 + `Retry-After: 60` on counter outage | 1200/h (`route.ts:671`) |
| `/api/sms/setup-token` | `sms-setup-token`, `sms-rotate` | PG | per hour |
| `/api/biometric/signin` | `bio-signin-ip`, `bio-signin-dev` | PG | per window |
| `/api/auth/password/change`, `/auth/two-factor` (via `verifyReauth`, `reauth.ts:45`) | `reauth:<uid>` | PG | attempts per window |
| `/api/account/delete`, `/api/savings/carry` | helper | PG | per route |
| `/api/ai` | `ai:<uid>`, `ai-grounded:<uid>` + quota | PG | admin-configurable |
| Admin: `users/[id]/financial`, `export`, `sms/logs` | `api_rate_hit` direct | PG | per route |

### Not rate-limited (by route family)

| Family | Routes | Mitigation present | Gap |
|---|---|---|---|
| Voice / receipt OCR / Buddgy | `/api/voice/transcribe`, `/api/receipt/scan`, `/api/buddgy/turn`, `/api/buddgy/usage`, `/api/budget/ai` | JWT identity (local verify), suspended check, plan feature gate, DB quota reservation with `rate` and per-day/month layers, global spend cap, 4 MB / 3.3 MB / 256 KB body caps | No dedicated burst limiter; `receipt/scan` parses the whole multipart before the quota check (`route.ts:239-290`). An authenticated abuser can force up to 4 MB of parse work per request until quota denies. W2c-01. |
| Auth/OTP | Supabase Auth endpoints (`signInWithOtp`, password, OAuth) are called straight from the client; the app has no wrapper route | Supabase Auth's own limits (project settings, not visible in repo) | Cannot verify the configured OTP/email rate limits from code. Action: confirm in Supabase dashboard. |
| Email hook | `/api/auth/email-hook` | HMAC-signed webhook | ok |
| SMS ingest satellites | `/api/sms/ack`, `confirm`, `dismiss`, `undo`, `own-transfer`, `flag-action`, `revoke-token`, `health` | per-user auth (`resolveActiveApiUserId` within 60 s of suspension) | no per-user cap; DB-only writes |
| Invites/referrals | `/api/referrals/redeem` limited; invite landing is a page | ok | none |
| Trial claim | `/api/entitlements/trial` | DB enforces one per mailbox and a daily cap | no route limiter; does an Auth admin `getUserById` per call |
| Devices/push registration | `/api/devices`, `/push/register`, `/biometric/register`, `/auth/device/*`, `/auth/welcome` | auth; `welcome` atomic once-only claim | no limiter |
| Public | `/api/prices/refresh` (unauth POST), `/api/health`, `/api/health/deep` | DB debounce 1 h (`prices/refresh/route.ts:20,31`), `unstable_cache` 60 s health | W2c-08: each refresh call still costs a DB claim round trip with no IP limit |
| Webhooks | linear, resend, sentry, revenuecat, email-hook | HMAC/signature verification | no limiter (fine) |
| Cron | `/api/cron/*` | `CRON_SECRET` | n/a |

**W2c-01.** Evidence above. Fix: add `isRateLimited(service, 'receipt:<uid>', 60, 6, true)` and same for voice (e.g. 20/min) before reading the body, and move the `reserveAiQuota` ahead of `formData()` where size is known from `Content-Length`. Complexity L.

**W2c-06. Per-isolate state across instances.** The proxy Map (`publicApiRateLimit.ts:7`), `accountActive` verdicts, `apiSecondFactor` verified Map and `reported` set (`rates/route.ts`) are per serverless instance, not shared. Consequences: the public limiter's real ceiling is 240 x live instances per IP until the shared RPC kicks in (it does, after 120 hits per instance), and each instance repeats the Auth `getUserById` lookup once per minute per user. Proven by design and documented in comments. Acceptable for public reference data; do not use these maps for abuse-critical limits. No change required; note for the record. L.

**W2c-07. DB load from the shared counter.** Every guarded request issues one `api_rate_hit` upsert round-trip (a write, WAL, on a small instance). A bad actor spreads load rather than concentrates it: the `site-*`, `check-email`, `billing-sync`, `sms-parse` paths write one row-version per call; `sms-parse` at 1200/h/user means a busy user generates a write per SMS. Unauthenticated routes (`check-email`, `site/lead`, `site/event`) write per request even for blocked callers (a blocked caller still increments). The public gold/rates limiter deliberately avoids this by gating on memory first. Evidence: `rateLimit.ts:8`, `0322` function body (`insert ... on conflict do update`). Proven (code); impact potential. Cleanup is by pg_cron, so table size is bounded. Fix: put the proxy's "memory first, DB after half the window" pattern into the unauthenticated helpers (`site/event`: 120/60 s is a very hot analytics path and writes on every page view event); for authenticated routes accept the cost. Complexity M.

**W2c-08.** `/api/prices/refresh` is unauthenticated, outside the proxy limiter, and each call hits the DB (`claimPriceRefresh`). The debounce stops the provider stampede; DB traffic remains. Potential. Fix: add the in-memory per-IP gate or include it in the proxy matcher list at `proxy.ts:78`. L.

**W2c-13.** No `Retry-After` on rate-limit 429s (only the sms/parse 503 sets it, `parse/route.ts:694`); native clients use jitter (`smsRetryState.ts`), web has no hint. Low. Fix: return `Retry-After: <windowSeconds>` from the shared helper callers. L.

### AI usage caps (summary)
Present and layered: plan-gated features, per-user monthly receipts, daily voice, SMS day/month, chat 5h/24h/7d windows, per-turn accounting with provisional charges, reservation + settle (failed calls not charged), `ai_quota_release`, global daily spend cap with warn/capped levels, and a fallback to v1 reserve if v2 is missing. A quota-store outage fails closed (`layer: 'unavailable'`), while `/api/ai`'s `ai:<uid>` limiter fails open. Request caps: 256 KB for `/api/ai`, max 4 inline media parts, `maxDuration` 30-60 s so reservations settle.

**W2c-17.** Admin response cache keyed by path only, global per tab, cleared on lock, 15 s stale window; no cross-user leak because it is per browser and cleared on `ADMIN_LOCKED_EVENT`. Fine.

## Strengths overall
- Defense in depth on AI cost; local-only receipt photos; layered size caps.
- Careful rate-limit hygiene: anti-spoof IP, IPv6 /64, fail-open vs fail-closed chosen per route, atomic bucket math fixed in 0322, cleanup cron, per-email and global-per-day caps on public forms.
- Cache discipline: shared tagged cache with invalidation, never caches errors, never caches authenticated pages or API in the SW, `no-store` on private routes.
- Client: cache-first boot, delta sync, debounced persistence, shallow selectors enforced by a test, lazy heavy surfaces.

## Priority list (top 8)
1. W2c-01 burst limiter + early quota on receipt/voice/buddgy.
2. W2c-04 and W2c-05 cache flags and plans (the same two tables are re-read on every paid-feature call and every app start).
3. W2c-11 avatar data URL in a synced row: cap server side, move to a bucket.
4. W2c-09 measure the main bundle before touching the static shell.
5. W2c-02 magic-byte sniff on receipt images.
6. W2c-07 memory-first gate for the unauthenticated site endpoints (hot analytics path).
7. W2c-10/12 compress logos/PNGs (native bundle size).
8. W2c-03 keep all pages of a multi-page receipt locally (product decision).
