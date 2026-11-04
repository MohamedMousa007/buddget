# Buddget QA Strategy and Run Plan

Created 2026-10-30. Owner: repo owner (single maintainer; see `.agents/qa-project-context.md`). Revision history at the end.
Inputs: `.agents/qa-project-context.md` (stack, risks), risk-based-testing scoring (Impact x Likelihood, 1-5 each), live counts taken this session.

## 1. Scope and objectives
- **In scope:** web app (Next.js, `src/app`, `src/components`, `src/lib`), API route handlers (`src/app/api`, 93 files), Supabase schema and RLS (live project), crons (`vercel.json`), Capacitor shells (iOS and Android), admin portal.
- **Out of scope for this run:** iOS Simulator (not provisioned), real-device SMS/push/biometric/scanner (manual, owner), third-party providers (Gemini, Groq, Linear, Firebase) tested at the contract or mock level only.
- **Objectives (measured this run, 6-week horizon):**
  1. Put every CRITICAL risk area under at least one executed automated test that can fail on a real defect (current: unit tests in `lib` only; no UI, no E2E).
  2. Run the Postgres-backed suites (`*.pg.test.ts`, 6 files, currently skipped) in CI, so RLS and RPC behaviour is tested every push.
  3. Establish one E2E smoke path per top journey (9 journeys in context file) against a preview deploy.
  4. Keep lint at 0 errors and warnings at or below the round-1 level of 21 (currently 45).

## 2. Test levels (current vs target)
| Level | Current count (live this session) | Target | Owner |
|---|---|---|---|
| Unit (`src/lib`, pure logic) | 381 test files, 3903 tests (suite-wide) | keep; add where gaps are | dev |
| API route handler (mocked Supabase) | 25 test files | every money/auth/sms route has one | dev |
| Component/UI | 2 test files | the 10 critical screens (flow, expenses, savings, debts, goals, budget, settings, onboarding, sms review, sheets) | dev |
| Integration (real Postgres, RLS, RPC) | 6 pg test files, **skipped** | run in CI with a Postgres service | dev |
| E2E browser | **0** | 9 journey smoke tests on preview | dev (Playwright, to add) |
| AI eval | 1 file, **skipped** (needs `RUN_AI_EVAL`) | nightly, budgeted | dev |
| Visual / a11y / perf | none | a11y axe on 10 pages; perf budget on /flow and /reports | dev (later phase) |

## 3. Pyramid diagnosis
Shape today: **hourglass with a missing middle.** Unit is heavy (381 files), E2E is absent, and integration exists but never runs (skipped in CI). The bugs that matter (money maths, SMS dedupe, RLS, sync) live in the middle and in the seams, which the suite does not execute. Target shape for the next 6 weeks: unit stays the base; integration against real Postgres goes from 0 running to all RLS and money RPCs; E2E goes from 0 to 9 smoke paths.

Action plan:
1. Add a Postgres service to CI and run `npm run test:pg`. (Phase 1)
2. Write component tests for the 10 critical screens, starting with the sheets that move money. (Phase 2)
3. Add Playwright with the 9 journey smokes on a preview deploy. (Phase 2)

## 4. Risk to test-depth mapping
Scored in the context file. Depth rule: CRITICAL = unit + integration (real DB) + E2E + manual exploratory each release; HIGH = unit + integration + E2E happy path; MEDIUM = unit happy path + key error cases; LOW = manual or skip.

| Area | Score (I x L) | Band | Test depth required |
|---|---|---|---|
| Auth, 2FA, device trust | 5 x 4 = 20 | CRIT | unit + API route + pg (RLS on user_settings) + E2E sign-in + exploratory |
| Money math (currency, savings, gold, debts) | 5 x 4 = 20 | CRIT | unit (exists, broad) + pg RPCs + E2E deposit/withdraw |
| Sync pull/push | 5 x 4 = 20 | CRIT | unit (`syncIntegrity`, exists) + pg `sync_pull_v2` + E2E offline-reconnect |
| SMS ingest and confirm | 4 x 4 = 16 | CRIT | unit (parser) + API route tests + manual on Android |
| AI / Buddgy | 3 x 4 = 12 | HIGH | route tests (exist) + eval nightly + E2E chat smoke |
| Crons | 4 x 3 = 12 | HIGH | route tests (exist) + cron-secret test (exists) |
| Admin portal | 4 x 2 = 8 | MED | pg RBAC (skipped) + API route tests |
| DB RLS and migrations | 5 x 2 = 10 | HIGH | pg (skipped) + advisor run each release |
| Offline and native shell | 3 x 3 = 9 | MED | manual Android + iOS-deferred |
| UI and accessibility | 2 x 4 = 8 | MED | a11y axe on top screens + visual on design system |

