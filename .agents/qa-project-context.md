# QA Project Context: Buddget

Generated 2026-10-30 from repo evidence. Sources cited inline. Items marked **Unknown** were not inferable from the repo and need an owner's input.

## Product
- **Name:** Buddget. Personal finance app (budgets, expenses, income, debts, savings, goals, subscriptions, SMS-based expense capture, Buddgy AI assistant). Source: `CLAUDE_CONTEXT.md`, `package.json`.
- **Type:** Consumer mobile + web app (Next.js PWA web app plus Capacitor iOS/Android shells) with an admin portal. Source: `CLAUDE_CONTEXT.md` (Architecture).
- **Environments/URLs:** Production web `https://buddget.app` (native API base per `CLAUDE_CONTEXT.md`). Staging, dev URLs: **Unknown**.
- **Critical user journeys (from code surface; to be confirmed by owner):**
  1. Sign up / sign in (email OTP, Google, biometric unlock) and 2FA device trust.
  2. Add expense / income manually, and reconcile against a budget cycle.
  3. Bank SMS auto-capture: parse, confirm, undo (native Android ingest, `/api/sms/*`).
  4. Savings and wealth: deposit, withdraw, gold/XAU conversion, goals progress.
  5. Debts and card payments, including payment-to-expense linkage.
  6. Offline edit, then sync reconnect (`src/lib/supabase/remote/*`, `src/components/sync/*`).
  7. Month-carry and budget-cycle rollover (`/api/cron/month-carry`).
  8. Account deletion and data export (`/api/account/delete`).
  9. Buddgy chat actions (propose and apply).
- **Flow evidence gap:** no written list of flows owned by product. Items 1-9 are inferred from routes and modules.

## Tech Stack
- **Frontend:** Next.js 16 (App Router, `next build --webpack`), React 19.2.4, TypeScript 5, Tailwind CSS 4, Zustand 5, framer-motion, recharts. Source: `package.json`.
- **Native shell:** Capacitor 8 (`@capacitor/core` ^8.3.4, iOS and Android) with static export. Source: `package.json`, `capacitor.config.ts`, `CLAUDE_CONTEXT.md`.
- **Backend:** Next.js route handlers (`src/app/api/*`, 93 route files) on Vercel (region `sin1`). Source: `vercel.json`.
- **Database and auth:** Supabase (PostgreSQL + RLS + Auth), `@supabase/supabase-js` ^2.49.1, `@supabase/ssr` ^0.6.1. Live project ref `ydihurtbcnoflhormgzi`. Source: `package.json`, `CLAUDE_CONTEXT.md`.
- **AI:** Gemini (`/api/ai`, `/api/buddgy/turn`), Groq whisper (voice). Source: `CLAUDE_CONTEXT.md`.
- **Push:** Web Push/VAPID, and Firebase Cloud Messaging for native (`firebase-admin`). Source: `package.json`, `CLAUDE_CONTEXT.md`.
- **Observability:** Sentry (`@sentry/react` 10.69.0, `@sentry/capacitor` 4.4.0). Source: `package.json`.
- **Validation:** zod ^4.3.6 (server routes; the client bundle does not ship zod per round notes; verify before relying on it).
- **Monorepo:** No. Single `package.json` at the root (no `turbo.json`, `nx.json`, `pnpm-workspace.yaml`).
- **Node:** `>=22` (`engines`), `.nvmrc` used by CI.

## Test Stack
### Unit / Integration (Vitest)
- **Framework:** Vitest ^4.1.0 (`package.json` devDependencies). Resolved version: check `package-lock.json` before relying on it.
- **Config:** `vitest.config.ts`.
- **Test files:** 453 `*.test.ts(x)` files under `src/`. Last full run this session: 446 files passed, 6 skipped; 3903 tests passed, 188 skipped (`.pg.test.ts` need `QA_PG_URL`; `buddgy.eval.test.ts` needs `RUN_AI_EVAL`). Executes locally: **yes**. Execution in CI: **yes** (`.github/workflows/ci.yml`, matrix TZ Africa/Cairo and America/New_York).
- **Coverage:** `@vitest/coverage-v8` ^4.1.12 is declared and `npm run test:coverage` exists. No coverage threshold is enforced in CI. Coverage run result: **not yet measured in this QA pass**.
- **Postgres-backed tests:** `npm run test:pg` (needs `scripts/qa/setup.sh` and a local Postgres on port 54329). Not run in CI.

