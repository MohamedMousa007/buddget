# QA Round 5: shared brief for the closing fixer agents

Goal: close the last open Round 5 findings COMPLETELY (no "partial", no "product decision pending": the owner said "continue till all 114 are completely fixed", so where a finding names a product choice, take the recommended option below and record it). Findings text: `docs/qa-round-5/<area>.md` tables, ID in the first column. Overall status: `docs/QA_ROUND_5.md`.

## Hard rules
- You are a FIXER. Edit only the files your assignment needs. Other agents work in the same checkout at the same time on other areas: touch no file outside your area; if a shared file must change (e.g. `en.ts`, `ar.ts`, `useFinanceStore.ts`, `types.ts`, `database.types.ts`), make a minimal additive edit with the Edit tool (never rewrite a whole file) and re-read the region right before editing.
- No git add/commit/push/stash/branch. No `npm run build`, `npm run verify`, whole-repo lint. No native build/TestFlight/Drive step. The coordinator runs the gate and commits.
- Allowed: read, grep, Edit/Write, `npx vitest run <specific paths>`, `npx eslint <specific files>`, `npx tsc --noEmit` at most once at the end (slow).
- Database (project `ydihurtbcnoflhormgzi`, Supabase MCP `execute_sql`; load the tool with ToolSearch `select:mcp__8091367c-4b89-49d7-bb2e-1a800eca19fe__execute_sql` if deferred): CLAUDE.md DB-first rules apply. Write the migration FILE `supabase/migrations/<NNNN>_<name>.sql` (use only the numbers reserved for you) and apply the same SQL live with `execute_sql`. Before any destructive change run a SELECT for row counts. Keep `src/lib/supabase/database.types.ts` in sync (additive Edit). Never print real user rows (SMS bodies, names, numbers, balances); counts and ids only. Do NOT hand-purge SMS.
- Project rules: `CLAUDE.md`, `docs/DESIGN_SYSTEM.md` (tokens only, 44px targets, safe-area), Component Reuse STRICT (reuse existing components; new variants additive; say what you reused). EN and AR strings must both exist (`src/lib/i18n` en.ts/ar.ts). Money exact. Cairo time zone in tests (`TZ=Africa/Cairo`).
- Every fix needs a test that fails without it (or, for SQL, a documented before/after query result). Test the real data shape (grep the write path before trusting a fixture).
- React compiler lint trap: a `useCallback` that reads a new prop/field needs it in the dependency array.

## Report (mandatory, write early, update as you go)
Append a `## Closing fix status` section to your area report(s) (or write `docs/qa-round-5/closing-<your-name>.md`): per ID, one line: what changed (files), test, status `Fixed` / `Fixed (decision: X)`. Be honest: if something cannot be fully closed, say exactly why and what is left. Final chat message at most 150 words: per ID status, migrations applied, files touched, anything left.
