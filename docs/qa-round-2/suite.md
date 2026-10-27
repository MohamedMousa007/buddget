# QA Round 2: Test suite, supply chain, config

Read-only. No repo files edited. No probe files created by this area (4 untracked `qa2-*.probe.test.ts` under src/lib/debts, payment, sms belong to other QA agents and were left alone).
Counts: P0 0, P1 2, P2 9, P3 10 (21 findings). Items already in docs/QA_ROUND_PLAN.md are not repeated.

## Baseline facts
- Suite: 331 test files (324 run, 7 skipped), 3214+ tests, 238 skipped. Skipped = 6 `*.pg.test.ts` (QA_PG_URL unset) + `buddgy.eval.test.ts` (no GEMINI_API_KEY).
- TZ matrix (full suite): UTC pass, Africa/Cairo pass, Pacific/Kiritimati pass, America/New_York 1 failure (Z7).
- `--sequence.shuffle` run twice: both green (no order dependence found). Test totals drift 3214 to 3241 only because other agents' probe files appear in the worktree.
- No `.only`, `.todo`, `expect(true)`, snapshot tests, or assertion-less test files. Only `skipIf` skips (7 files, reasons below).
- Coverage provider (`@vitest/coverage-v8`/istanbul) NOT installed, so a static import-graph gap map was used instead: of 640 source files in src/lib + src/app/api, 395 (62%) are imported directly by a test, 523 (82%) reachable transitively, 117 (18%) reached by no test.

## Findings

### Z1 P1 Critical/high advisories in shipped dependencies
- File: package.json, package-lock.json
- Evidence: `npm audit --omit=dev`: 35 vulns = 5 critical, 19 high, 10 moderate, 1 low. Critical: `next` 16.3.5 (RCE in next/og ImageResponse; draft-mode cache leak; fix in 16.4.3), `@capacitor/android` + `@capacitor/ios` 8.3.4 (remote content loadable at app origin via internal HTTP proxy path; fixed 8.5.3), `tar`, `websocket-driver`. High direct: `zod` 4.3.6 (memory exhaustion on oversized collections; 4.6.7), `next-pwa` (serialize-javascript RCE, workbox chain; build-time only, fix is a major), sharp, ws, lodash, form-data, grpc-js, picomatch.
- Fix: bump next to 16.4.3, capacitor family to 8.5.3, zod to 4.6.7, supabase-js 2.99.3 -> 2.118 and re-run audit; replace or drop next-pwa. Native shell needs a rebuild for the Capacitor fix (not started here).

### Z2 P1 pg-backed admin tests never run in CI
- File: .github/workflows/ci.yml, src/lib/server/admin/__tests__/harness/pgSupabase.ts:16-17
- Problem: `pgEnabled = QA_PG_URL !== ''`; CI has no Postgres service and no `QA_PG_URL`, so all six `describe.skipIf(!pgEnabled)` suites (RBAC, auth, staff, users, domain, database permissions: 238 tests) are silently skipped on every run. Vitest reports them as "skipped", not failed. Only a developer with local Postgres (scripts/qa/setup.sh) runs them.
- Fix: add a `services: postgres` job, run scripts/qa/setup.sh with QA_PG_URL set, and fail the job if skipped count > 0 for these files.

### Z3 P2 Production-dependency vulnerabilities with no CI gate
- Problem: CI has no `npm audit`, dependabot/renovate config absent (no .github/dependabot.yml). Z1 accumulated unnoticed.
- Fix: scheduled `npm audit --omit=dev --audit-level=high` job + Dependabot.

### Z4 P2 Sync layer test asserts nothing
- File: src/components/sync/financeSync.test.ts:34-66 (7 mocks, 6 expects)
- Problem: asserts only "returns a Promise", "does not throw", "resolves undefined with no pending flush". Everything meaningful is mocked. `SupabaseFinanceSync.ts` (589 lines, where B1 flush/rebaseline lived) has no behavioural test of flush-failure-keeps-baseline; only the 13-line `flushBaseline.ts` helper is covered. `remote/sync.ts` is covered by syncIntegrity.test.ts.
- Fix: test runFullSync with a failing flush and assert prevSnap is not advanced.