## 5. Quality gates (targets; each must be enforced in CI, not a suggestion)
- **PR gate (current, enforced):** lint 0 errors, tsc clean, vitest green, build with dummy env. Enforce warning ceiling 45 today; target 21.
- **PR gate (to add):** pg suite green (Postgres service), coverage on `src/lib/supabase/remote` and `src/lib/utils` not decreasing.
- **Merge gate (to add):** Playwright smoke on preview deploy.
- **Nightly (to add):** AI eval (budgeted), full E2E, `npm audit --omit=dev`.
- **Deploy gate:** Supabase security advisor clean of new ERROR-level items; release-readiness checklist.

## 6. Metrics and cadence
| Metric | Current | Target | Cadence |
|---|---|---|---|
| Test pass rate (executed) | 100% (3903/3903) | 100% | per push |
| Tests skipped (executed suites) | 188 | pg and eval runnable in CI; skips only for explicit reasons | per push |
| Lint errors / warnings | 0 / 45 | 0 / ≤21 | per push |
| Line coverage, `src/lib/utils` + `src/lib/supabase/remote` | not measured in CI (measured by this run, see Section 8) | 80% | per PR (to add) |
| E2E journeys automated | 0 of 9 | 9 of 9 | per merge |
| Flakiness | not tracked | <2% rolling 30 days | weekly once E2E exists |

## 7. Entry and exit criteria
- **Entry (this run):** repo at `claude/relaxed-allen-hixdfp`, deps installed (`npm ci`), skills installed in `.claude/skills/`, live Supabase reachable read-only.
- **Exit (this run):** every CRITICAL area has findings recorded with severity and evidence; all reproducible defects have a failing test or an explicit "not reproduced" note; no finding left without an owner decision (fix, defer with reason, accept).

## 8. Run plan (this QA round, in order, all 8 steps)
1. Context and risk: DONE (context file, risk scores above).
2. Static and automated baseline: lint, tsc, vitest DONE; coverage run in progress (log: `/tmp/claude-0/cov/run.log`); gap list via coverage-analysis and unit-testing next.
3. Database layer: live schema and RLS partly DONE (policies, column grants, triggers). Next: mapper round-trip against `database.types.ts`, pg suite run locally against a DB if a Postgres is available, migrations after 0224 check.
4. Server: api-testing and security-testing over all 93 route files (auth style, zod, rate limit, cron secret, idempotency).
5. AI: ai-system-testing over `/api/ai`, `/api/buddgy/turn`, Buddgy tool specs (auto-apply guard, injection surface).
6. Web UI: test-data-management (seed hooks), playwright-automation smoke (once Playwright is installed in the sandbox), exploratory charters per route, accessibility-testing, visual-testing, performance-testing.
7. Native: mobile-testing on the iOS Simulator only if a runtime is available; otherwise document as not run. Android stays manual.
8. Close-out: compliance-testing (privacy, consent, SMS permissions), bug-reproduction (failing test per P0/P1), ai-bug-triage (dedupe and rank), release-readiness go/no-go.

## 9. Test plan for this run (sprint-style, one page)
- **Scope:** Sections 8 steps 2-8 on the whole app.
- **Capacity:** plan 75% of the run's effort to the steps above; 25% reserved for reproducing and re-verifying findings.
- **Risks to the plan:** no Postgres in the sandbox (pg suites may stay skipped); no iOS runtime; live DB is production (read-only only); no staging environment.
- **Decisions needed from owner (not blocking the run):** staging environment availability; whether the pg suite may run against a disposable Postgres in CI; priority order between auth/2FA fix and money fixes.

## Revision history
- 2026-10-30: first version, from-scratch run. Owner: repo owner.
