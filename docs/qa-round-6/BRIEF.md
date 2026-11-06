# QA Round 6: shared brief for finder agents

Goal: a VERY deep, adversarial pass over the Buddgy app (personal finance: Next.js 16, Zustand, Supabase, Capacitor) to (1) find every P0/P1 still hiding, (2) prove the areas that are clean are clean, and (3) find as many P2/P3 defects as possible. Depth and honesty over volume: a finding counts only with evidence; do not invent bugs, do not pad.

Prior rounds: read `docs/QA_ROUND_5.md` ("Not covered" and the fixed tables), `docs/QA_ROUND_4.md`, `docs/QA_ROUND_3_VALIDATION.md` so you do not re-report known items. Round 5 reports and repros are in `docs/qa-round-5/`. Round 5 fixed 114 findings; the code changed a lot in the last two days (stale-write trigger 0232, SMS pairing 0234/0235, trusted-device secret 0236, payday weekend rule, savings-funded link 0239, ModalHeading, ...): newly written code is the most likely place for fresh bugs. Use `git log --since=2026-11-04 --stat` to see it.

## Hard rules
- You are a FINDER. Do not edit anything under `src/`, `supabase/`, `scripts/`, `android/`, `ios/`, config files or docs other than your own report. Do not fix bugs.
- No git add/commit/push/stash/branch/checkout. Do not run `npm run build`, `npm run verify`, `npm run lint` on the whole repo, any native build/TestFlight/Drive step, or a dev server (a coordinator runs the live sweep alone). Other agents share this checkout at the same time.
- Allowed: read files, grep, `npx vitest run <specific paths>`, `npx tsc --noEmit` at most once if needed, read-only SQL (SELECT/EXPLAIN only; never INSERT/UPDATE/DELETE/DDL outside a transaction you ROLL BACK; if you need to prove a write-path bug, use a single `BEGIN; ...; ROLLBACK;` statement block on rows you create yourself, never touching real users' rows) on project `ydihurtbcnoflhormgzi` via the Supabase MCP `execute_sql` tool (pass `project_id`; load with ToolSearch `select:mcp__8091367c-4b89-49d7-bb2e-1a800eca19fe__execute_sql` if deferred). `get_advisors`, `list_tables`, `list_migrations`, `query_logs` are fine.
- Repro tests: create them ONLY under `src/__qa6__/<your-area>/` with a `.test.ts` suffix and run with `npx vitest run src/__qa6__/<your-area>`. When done, MOVE every repro you want to keep to `docs/qa-round-6/repro/<your-area>/<name>.test.ts.txt` and delete `src/__qa6__/<your-area>/`. Never leave files in `src/`. Test env TZ is Africa/Cairo; also run `TZ=America/New_York` and `TZ=Asia/Riyadh` where dates matter. Property/fuzz tests are encouraged (write a small seeded generator by hand; do not add dependencies).
- Never print real user data (names, emails, phone numbers, SMS bodies, card tails, balances, tokens). Counts, ids (first 8 chars) and synthetic values only.
- Project rules to judge code against: `CLAUDE.md`, `docs/DESIGN_SYSTEM.md`, `docs/MONEY_MOVEMENT.md`, `docs/OFFLINE_GUIDE.md`, Component Reuse rules. Money maths must be exact; cycle/month boundaries correct in Cairo time.
- Project QA skills: `.claude/skills/<name>/SKILL.md` (accessibility-testing, ai-bug-triage, ai-system-testing, api-testing, bug-reproduction, compliance-testing, coverage-analysis, database-testing, exploratory-testing, mobile-testing, performance-testing, playwright-automation, release-readiness, risk-based-testing, security-testing, test-data-management, test-planning, test-strategy, unit-testing, visual-testing) and `.agents/qa-project-context.md`. Read the ones named in your assignment first and apply their techniques (state them in your report).
- Machine care: other agents run in parallel. Do not run the full test suite; scope vitest to your paths. Write your report file EARLY (after your first findings) and keep updating it: a previous round lost work when agents hit the usage limit. If you are about to run out of budget, finish the report first.

## What counts as a defect
Wrong number, wrong state after an action, crash/unhandled rejection, data loss, double-counting, auth/ownership/tenant gap, missing validation at a trust boundary, race condition, timezone/boundary error, broken a11y, wrong or missing EN/AR translation, dead UI path, contract mismatch between two files, error swallowed silently, privacy/PII leak, unbounded cost or abuse path. Style nits and refactors are NOT defects.

## Severity
P0 = data loss, security breach, cross-tenant access, money minted/destroyed, crash on a core path, app unusable. P1 = wrong money or ownership, major flow broken, silent loss of user data. P2 = wrong behaviour with a workaround. P3 = polish/edge.

## Method
1. Map your area (files, entry points, callers, DB objects). 2. Read adversarially: inverted conditions, off-by-one, falsy-zero, null deref, missing await, stale closure, wrong variable, cross-file contract breaks, unhandled promise, partial failure between two writes. 3. Probe: boundary values, empty/huge/negative/unicode/Arabic-digit input, duplicate and concurrent calls, month ends, leap day, DST, 29-31 start days, zero/one/many rows, 40k rows, nulls, deleted/tombstoned rows, offline then online. 4. Reproduce before you report; mark static-only suspicions `Static`. 5. Check the opposite too: for each critical invariant in your area, write the check that would prove it holds and record the result (this is how "clean" is evidenced).

## Report (mandatory) `docs/qa-round-6/<your-area>.md`
- One line: what you covered and what you did NOT.
- Table: `ID | P | file:line | finding | evidence | suggested fix | status`. IDs use your area prefix + number. Status = `Confirmed` (test/query/run shows it) or `Static`.
- Evidence: repro file name and observed vs expected, or the SQL and counts (no real data).
- A second table `Verified clean`: `Invariant / check | how verified | result`. At least 10 rows for your area: this is the evidence that the area is free of P0/P1.
- Finish with `Coverage:` files/objects read fully vs skimmed, and `Skills used:`.

Your final chat message to the coordinator: at most 150 words: counts per priority (Confirmed/Static), the 3 most serious IDs, the report path.