### Type checking and linting
- **TypeScript:** `npx tsc --noEmit` (CI typecheck job).
- **ESLint:** `eslint` ^9, `eslint-config-next` 16.2.1 (`npm run lint`). Last run: 0 errors, 45 warnings.

### E2E / Browser
- **Framework:** None selected. No `playwright.config.*` or `cypress.config.*` in the repo. Default per Principle 3: Playwright (`playwright-automation`). A Chromium is pre-installed in the sandbox at `/opt/pw-browsers/chromium`.
- **Interim UI verification:** none in the repo.

### API
- **Framework:** None. Route handlers are tested with Vitest (`src/app/api/cron/cronRoutes.test.ts`, `sms-harvest/route.test.ts`, and others).

### Visual, performance, accessibility, mobile
- **None configured** in the repo. Visual: none. Performance: none (no k6, no Lighthouse CI). Accessibility: none automated. Mobile: manual on Android by owner; iOS Simulator not provisioned.

## CI/CD
- **Platform:** GitHub Actions (`.github/workflows/ci.yml`, `android-release.yml`, `ios-release.yml`).
- **Triggers:** push to `dev` and `main` (docs and `*.md` ignored), PR (same ignores), weekly cron `17 5 * * 1`. Concurrency cancels in-progress runs.
- **Jobs in ci.yml:** `lint`, `typecheck`, `test` (matrix TZ Cairo + New York), `build` (dummy Supabase env; no real secrets on PR runs).
- **Blocking:** lint errors, tsc errors, failing tests, failing build.
- **Not in CI:** `npm audit`, Postgres-backed tests, coverage thresholds, E2E, a11y, visual.
- **Native release:** Per `CLAUDE.md`, native builds are on-demand and local (`scripts/native-release.sh`). Actions workflows `ios-release.yml`/`android-release.yml` are kept for reference only.
- **Scheduled jobs (Vercel crons, `vercel.json`):** `/api/cron/notifications` 06:00 daily, `/api/cron/prices` 03:00, `/api/cron/integrations` 05:30, `/api/cron/sms-harvest` 04:10. `/api/cron/month-carry` is **not** listed in `vercel.json` (intentional per `CLAUDE_CONTEXT.md`/route header, pending sign-off).

## Environments
- **Production:** Vercel (`sin1`), Supabase project `ydihurtbcnoflhormgzi` (ap-southeast-1). Native apps call `https://buddget.app` through `NEXT_PUBLIC_API_BASE_URL`.
- **Staging:** **Unknown.** No staging project found in the repo.
- **Development:** `npm run dev` (Next dev with webpack) against live Supabase, or dummy env for build only. Local Postgres via `scripts/qa/setup.sh`.
- **Parity risks:** Test suite pinned to Africa/Cairo timezone (product wall clock). Production cron times are UTC. Staging parity: **Unknown**.
- **Mocks:** Unit tests mock Supabase and external APIs. Real Gemini, Groq, Firebase, Linear and Sentry are not exercised by tests (keys absent in CI).

## Quality Goals
No agreed numeric targets were found in the repo. Proposed starting targets below are **proposals, not agreed**; owner to confirm.

| Metric | Current observed | Proposed target (Growth-stage) | Status |
|---|---|---|---|
| Unit test pass rate | 100% of executed (3903/3903) | 100% | Measured |
| Lint errors | 0 | 0 | Measured |
| Lint warnings | 45 | ≤ 21 (last round level) | Measured, rising |
| Line coverage (src/lib + src/app/api) | Not measured this pass | 80% on money/sync/sms modules | **Unknown** |
| Flake rate | Not tracked | <2% over rolling 30 days | **Unknown** |
| Suite duration | Not measured this pass | Unit <3 min | **Unknown** |
| E2E coverage | None | Top 5 journeys above | Not started |

## Risk Areas
Scores are proposals (Impact 1-5 x Probability 1-5) grounded in code evidence. Owner to confirm impact; probability reflects code observed this pass.

