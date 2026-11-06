# QA Round 6: sec-static (prefix SST)

Covered: whole-repo static security analysis. Semgrep 1.183.0 (via `uvx`, `--metrics=off`, nothing installed permanently, output only under the scratchpad) with 14 registry rulesets over `src/ supabase/ scripts/ public/ next.config.ts vercel.json capacitor.config.ts android/app/src ios/App/App`; 11 custom rules written and tested (`semgrep --test`, all pass) and run over the repo; sharp-edges review of the auth abstractions; insecure-defaults sweep of env, CSP, cookies, CORS and both native manifests; variant analysis of API-1..13, SIT, DBL; live read-only DB checks (advisors, definer functions, grants, policies, FKs). Not covered: CodeQL (not installed), semgrep Pro/cross-file taint (OSS only), bodies of `sms/parse` and the admin handlers beyond guard + query-shape triage, `android/**/build` and `ios/Pods` (excluded), live HTTP probing, Kotlin/Swift beyond manifests, storage and credential handling.

## Findings

| ID | P | file:line | finding | evidence | suggested fix | status |
|---|---|---|---|---|---|---|
| SST-1 | P2 | `api/sms/setup-token/route.ts:33-37,84-125`; `api/push/register/route.ts:58-61` | Variant of API-1/API-2 ("a removed phone drops the id"). `deviceRefusal` and the push guard only act when a device id is present (`if (deviceId && ...)`, `isRevokedDevice(..., null)` returns false). A phone the owner removed that omits BOTH the `X-Buddget-Device-Id` header and the body `deviceId` (a) gets a device-less ingest token from `GET /api/sms/setup-token`, (b) calls `DELETE` (rotate) which, with no device id, deactivates EVERY active token of the account (other phones' SMS silently disarmed) and mints a new device-less one, (c) registers a push token with `device_id` null on `push/register`. `smsDeviceGate` has the missing-header refusal but it is off unless `SMS_REQUIRE_DEVICE_HEADER=1` (see SST-5); setup-token and push/register have no equivalent at all | `repro/sec-static/variants.test.ts.txt`: control (header names removed phone) 403 passes; the 3 header-less cases return 200 (expected 403) | when the account has any device on record require a header that names a live registered device on setup-token (both verbs) and push/register, exactly as `smsDeviceGate` does once enforced; make DELETE without a device id rotate only device-less tokens | Confirmed |
| SST-2 | P2 | `android/.../SmsCapacitorPlugin.kt:53-58`, `SmsForwardWorker.kt:56-62`; `ios/App/App/SmsCapacitorPlugin.swift:32-36,295-299` | The native SMS plugins persist the JS-supplied `apiUrl` with no https or host check and then POST the raw SMS body plus `Authorization: Bearer <ingest token>` to `"$apiUrl/api/sms/parse"` from the background (Android `HttpURLConnection`, iOS intent). Anything that can run script in the WebView once (an XSS, a malicious `allowNavigation` host such as a taken-over `*.buddget.app` subdomain, a mis-set `NEXT_PUBLIC_API_BASE_URL=http://...` build) can repoint it permanently, after which every future bank SMS (including one-time codes) and the token go to the attacker. Token itself is stored well (Android EncryptedSharedPreferences, iOS Keychain AfterFirstUnlockThisDeviceOnly) | static read of both plugins; semgrep p/kotlin and p/swift did not model it | validate in native code: scheme `https` and host equal to `buddget.app` or `*.buddget.app` (or a compiled-in constant) before saving; ignore a different URL | Static |
| SST-3 | P3 | `api/webhooks/sentry/route.ts:33-38`, `lib/integrations/sentryWebhook.ts:76,86` | `p_user_id`, `p_device_id`, title, stack are taken from the Sentry event, which the client writes (the DSN is public in the bundle). The webhook signature proves Sentry sent it, not that the user id is the sender. Anyone can submit events attributing crashes to an arbitrary user UUID; they land in `client_crashes` (shown in admin, exported/erased per user by `userData.ts`) | static; DSN is `NEXT_PUBLIC_SENTRY_DSN` | treat `user.id` from Sentry as a hint only (do not link to `auth.users`, or require the id to match the `device_id` registered for that user) | Static |
| SST-4 | P3 | `android/app/src/main/AndroidManifest.xml`, `android/app/build.gradle:34-39` | Release build has `minifyEnabled false` (no R8 shrink/obfuscation of the SMS plugin, queue and gate code). Manifest otherwise clean (see Verified clean) | static | enable R8 with keep rules for Capacitor plugins | Static |
| SST-5 | P3 | `lib/sms/deviceGate.ts:19-24`, `docs/ENV.md` | `SMS_REQUIRE_DEVICE_HEADER` is a fail-open switch that defaults OFF: a JWT caller without the device header is let through with only a `console.warn`. The API-1..3 removed-phone controls are therefore advisory for SMS ingest until the owner sets it on Vercel (not verifiable from the repo). Documented trade-off, but it is the reason SST-1 is reachable on `sms/parse` too | static | set it to 1 now that header-sending builds are out, then delete the flag | Static |
| SST-6 | P3 | `capacitor.config.ts:27` | `webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production'` defaults to a debuggable WebView whenever `NODE_ENV` is unset. Safe today because `scripts/capacitor-build.mjs:133` forces `NODE_ENV=production` for `cap sync` (generated `capacitor.config.json` in android/ and ios/ both say `false`), but a bare `npx cap sync` (forbidden by CLAUDE.md, still typable) ships debugging on | checked both generated configs and the build script | invert: `=== 'development'` | Static |
| SST-7 | P3 | `lib/supabase/cookieDomain.ts:82-84`, `proxy.ts:135-136` | Migrated shared-domain auth cookies (`domainCookieOptions`) and the marker cookie are written without `Secure`. HSTS with includeSubDomains and preload (next.config.ts) means browsers never send them over http, so exposure is theoretical; the domain scope means a sibling subdomain can read/overwrite them (they are not httpOnly by Supabase design) | static | add `secure: true` when `NODE_ENV==='production'` | Static |
| SST-8 | P3 | live DB: `account_balance_reports`, `ai_chats`, `goal_allocation_runs`, `savings_month_summary` (INSERT/UPDATE/DELETE), `app_analytics_events` (UPDATE/DELETE) | DBL-4 is still open for these 5 tables (the other tables R5 listed were fixed): `authenticated` holds write grants with no matching policy. RLS default-denies, so no exposure today; one dropped policy flag from a write hole on tables that hold money history | SQL over `role_table_grants` x `pg_policies` (counts only) | `REVOKE INSERT, UPDATE, DELETE` on those tables from `authenticated` (verify no client path writes them as the user) | Confirmed |
| SST-9 | P3 | live Auth setting | Supabase advisor `auth_leaked_password_protection` is disabled (HaveIBeenPwned check off) | `get_advisors security` | enable in Auth settings (needs Pro plan) | Confirmed |
| SST-10 | P3 | variants of API-10: `api/auth/check-email:53`, `api/biometric/signin:28`, `api/site/lead:20`, `api/site/event:22`, `lib/server/admin/guard.ts:32`, `proxy.ts:76` | All six still key rate limits (and, in `guard.ts`, the admin login/step-up lockout IP) on the FIRST `x-forwarded-for` hop while `health/deep` documents that hop as client-supplied. Harmless behind Vercel (it overwrites the header), but an extra proxy in front of the admin host (the portal is on its own subdomain) lets an attacker rotate the bucket per request | grep | one shared `clientIp()` that prefers `x-real-ip` (as `health/deep` does) | Static |
| SST-11 | P3 | variants of API-7: `api/push/register/route.ts:19,70-86`, `api/sms/setup-token/route.ts:84-110` | No per-account cap or rate limit on row creation: every distinct push token (10..2048 chars) adds a `push_tokens` row; every `DELETE` rotate inserts a new `sms_ingest_tokens` row and only flips old ones inactive, so the table grows without bound per call. `devices` got the cap in R5 | static | cap live tokens per user (delete oldest) and rate limit rotate | Static |
| SST-12 | P3 | `profiles.email` (user-writable column, `profiles_update_own`) used in `api/admin/sms/logs/route.ts:110-116` and `api/support/submit/route.ts:52-53` | A user can set `profiles.email` to any address through PostgREST (UPDATE granted on the column). Staff-created tickets from an SMS log and the support fallback use it as `requester_email`, so replies/emails can be steered to a third party | live `column_privileges` | read the email from `auth.users` only, or revoke UPDATE(email) | Static |

## Semgrep results (OSS 1.183.0, `--metrics=off`, ~1,420 TS/JS files scanned; 1,728 for the language-agnostic sets)

| Ruleset | Hits | True positives | False positives refuted |
|---|---|---|---|
| p/typescript | 1 | 0 | 1: `cors-misconfiguration` at `lib/server/nativeApiCors.ts:19` reflects `Origin` with credentials, but only after an exact match against `https://localhost`, `capacitor://localhost` (and `http://localhost:3000` outside production); no wildcard or arbitrary reflection. Same hit reported by p/javascript and p/owasp-top-ten (counted once) |
| p/javascript | 1 | 0 | the same one |
| p/react | 0 | 0 | none |
| p/nextjs | 0 (scanned 0: no applicable rules matched this layout) | 0 | none |
| p/owasp-top-ten | 1 | 0 | the same one |
| p/jwt | 0 | 0 | none |
| p/secrets | 0 | 0 | none (also `git grep` for `sb_secret_`, JWTs, private keys, `AIza`, `ghp_`, `lin_api_`, `re_`: only a test string and the public Firebase client key in `google-services.json`) |
| p/security-audit | 0 | 0 | none |
| p/xss | 0 | 0 | none |
| p/command-injection | 0 | 0 | none |
| p/sql-injection | 0 | 0 | none |
| p/insecure-transport | 0 | 0 | none |
| p/kotlin (10 files) | 0 | 0 | none |
| p/swift (6 files) | 0 | 0 | none |

One parser note: semgrep logged a syntax error in `src/lib/supabase/database.types.ts:736` (generated types file, not code that runs).

### Custom rules (`docs/qa-round-6/repro/sec-static/*.yaml.txt`, each with a `ruleid`/`ok` test file `*.ts.txt`; all 11 pass `semgrep --test`)

| Rule | Hits | True positives | False positives refuted |
|---|---|---|---|
| sst-service-query-no-user-filter | 52 | 0 | all 52: admin routes behind `guardAdmin` (cross-tenant by design), cron sweeps (`user_settings` paging), inserts that carry `user_id` in the row, token-keyed lookups (`sms_ingest_tokens`, `biometric_devices` by device secret), signed webhooks (`resend`, `linear`), erasure by email in `userData.ts`, `push/register:70` token reassignment (needs a leaked 100+ bit FCM token) |
| sst-dangerously-set-inner-html | 5 | 0 | nonce'd theme script x2, site theme script, `JsonLd` (JSON with `<` escaped), admin `CodeEditor` (`highlightHtml` HTML-escapes first) |
| sst-navigation-dynamic-url | 7 | 0 | `appOrigin()`/config-built URLs; `UpdateGate` url comes from `/api/app-config`, admin-written and validated `^https://` in `admin/platform/route.ts:30-35`; `CrashesView` `sentry_url` comes from a signed Sentry webhook payload and is opened with `noopener`; `navigate.ts`/`postAuthRedirect.ts` go through `safeInternalPath` |
| sst-log-request-body | 11 | 0 | logs print `error.message`, status codes, push results, user ids; none print the body (the taint source `$REQ.headers` over-matches) |
| sst-math-random-secret | 2 | 0 | both in `admin/__tests__/harness/mocks.ts` (test harness) |
| sst-unvalidated-body-to-db | 1 | 0 | `analytics/onboarding`: event whitelist, `sanitizeMeta`, size cap, rate limit |
| sst-localstorage-token | 1 | 0 | admin session token in `sessionStorage` for native-only cross-origin admin (`usesRemoteApi()`), tab-scoped; web uses the HttpOnly `__Host-` cookie |
| sst-fetch-request-controlled-url | 0 | 0 | none (every server `fetch` has a constant host: Gemini, Groq, Linear, Resend, gold/FX providers, Supabase realtime) |
| sst-eval-new-function | 0 | 0 | none |
| sst-postmessage-origin | 0 | 0 | none |
| sst-postmessage-wildcard | 0 | 0 | none |

## Sharp-edges review (own abstractions)

- Four caller resolvers with overlapping names: `resolveRouteUser` (Auth round trip, accepts bearer OR cookie), `resolveRouteIdentity` and `resolveApiUserId` (local JWT verify, never notices ban/removal), `resolveActiveApiUserId` (adds a cached ban/delete check), `resolveVerifiedIdentity` (local + round trip). The safe one for a destructive route is the least obvious by name; 13 routes pick by convention, not by type. The matrix of which route uses which was produced from grep: all credential/delete routes use the verified pair; `devices`, `devices/[id]`, `notifications`, `support/*`, `flags`, `entitlements/me` use the local-only one (API-6 accepted trade-off).
- `resolveRouteIdentity` falls through from an invalid bearer to the session cookie, so a bad `Authorization` header plus a victim cookie resolves as the cookie owner (same trust as the cookie; noted, not a bypass).
- `deviceRefusal`/`isRevokedDevice(userId, null)` returns "not revoked" for a missing id: the safe default flips to unsafe on omission (SST-1).
- `isAccountActive` fails open on Auth errors and caches the verdict for 60 s (documented).
- `createServiceRoleClient()` is importable from any file; the only guard is a doc comment (no `server-only` import in `service.ts`). No client component imports it (checked all 52 importers for `'use client'`), and the key is not `NEXT_PUBLIC_`, so it cannot leak into a bundle, but a future import would fail at runtime rather than at build.
- `getSupabaseSecretKey()` accepts two env names (`SUPABASE_SECRET_KEY`, legacy `SUPABASE_SERVICE_ROLE_KEY`) while `instrumentation-node.ts` and `ai/quota.ts` read only the first, so a deploy with only the legacy name boots with AI quota and instrumentation silently off (documented in `docs/ENV.md`, not a security hole).

## Variant analysis (R5 finding -> repo-wide search)

| R5 finding | Pattern searched | Variants found |
|---|---|---|
| API-1/2/3 (removed phone) | device-id-conditional guards; revoke-then-cleanup ordering | SST-1 (setup-token GET/DELETE and push/register when the id is omitted), SST-5. Revoke-first ordering exists only in `devices/[id]` (already fixed); the other `revoked_at` writes are admin access grants (no retry trap) |
| API-4 (credential creation needs only a session) | routes minting long-lived credentials | `sms/setup-token` mints non-expiring ingest tokens on a plain session (accepted: the owner needs it); `biometric/register` fixed; admin routes need step-up. No new variant |
| API-5 (destructive before success) | delete/update before the guarded call | none outside the already-fixed `password/change` |
| API-7 (unbounded rows from client ids) | upsert/insert keyed by client input | SST-11 (`push_tokens`, `sms_ingest_tokens`) |
| API-8 (bulk update + `maybeSingle`) | `.update/.delete` then `.single/.maybeSingle` | only admin handlers with `eq('id'|'key')` (single row by PK); none |
| API-9 (header-id as secret) | other trust decisions on a plain header | the device id header only (trust secret fixed in 0236); `X-Buddget-Device-Secret` is in the CORS allow list as intended |
| API-10 (first XFF hop) | `x-forwarded-for` reads | SST-10 (6 files) |
| API-11 (lockout skipped) | admin credential routes | none new |
| API-12 (unguarded upstream fetch) | `await fetch(` in routes | `rates`, `gold`, Gemini calls: reviewed as try/catch or provider-fallback loops; no unguarded `res.json()` after a non-ok found in the sampled sites |
| SIT5 (erasure/export lists) | every live table with a user-id column vs `USER_DATA_TABLES`/`ACCOUNT_TABLES`/`SIGN_IN_TABLES` | none missing: the only extra, `sms_tracking_templates_ai`, has 58 rows all with NULL `user_id` and a documented FK cascade; staff tables cascade from `auth.users` |
| SIT (retention/privacy) | n/a here | `avatars` storage removal in `userData.ts:225` targets a bucket that does not exist (0 buckets live): dead code, no data to leak |
| DBL-3 | leftover schemas | `qa2_backup` already gone; no new non-standard schema found in advisors |
| DBL-4 | authenticated write grants without policy | SST-8 (5 tables remain) |
| DBL-7/8/9 | not security (type/column/date bugs); out of scope for this pass | n/a |

## Verified clean

| Invariant / check | how verified | result |
|---|---|---|
| No hardcoded secrets in the tracked tree or history | semgrep p/secrets (0) + `git grep` of key formats + history `-S sb_secret_` + tracked-file list for .env/.p8/.pem/.jks | clean (public Firebase client key only; a test string) |
| Every cron route fails closed | read `cronAuth.ts`: unset secret returns false, SHA-256 + `timingSafeEqual`; all 7 routes call it | pass |
| Webhooks reject when the secret is unset | read linear/sentry/resend/email-hook handlers: 503/401 before parsing | pass |
| No SSRF: every server `fetch` has a constant host, keys in headers not URLs | grep of all `await fetch(` + custom taint rule (0 hits) | pass |
| No `eval`/`new Function`/`postMessage` misuse | 3 custom rules, 0 hits | pass |
| CORS cannot be arbitrary-origin | `nativeApiCors.ts` exact-match allowlist; dev origin gated on `NODE_ENV!=='production'` | pass |
| CSP | `buildCsp`: nonce + `strict-dynamic`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri/form-action 'self'`, `unsafe-eval` dev only; site CSP allows inline script but the site renders no user HTML; `X-Frame-Options`, nosniff, HSTS preload, Permissions-Policy set in `next.config.ts` | pass (style-src `unsafe-inline` and `img-src https:` are wide, P4) |
| Dev bypass cannot ship | `NEXT_PUBLIC_DEV_AUTH_BYPASS` gated on `NODE_ENV!=='production'` at all 3 sites; `__finance/__settings` hooks mounted only under that flag | pass |
| No insecure env fallbacks | grep of `process.env.X ?? 'literal'`: only app URL, AI rate limit numbers | pass |
| Admin/session cookies | `__Host-` prefix in production, httpOnly, secure, sameSite lax in `deviceCookie.ts`; token hashed (`sha256`) before storage | pass |
| Android manifest | `allowBackup=false`, backup + data-extraction rules exclude prefs/db/webview/receipts, no `debuggable`, no cleartext flag (API 24+ default blocks it, targetSdk 36), `SmsReceiver` exported but permission-gated `BROADCAST_SMS`, `BootReceiver` and FileProvider not exported, FileProvider limited to `Pictures/` | pass |
| iOS config | no ATS exceptions (`NSAllowsArbitraryLoads` absent), only own URL scheme + Google reversed client id, associated domains are `webcredentials:` only, SMS token in Keychain `AfterFirstUnlockThisDeviceOnly` | pass |
| Capacitor config | `allowMixedContent=false`, `allowNavigation` limited to `buddget.app` + subdomains, generated android/ios configs have debugging `false` | pass (SST-6 note) |
| Native logs do not leak SMS/tokens | grep `Log.*` in Kotlin (3 lines: boot, error stack) and `print/NSLog` in Swift (0) | pass |
| Database privilege surface | live: 0 public tables without RLS, 0 definer functions executable by `anon`, 0 definer functions without a pinned `search_path`, 0 public views without `security_invoker`; 11 definer functions executable by `authenticated` all use `auth.uid()`; 3 `USING true` policies are read-only reference data (`merchant_categories`, `asset_prices`, `live_market_data`) | pass |
| Account erasure/export coverage | compared every public table with a user-id column against `userData.ts` lists | pass (SIT5 holds) |
| Service-role queries scoped to the caller | custom rule over all route/server/sms code, 52 candidates triaged | pass (0 true positives) |

Coverage: read fully: `resolveRouteUser.ts`, `resolveApiUser.ts`, `service.ts`, `env.ts`, `cronAuth.ts`, `nativeApiCors.ts`, `csp.ts`, `accountActive.ts`, `deviceGate.ts`, `sms/setup-token/route.ts`, `push/register/route.ts` (lines 40-100), AndroidManifest, backup/extraction rules, `capacitor.config.ts`, `next.config.ts`, `vercel.json`, `SmsForwardWorker.kt` (lines 40-100), `SmsCapacitorPlugin.swift` (credential store). Skimmed or via semgrep/grep only: the other ~95 route handlers, `proxy.ts`, `lib/server/userData.ts`, scripts/, remaining Kotlin/Swift, supabase/migrations (no file-level review; live catalog queried instead).

Skills used: semgrep, semgrep-rule-creator, sharp-edges, insecure-defaults, variant-analysis, fp-check (every semgrep and custom-rule hit triaged to source, reachability and impact), find-bugs (checklist). codeql and sarif-parsing read as references only; codeql not installed, SARIF not needed (JSON output parsed directly). Skill commits: only `insecure-defaults` records one (trailofbits/skills `470419e`); the other skill directories carry no commit marker, so none can be stated.

Repros kept: `docs/qa-round-6/repro/sec-static/variants.test.ts.txt` (run by copying to `src/__qa6__/sec-static/variants.test.ts`: 1 control pass, 3 fail = SST-1), plus the 11 rule/test pairs. `src/__qa6__/sec-static/` removed.
