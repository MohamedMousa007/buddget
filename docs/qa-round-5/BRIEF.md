# QA Round 5: shared brief for finder agents

Goal: find real, reproducible defects in your assigned area of the Buddgy app (personal finance: Next.js 16, Zustand, Supabase, Capacitor). Depth and honesty over volume: a finding counts only with evidence. Do not pad the list; do not invent bugs. Prior rounds: `docs/QA_ROUND_2_STATUS.md`, `docs/QA_ROUND_3_VALIDATION.md`, `docs/QA_ROUND_4.md` (read the "Open" and "Fixed" tables so you do not re-report known items).

## Hard rules
- You are a FINDER. Do not edit anything under `src/`, `supabase/`, `scripts/`, config files or docs other than your own report. Do not fix bugs.
- No git commits, pushes, stashes, branch switches. Do not run `npm run build`, `npm run verify`, `npm run lint` on the whole repo, or any native build/TestFlight/Drive step. Other agents share this checkout and run at the same time.
- Allowed commands: read files, grep, `npx vitest run <paths>` on specific files, `npx tsc --noEmit` only if you need it (slow, run at most once), read-only SQL (SELECT only, project `ydihurtbcnoflhormgzi`, via the Supabase `execute_sql` tool; never INSERT/UPDATE/DELETE/DDL).
- Repro tests: create them ONLY under `src/__qa5__/<your-area>/` with a `.test.ts` suffix, run them with `npx vitest run src/__qa5__/<your-area>`. When done, MOVE every repro you want to keep to `docs/qa-round-5/repro/<your-area>/<name>.test.ts.txt` and delete `src/__qa5__/<your-area>/`. Never leave files in `src/`. Test env time zone is Africa/Cairo (`TZ=Africa/Cairo`); also try `TZ=America/New_York` where dates matter.
- SMS content: only masked/synthetic data. Never print real user rows (names, numbers, card tails, balances) in your report; use counts and ids only.
- Project rules to judge code against: `CLAUDE.md`, `docs/DESIGN_SYSTEM.md` (tokens only, no hardcoded hex, 44x44 touch targets, safe-area), Component Reuse rules. Money maths must be exact (no float drift shown to users), month/cycle boundaries correct in Cairo time.
- Project QA skills live in `.claude/skills/<name>/SKILL.md`; read the ones named in your assignment first, plus `.agents/qa-project-context.md`.

## What counts as a defect
Wrong number, wrong state after an action, crash or unhandled rejection, data loss, double-counting, auth/ownership gap, missing validation at a trust boundary, race condition, timezone or boundary error, broken a11y, wrong or missing translation (EN/AR), unreachable or dead UI path, contract mismatch between two files, error swallowed silently. Style nits and refactors are NOT defects.

## Method
1. Map your area (files, entry points, callers). 2. Read the code adversarially: inverted conditions, off-by-one, falsy-zero, null deref, missing await, stale closure, wrong variable, cross-file contract breaks. 3. Probe with tests/queries: boundary values, empty/huge/negative/unicode input, duplicate and concurrent calls, month ends, DST/time-zone, Arabic locale. 4. Reproduce before you report. Mark static-only suspicions as `Static`.

## Report (mandatory)
Write `docs/qa-round-5/<your-area>.md`:
- One line on what you covered and what you did NOT cover.
- Table: `ID | P | file:line | finding | evidence | suggested fix | status`. IDs use your area prefix + number. P0 = data loss/security/crash on core path, P1 = wrong money/ownership/major flow broken, P2 = wrong behaviour with workaround, P3 = polish/edge. Status = `Confirmed` (a test/query/run shows it) or `Static` (code reading only).
- Evidence column: the repro file name and the observed vs expected values, or the SQL and counts.
- Finish with `Coverage:` a list of the files/areas you read fully versus skimmed.

Your final chat message to the coordinator must be at most 150 words: counts per priority (Confirmed/Static), the 3 most serious findings by ID, and the report path.