### Z5 P2 No coverage tooling or threshold
- File: package.json, vitest.config.ts
- Problem: no `@vitest/coverage-v8`, no coverage script, no threshold, CI cannot detect regression. `/coverage` is gitignored but never produced.
- Fix: add dev dep (separate change), `coverage.thresholds` on src/lib/utils, savings, debt, sms, supabase/remote.

### Z6 P2 Risk-ranked untested code (static gap map)
Ranked by risk weight (money, auth, sync, SMS):
1. src/app/api/sms/parse/route.ts (1551 lines): no test imports it; the whole ingest orchestration (dedupe, pairing hand-off, AI tiers, booking) is untested at route level.
2. src/app/api/cron/month-carry/route.ts (244) + cron/notifications (240) + cron/prices (33) + cron/integrations: money-moving crons untested (only cronAuth and carryDateLogic helpers covered).
3. src/lib/supabase/remote/rpc.ts (156): wrapper for deposit/withdraw/debt-payment RPCs, zero tests.
4. src/lib/sms/runAdjudication.ts (269), sms/harvest.ts, sms/transactionTypes.ts; routes sms/ack, sms/setup-token, sms/health.
5. src/lib/ai/aiActionHandlers.ts (946): applies AI-proposed writes.
6. Auth surface: auth/email-hook, auth/check-email, auth/device/check, auth/password-updated, push/register, devices, devices/[id], support/submit, webhooks/{resend,sentry,linear} (signature verification untested).
7. Prices: prices/runPriceRefresh.ts, fetchSpot.ts, fetchKeyed.ts, rates and gold routes, prices/refresh (service-role write).
8. src/lib/debt/buildDebtFromIncomeFlow.ts, income/paydaySummary.ts, savings/simpleMonth.ts, admin users/[id]/financial + export routes.
9. Native: src/lib/native has 18 files, only 5 tested directly (pushNotifications, cameraScanner, notificationParser, voiceRecorder untested).
10. No component or hook tests at all (vitest env is `node`, no `.test.tsx`): useNotifications, useBuddgyMood, UI logic untested.
Well covered: calculations.ts, currency.ts, monthlyStats.ts, pairing.ts, dispatch.ts, templateApply.ts, all 25 mappers (direct), delta.ts, sync.ts.
- Fix: route-level tests with mocked Supabase for the first 3 items before anything else.

### Z7 P2 Timezone-dependent test, suite pinned to nothing
- File: src/lib/subscriptions/subscriptionOccurrence.test.ts:15-16,29-31 (helper `win` uses `new Date('2026-07-10')`)
- Problem: ISO date-only string is UTC midnight; in America/New_York it is the previous local day, so "rolls on the charge date" gets `[2026-06-10, 2026-07-10]`. Same pattern: 13 uses in 4 files (calculations.test.ts 6, subscriptionOccurrence 4, fundingBasis 2, hawl 1); others happen to pass. vitest.config.ts and CI pin no TZ, so CI (UTC) and the Cairo-based product never meet in the test run.
- Fix: construct local dates (`new Date(y, m, d)` / `parseISO`) and set `process.env.TZ` in a vitest globalSetup; add a CI matrix leg with TZ=Africa/Cairo.

### Z8 P2 Duplicate and gapped migration numbering
- File: supabase/migrations
- Evidence: 12 version numbers used twice: 0065, 0079, 0092, 0093, 0096 to 0103 (e.g. 0097_savings_vault_and_default_carry + 0097_sms_template_states). Supabase CLI keys migrations by numeric prefix, so `db push`/`migration repair` collide. Gaps: 0129, 0193 (applied then dropped by 0196, no file), numeric scheme 001-007 then 0027+ (008-0026 absent). Guards: destructive statements outside 0032 and 0083 (dedup DELETE, guarded by keeper CTE) are `if exists`. Extends D2.
- Fix: renumber to unique timestamps and align with the live ledger; add a CI check for unique prefixes.