| Area | Risk Level | Business Impact | Notes / evidence |
|---|---|---|---|
| Auth, 2FA, device trust (`src/app/api/auth/*`, `trusted_devices`, `user_settings.two_factor_email_enabled`) | Critical (proposed I5 x P4) | Account takeover, credential exposure | `two_factor_email_enabled` is writable by the user via RLS and not guarded by a trigger; the reauth route is bypassable through PostgREST (verified against live schema earlier this session, not exercised). |
| Money math (`src/lib/utils/currency.ts`, `calculations.ts`, savings, gold/XAU, debts) | Critical (proposed I5 x P4) | Wrong balances, wrong net worth | Round-level finding history; XAU unit fixed in `currency.ts:34`. Many conversion paths. |
| Sync pull/push (`src/lib/supabase/remote/*`, `SupabaseFinanceSync.ts`) | Critical (proposed I5 x P4) | Data loss or resurrection across devices | Delta pull contract matches live `sync_pull`. Active-plan deactivation does not propagate (`delta.ts:164`, `merge.ts:41`, reasoned). |
| SMS ingest and confirm (`/api/sms/*`, native `smsTracker`) | High (proposed I4 x P4) | Missed or duplicate expenses; privacy of raw bank SMS | Retention cron health and raw body storage are high-sensitivity; not re-audited this pass. |
| AI and Buddgy (`/api/ai`, `/api/buddgy/turn`, `src/lib/buddgy/*`) | High (proposed I3 x P4) | Cost abuse, wrong proposals applied | `/api/ai` relays client `systemInstruction`; auto-apply `add_expense` bounded (10k base, 7 days, 5/min per process). |
| Crons (`/api/cron/*`) | Medium-High (proposed I4 x P3) | Missed notifications, wrong FX in month-carry | `CRON_SECRET` checked; `month-carry` not scheduled in `vercel.json`. |
| Admin portal (`/api/admin/*`, `/admin`) | Medium (proposed I4 x P2) | Staff privilege misuse | RBAC tests exist but pg suites are skipped without `QA_PG_URL`. |
| Database RLS and migrations (live `ydihurtbcnoflhormgzi`) | High (proposed I5 x P2) | Cross-tenant data exposure | 84 tables with RLS; many policies on PUBLIC role; leaked-password protection off. |
| Offline and native shell (Capacitor, Android SMS, biometrics, push) | Medium (proposed I3 x P3) | Lost offline edits, native-only failures | Real-device paths (SMS, push, biometric, scanner) manual only. |
| UI and accessibility (design system, 375px layouts, Arabic/RTL, dark mode) | Medium (proposed I2 x P4) | UX defects, touch-target misses | Not automated; DESIGN_SYSTEM rules exist in `docs/DESIGN_SYSTEM.md`. |

## Team
- **Headcount and roles:** **Unknown.** Repo shows a single owner (`m.mousaofficial@gmail.com` per session context) plus AI-assisted development. No other contributors identified from repo metadata.
- **Dev:QA ratio:** Not applicable as recorded. Effectively solo. Ownership model: developer owns all tests; QA role is strategy plus critical-path automation done by the developer (per qa-project-context ratio table, "Solo").
- **Methodology:** **Unknown.** Workflow in `CLAUDE.md`: classify tier, scope, execute, verify, auto-push. No plan-approval step; branches `dev` and `main` only.

## Conventions
- **Test file naming:** `*.test.ts` / `*.test.tsx` co-located with source; Postgres suites `*.pg.test.ts`; AI eval `*.eval.test.ts`. (Observed.)
- **Test location:** Co-located under `src/`. Admin harness at `src/lib/server/admin/__tests__/harness/`.
- **Branching:** `dev` is the integration branch; `main` is production; CI runs on both. `CLAUDE.md` says auto-merge `dev` to `main`. No feature branches per `CLAUDE.md`.
- **Pre-commit gate (CLAUDE.md, mandatory):** `npm run lint` (0 errors), `npm run test` (all pass), `npm run build` with dummy Supabase env, and a diff code audit.
- **Selectors (E2E):** None established. Recommendation when E2E is added: `data-testid` in kebab-case (e.g. `invoke-create-button`), per the qa-project-context default. Record team preference: **Unknown**.
- **Test data:** Unit tests use inline factories and mocks. Seed hooks `__finance` / `__settings` exist in the app (per test-data-management skill reference; verify in code before use).
- **Timezone:** Tests run with `TZ=Africa/Cairo` by default; CI also runs America/New_York.
- **Secrets:** Never printed in logs or docs. Live DB access via MCP only.
