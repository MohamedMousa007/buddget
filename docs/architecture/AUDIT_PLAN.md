# Buddget architecture & performance audit: work plan by model

Audit and planning only. Nothing in `src/`, `supabase/`, env, packages or deploy config changes. Output: the five reports in `docs/architecture/`, vetted skills in `.claude/skills/`, one PR (owner merges).

Known before starting (2026-11-26): tree clean on `claude/buddget-audit-68c548`; one Next.js app serves the main app, the marketing sites and the admin portal (`src/app/api/admin`, `docs/ADMIN_PORTAL.md`); Supabase Postgres `tzioppxwsljhlglyducm` (Frankfurt); 341 migration files; no `.claude/skills/` yet; `docs/DB_SCALING_PLAN.md` already lists measured hot spots and is the baseline for Phase 9.

## Model assignment rule

| Model | Used for | Why |
|---|---|---|
| Haiku 5.5 | Inventories: route/RPC/table lists, grep sweeps, skill repo metadata (stars, last commit, SHA, license text) | Mechanical, high volume, no judgment; cheapest |
| Sonnet 5.5 | Code-path audits per area (queries/N+1, pagination, frontend/images/caching, throttling, admin), skill security read-through | Reads lots of code and reasons per call site; good cost/quality |
| Opus 5.5 (this session) | Live DB read-only evidence, schema/index judgment, license decision, synthesis, severity calls, roadmap, final review | Cross-cutting judgment, and the DB rules in `CLAUDE.md` need care |

Each subagent writes its raw findings to `docs/architecture/_work/<id>.md` (file:line evidence, proven vs potential), so work survives a reset. `_work/` stays as the linked evidence appendix (local paths scrubbed).

## Waves

### Wave 1: inventory (parallel)
- **W1a, Haiku.** Map `src/app/api/**` routes (main vs admin vs cron vs webhook), Supabase call sites (`.from(`, `.rpc(`, `select('*')`, missing `.limit`/`.range`), crons in `vercel.json`, image/`<img>`/`next/image` usage, rate-limit helpers, cache headers / `revalidate` / `unstable_cache`. Inputs for phases 1, 3, 5, 6, 7, 10.
- **W1b, Haiku.** For the three named skills plus candidates (official `supabase/agent-skills`; ecc `postgres-patterns` / `database-migrations` are already installed as plugins), fetch repo stars, last commit date, skill-path SHA, full LICENSE text, file list. Download into the scratchpad only. Phase 12.5-12.6.

### Wave 2: area audits (parallel)
- **W2a, Sonnet.** Main-app data access: N+1, loops of queries, over-fetching, waterfalls, unbounded lists, OFFSET use, sort stability. Phases 3, 5.
- **W2b, Sonnet.** Admin portal: tables, search, dashboard aggregates, bulk actions, role checks, audit-log growth. Phases 5, 10, 11.
- **W2c, Sonnet.** Frontend and delivery: bundles/code-splitting, skeletons, re-renders, images (receipts are device-local by design), caching layers, HTTP headers, throttling on auth/AI/SMS/upload. Phases 6, 7, 8, 10.
- **W2d, Sonnet.** Security read-through of every downloaded skill file (scripts, network calls, env access, instruction overrides). Phase 12.7.
- **W2e, Opus (main).** Live DB, read-only, one query at a time, counts and ids only: `list_tables`, `list_extensions` (is `pg_stat_statements` on), `get_advisors` (performance + security), index inventory, table sizes with `LIMIT`, `EXPLAIN` (no `ANALYZE`) on the hot paths W1a finds. Schema/constraint/FK-index review against `database.types.ts`. Phases 2, 4, 9.

### Wave 3: decisions and synthesis (Opus, main)
- Commons Clause verdict for `database-designer`; install only skills that pass licence + security + Postgres relevance into `.claude/skills/<name>/`, recording SHA and date. Phases 12.8-12.9.
- Cross-check W2 findings against W2e evidence and skill guidance; assign IDs, severity, proven / potential / not verified. Phase 13.
- Write `database-performance-audit.md`, `application-architecture-audit.md`, `skills-evaluation-and-installation.md`, `performance-optimization-roadmap.md`, `architecture-diagrams.md`. Phases 1, 11, 14.

### Wave 4: independent check (Sonnet, fresh context)
- Given only the reports and the code, re-verify every HIGH/CRITICAL finding's file:line and claim; flag anything overstated. Opus folds corrections in and opens the PR.

## Guardrails
- No writes to the live DB, no `EXPLAIN ANALYZE` on live, no extension or config changes, no SQL copied from a skill.
- No `.env*` values read; variable names only.
- No tests or dev server (owner rule 2026-11-24); an audit needs none.
- `git add` only `docs/architecture/**` and `.claude/skills/**`.

## Cost shape
About 2 Haiku and 5 Sonnet subagents, with Opus for DB evidence and synthesis. Opus stays off bulk reading.