### Z9 P2 Env contract undocumented and not validated at boot
- Evidence: ~50 env vars read; `.env.example` documents 15 (native-only by design). Undocumented in both `.env.example` and docs: CRON_SECRET, FINNHUB_KEY, GOLDAPI_IO_KEY, GOLDPRICEZ_KEY, FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY, AI_RATE_LIMIT_*, NEXT_PUBLIC_DEV_AUTH_BYPASS/NATIVE_SHELL/PWA_DEV/SENTRY_DEV. No zod/env schema anywhere. docs/VERCEL_DEPLOY.md names `SUPABASE_SERVICE_ROLE_KEY` while code prefers `SUPABASE_SECRET_KEY` (instrumentation-node.ts:7 and ai/quota.ts:58 check only the latter, so a deploy using the documented legacy name skips the email seed and AI quota path).
- src/middleware.ts: when `isSupabaseConfigured()` is false every request passes through with only a CSP header (fail-open); a misconfigured prod deploy serves the app and API without the auth refresh/gate instead of failing the health check.
- Missing CRON_SECRET: crons 401 (fail-closed, good) but nothing alerts; `/api/admin/platform` lists some keys only.
- NEXT_PUBLIC secrets: none found; Supabase publishable/anon keys and Google client IDs only. DEV_AUTH_BYPASS is gated on NODE_ENV !== 'production'.
- Fix: central `env.ts` zod schema validated in instrumentation; unify key name; list all vars in docs.

### Z10 P2 Live-network eval inside the default `npm test`
- File: src/lib/ai/buddgy.eval.test.ts:16,124
- Problem: `describe.skipIf(!KEY)` on GEMINI_API_KEY and the file is under the default include. A dev with the key exported (or a CI that later adds it) runs live Gemini calls inside `npm test`: cost, nondeterminism, flake. `eval:ai` script is the intended entry.
- Fix: exclude `*.eval.test.ts` in vitest.config and run only via `eval:ai` with a separate config.

### Z11 P2 CI gate is thin and after the fact
- File: .github/workflows/ci.yml
- Problems: runs only on push to main + PR to main, while workflow pushes dev and main together, so broken code is already on main (and scripts/native-release.sh only checks `merge-base --is-ancestor HEAD origin/main`, not that CI is green). Build step injects real `SUPABASE_SECRET_KEY` (service role) into every PR run; fork PRs get empty secrets and fail. No `engines`/`.nvmrc` (CI node 22, linear-bot pins node 24). No audit, no coverage, no migration lint, no Z2 pg job. `ios-release.yml`/`android-release.yml` are dispatch-only and kept for reference.
- Fix: build with dummy env (as CLAUDE.md prescribes) instead of the real secret; require green CI before native-release; add engines.

### Z12 P3 tsconfig leniency
- File: tsconfig.json
- `strict` on, but no `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`; target ES2017; `allowJs`; `skipLibCheck`; `include` `**/*.ts` with only node_modules/src/worker/design excluded, so local `tsc` also walks `.claude/worktrees`, `android`, `ios`, `out`. 0 `@ts-ignore/@ts-nocheck/@ts-expect-error` in src (good).

### Z13 P3 ESLint
- File: eslint.config.mjs
- No rules disabled and ignores do not hide src (design, ios, android, .claude, generated only). But only next presets (no `no-floating-promises`, `no-console`, type-aware rules); 55 inline `eslint-disable`, 12 targeting exhaustive-deps/no-explicit-any; 21 standing warnings.

### Z14 P3 Unused and duplicate dependencies
- Unreferenced prod deps: `iceberg-js` (not imported anywhere), `tw-animate-css` (only referenced in .design-sync notes, no `@import` in src css), `@capacitor-community/speech-recognition` and `@capacitor-firebase/messaging` (no JS reference; confirm native-only use before removal). `sharp` (dev) only used by a script yet flagged high via the tree. Lockfile v3 is sane but has 97 packages at multiple versions, including `@img/sharp-*` mixed 0.34.5/0.35.4 binaries.

### Z15 P3 Version drift
- supabase-js locked 2.99.3 (latest 2.118), `@supabase/ssr` 0.6.1 (0.12.7; auth cookie fixes), vitest 4.1.0 (4.1.12), react 19.2.4 pinned (19.3.1), firebase-admin 13 (14), `@sentry/react` pinned 10.69.0 while `@sentry/capacitor` pinned 4.4.0 (exact pins, no auto security patches).

### Z16 P3 Secrets and tracked sensitive files
- `git grep` on tracked files: no sk_live, service_role keys, gsk_, re_, lin_api, private keys, or tokens. Only hits: a Firebase client key in android/app/google-services.json (public by design, but confirm it is restricted by package + SHA) and a fake JWT fixture in src/lib/crash/scrub.test.ts. Inconsistency: ios GoogleService-Info.plist is gitignored but google-services.json is tracked. `.gitignore` lacks `*.p8`, `*.mobileprovision`, generic `*.p12` (only android/ci-debug.p12), while scripts/ci-secrets.sh handles an App Store Connect .p8.

### Z17 P3 scripts/ risks
- native-release.sh: bumps version numbers in place with `sed -i` before any build; any later failure (set -e) leaves the tree dirty with no trap, and the next run refuses to start ("not clean"). Android artifact is `assembleDebug` (debug-signed, debuggable) shipped to Drive. Pushes straight to dev and main.
- ci-secrets.sh uploads Android debug keystore, rclone.conf, ASC key to GitHub secrets (high-value, for workflows described as unused).
- linear-bot.sh: `claude -p --dangerously-skip-permissions` hourly with hard-coded absolute paths and /tmp lock; documented inactive, make sure the launchd job is unloaded.
- scripts/qa/setup.sh: `drop database if exists qa` on whatever PGHOST points at (defaults to a local socket); only the `qa` db, low risk.
- postinstall `patch-android-plugins.mjs` runs on every `npm ci` including Vercel/CI; it skips silently if the plugin is absent, so a plugin layout change fails open.

### Z18 P3 Repo weight
- Duplicate binaries: assets/ and design/buddget-logo/ each carry icon-background.png (736 KB) and icon-only.png (660 KB); docs/subscriptions-redesign/gcc/logos/hafilat.png is 1.6 MB. .vercelignore excludes design/ but not docs/ or assets/.

### Z19 P3 vercel.json and next.config
- vercel.json: single region sin1 for Egypt/GCC users, 3 crons (month-carry intentionally unscheduled, known). next.config.ts: sane headers (nosniff, DENY, HSTS preload); deprecated X-XSS-Protection; CSP is in middleware (style-src unsafe-inline, img-src https:), not in headers(), so Capacitor static export gets no CSP from it; `middleware.ts` name is the deprecated Next 16 convention.

### Z20 P3 Test hygiene minor
- Time-relative tests (`Date.now()` offsets) in 15 files without fake timers (account/delete, device trust, welcome, entitlements, subscriptionPricing, normaliseReceipt, usePendingAiJobs, admin session, accounts actions, mappers): not failing today but day-boundary flake possible (normaliseReceipt builds dates with `toISOString().slice(0,10)`, UTC).
- Mock-heavy low-assert route tests: voice/transcribe (5 mocks, 2 expects, only checks timeout option), push/send (5 mocks, 5 expects), ai route (8 mocks, 9 expects).

### Z21 P3 Missing pre-release hygiene items
- No `engines`, no `.nvmrc`, no dependabot, no CODEOWNERS; `npm test` count in CLAUDE.md is stale (79 tests vs 3200+).

## Release-readiness go/no-go (this area only)

| Check | Status | Note |
|---|---|---|
| Unit suite green, TZ=UTC / Cairo / Kiritimati | GO | all pass |
| Unit suite green in America/New_York | CONDITIONAL | Z7, test-only bug, no product impact |
| Shuffle / order independence | GO | 2 runs green |
| No skipped-without-reason tests | CONDITIONAL | pg suites skip silently in CI (Z2) |
| Coverage measured and gated | NO-GO (process) | Z5; static gap map shows sms/parse, crons, rpc.ts untested (Z6) |
| Critical/high prod advisories | NO-GO | Z1: next, Capacitor, zod; patch before release |
| Secrets in repo | GO | none found (Z16 notes) |
| Env documented/validated | CONDITIONAL | Z9 |
| Migrations consistent | CONDITIONAL | Z8, duplicate prefixes |
| CI gate before ship | CONDITIONAL | Z11 |
| Native build safety | CONDITIONAL | Z17 (debug APK, dirty-tree failure mode) |
| Lint / tsc | GO | clean per QA_ROUND_PLAN baseline |

Overall: GO for web deploy after bumping next (Z1); NO-GO for a native release until Capacitor is upgraded and rebuilt.

## Areas not reached
- `@vitest/coverage-v8` not installed, so no line/branch coverage numbers (static map only).
- Did not run `npm run build` or `tsc` (covered by other areas); did not check live Vercel env or Supabase ledger; did not read ios/android native Gradle/plist dependency pinning; did not audit mock fidelity of every test file (sampled the 7 most mock-heavy).
