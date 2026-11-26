# W2d: Security and quality review of downloaded Postgres/Supabase skills

Date: 2026-11-26. Method: read-only (cat/grep). Nothing executed, imported or installed. Source: `<scratchpad>/skills-src/`. Metadata from `W1b-skills-metadata.md`.

## Verdict table

| Skill | Safety | Recommendation | Main reason |
|---|---|---|---|
| supabase-postgres-best-practices (supabase/agent-skills) | SAFE | INSTALL | MIT, first-party, docs only, no scripts, correct `(select auth.uid())` guidance |
| supabase (supabase/agent-skills) | SAFE WITH NOTES | REFERENCE ONLY (or INSTALL after trimming 3 instructions) | No skill-level licence field (repo MIT); tells agent to fetch web pages, create `.mcp.json`, file GitHub issues; some advice conflicts with this repo's migration workflow |
| postgresql-code-review (github/awesome-copilot) | SAFE WITH NOTES | REJECT (reference only at most) | Clean, but generic and contains technically wrong or harmful advice for a Supabase app |
| database-designer (borghei) | SAFE WITH NOTES (scripts clean) | REJECT | MIT + Commons Clause (not open source, resale restriction), not Supabase-aware, 130 KB of Python for little gain |
| postgres-performance (CJHarmath) | SAFE | REJECT | No licence (all rights reserved), 12 installs, SQLAlchemy/FastAPI flavoured |
| pgbot postgres-diagnostics | UNSAFE as written | REJECT | Instructs `curl -fsSL https://pgbot.dev/install \| sh` and `npx @pgbot/cli`; needs DSN credentials; no skill-level licence |
| agentic / openai / fcakyon copies of supabase-postgres-best-practices | SAFE | REJECT (duplicates) | Same content as the official one; use the upstream source |

No file in any folder contains a prompt-injection payload, hidden instruction, `allowed-tools`, hooks, or an override of user/safety rules. The only real risk found is the pgbot install line.

## 1. Frontmatter

| Skill | Valid YAML | name / description | licence field | allowed-tools / hooks |
|---|---|---|---|---|
| supabase-postgres-best-practices | yes | both | MIT | none |
| supabase | yes | both | none (metadata: author, version 0.1.2) | none |
| postgresql-code-review | yes | both | none | none |
| database-designer | yes (folded `description: >`) | both | "MIT + Commons Clause" | none |
| postgres-performance | yes | both | none | none |
| pgbot postgres-diagnostics | yes | both (name `postgres-diagnostics`) | none | none |
| agentic / openai / fcakyon copies | yes | both | MIT (agentic adds `license_source`, `risk: critical`, `date_added` — registry metadata, harmless) | none |

## 2. Companion references and links

- supabase-postgres-best-practices: 34 files in `references/` (rules plus `_sections`, `_template`, `_contributing`). SKILL.md names only example paths; all exist. Reference files are loaded on demand, not auto-linked. OK.
- supabase: only link is `references/skill-feedback.md`, present. `assets/feedback-issue-template.md` present. All other links are external https URLs (supabase.com docs/changelog, GitHub). OK.
- database-designer: 5 `references/*.md` links all resolve; `assets/` and `expected_outputs/` present.
- postgresql-code-review, postgres-performance, pgbot: single file, no relative links.
- `postgresql-code-review` contains an unresolved Copilot template variable `${selection}` (harmless, but shows it was written for a prompt-file system, not Claude Code).

## 3. Scripts and executables

Only `database-designer` has code: `scripts/schema_analyzer.py` (~42 KB), `index_optimizer.py` (~40 KB), `migration_generator.py` (~51 KB).

- Imports: stdlib only (`argparse, json, re, sys, collections, typing, dataclasses, hashlib`, plus `datetime` in migration_generator).
- grep for `subprocess, os.system, socket, urllib, requests, http, eval(, exec(, __import__, pickle, base64, shutil, os.remove, os.environ, psycopg, connect(`: zero hits.
- File access: `open(path,'r')` for the `--input/--schema/--queries/--current/--target` args and `open(args.output,'w')` for optional `--output`. No deletes, no env/credential access, no network, no DB connection. They parse DDL/JSON and print SQL text. They do not execute SQL.
- README asks for `chmod +x *.py` only. Assessment: scripts are benign. They were not run. Sample data in `assets/` is static JSON/SQL.

Everything else is markdown only. The `supabase` skill's `assets/feedback-issue-template.md` is a blank GitHub issue template.

## 4. Risky instructions found

| Skill | Instruction | Risk |
|---|---|---|
| pgbot | "`curl -fsSL https://pgbot.dev/install \| sh`", alternative `brew install pgrundev/tap/pgbot`, `npx @pgbot/cli` | Remote install-and-run of unreviewed code. It says "run through the normal permission prompt", but it still tells the agent to install software. Also uses `$DSN` / `$DATABASE_URL` (live DB credentials). Its rules say read-only and never run SQL itself, which is good, but the tool itself is third-party unaudited (Go binary). Reject. |
| supabase | Fetch `https://supabase.com/changelog.md` before every task, fetch docs pages, `search_docs` | Outbound reads of first-party content, but each fetch is an untrusted-data injection surface and costs tokens on every Supabase task. |
| supabase | "If missing, create one pointing to `https://mcp.supabase.com/mcp`" (`.mcp.json`) | Modifies project config. This repo already has the Supabase MCP connected, so unnecessary. |
| supabase | Skill-feedback flow: create a GitHub issue on `supabase/agent-skills` from conversation context | Gated by "Ask permission", but would publish conversation-derived text. Disable. |
| supabase | "Use `execute_sql` for schema changes ... then `supabase db pull <name> --local --yes`" | Runs SQL automatically against whatever DB is attached (here live Frankfurt project). Matches this repo's `execute_sql` habit, but its `db pull` step conflicts with the repo rule that `supabase/migrations/` is the hand-written record. Also says `apply_migration` should not be used locally (we use remote). |
| supabase-postgres-best-practices | `create extension if not exists pg_stat_statements;`, `create extension pg_uuidv7` (in examples), `monitor-explain-analyze` recommends `EXPLAIN ANALYZE` | Examples, not auto-run. But "EXPLAIN ANALYZE executes the query" contradicts the project rule: EXPLAIN without ANALYZE on live. Enabling extensions is only illustrative. |
| postgresql-code-review | `CREATE EXTENSION IF NOT EXISTS uuid-ossp / pgcrypto / pg_trgm` as "best practice" | Pushes extension enablement; `uuid-ossp` is obsolete (`gen_random_uuid()` is built in). Not auto-run. |
| postgres-performance | `EXPLAIN (ANALYZE, BUFFERS)` as step 2, `CREATE INDEX CONCURRENTLY`, `DROP TABLE` for partition drop | Examples; ANALYZE conflicts with the project rule. |
| database-designer | `migration_generator.py` emits `DROP COLUMN`; the skill itself warns to rehearse and use expand-contract | Output only, with warnings. Fine. |

None request secrets, tokens or passwords from the user (pgbot asks for a DSN from `$DATABASE_URL` or the user, "never guess or assemble credentials"). None change permissions or access unrelated repos.

## 5. Content quality for a Supabase Postgres app

### supabase-postgres-best-practices (official, v1.1.1 / changelog 1.6.0)
- Strong: `security-rls-performance.md` has exactly the `(select auth.uid())` wrapping pattern, indexes on policy columns, private-schema `SECURITY DEFINER` with `set search_path = ''` and EXECUTE revoke. `schema-foreign-key-indexes` (with a finder query), `data-pagination` (keyset incl. composite cursor), `query-partial-indexes`, `lock-*`, `data-batch-inserts`, `data-n-plus-one` all match this repo's "Database load" rules.
- Weak / outdated:
  - `conn-pooling.md` talks only about PgBouncer and generic pool sizing; Supavisor is not named (only the 5432 vs 6543 port hint appears in `conn-prepared-statements.md`). Verify against Supabase docs for the Frankfurt project (pooler hostname, transaction mode 6543).
  - `security-rls-basics.md` main example uses `current_setting('app.current_user_id')` (generic Postgres, not Supabase); the Supabase form (`to authenticated using ((select auth.uid()) = user_id)`) appears only as a trailing snippet and without the `select` wrapper (contradicts its own perf file).
  - `security-privileges.md` shows `revoke all on schema public from public` and `create role ... password 'xxx'`: in Supabase, revoking default grants is exactly what migrations 0315/0316 manage; do not apply blindly.
  - `monitor-explain-analyze.md` promotes `EXPLAIN ANALYZE` (executes the query). On live this repo mandates plain `EXPLAIN`.
  - `schema-primary-keys.md` suggests `pg_uuidv7` extension (not available on all Supabase tiers; Postgres 18 has native `uuidv7()`); our schema already uses its own key strategy.
  - No guidance on the Supabase `grant ... to anon, authenticated` model beyond the privileges file; that gap is covered by the `supabase` skill.

### supabase (official, v0.1.2)
- Good, current security checklist: never trust `user_metadata`, views need `security_invoker`, UPDATE needs SELECT policy, `auth.role()` deprecated, `WITH CHECK` on UPDATE, `SECURITY DEFINER` in exposed schema is callable by `anon` (matches this repo's 0315 lockdown), Data API grants vs RLS, storage upsert needs INSERT+SELECT+UPDATE. High value for audits.
- Mostly a router: relies on fetching live docs/changelog. Notes: it assumes `supabase` CLI v2.79+/2.81.3+ features, and the migration workflow (execute_sql then `db pull`, or declarative schemas) differs from this repo's rule (hand-written files in `supabase/migrations/`, applied with `execute_sql`, ledger informational). Use as a checklist, not as workflow authority.
- Its "version 0.1.2" and "changes frequently" stance is honest; no wrong advice spotted.

### postgresql-code-review (generic, Feb 2026)
Several technically wrong or unsuitable items for this app:
- RLS example uses `current_setting('app.current_user_id')::INTEGER`, no `auth.uid()`, no `(select ...)`, no `TO authenticated`, no `WITH CHECK`.
- "GOOD" JSONB index `gin((data->'status'))` does not support the `@>` query shown next to it (expression index vs whole-column operator); the "BAD" example `data->>'status' = 'shipped'` is fixed more simply by a btree expression index.
- Claims `NOW()` should be replaced by `CURRENT_TIMESTAMP` as an optimisation; they are equivalent (both transaction start time).
- Recommends ENUM types for currency codes and `DECIMAL(10,2)` domains (poor fit for a multi-currency finance app; enums are hard to evolve), `BIGSERIAL` (identity preferred), `uuid_generate_v4()`/`uuid-ossp`, `crypt()` for passwords (irrelevant under Supabase Auth), a regex email CHECK, "avoid VARCHAR" without TIMESTAMP-vs-TIMESTAMPTZ nuance beyond one line.
- Nothing about indexes on foreign keys, keyset pagination, connection pooling, advisors, grants for `anon`/`authenticated`, or RLS performance. Content matches its description but is shallow.

### database-designer (borghei)
- Aimed at generic schema analysis/migration diffing: normalisation smells, index recommendations from query-pattern JSON, forward/rollback SQL. The SKILL itself is careful (confirm with EXPLAIN, expand-contract, "denormalised columns can be deliberate"). Quality of prose is good.
- But: input is JSON/DDL it expects you to hand it, no Supabase/RLS/grant awareness (it points elsewhere for RLS: `database-schema-designer`), PostgreSQL and MySQL only, `VARCHAR(255)` and naming heuristics, name-prefix transitive-dependency checks admitted to give false positives. Our 330+ migrations and live schema are better handled by `list_tables`, `get_advisors`, EXPLAIN. Low marginal value.
- Licence: "MIT + Commons Clause" bans selling the software or a service whose value derives substantially from it. Commercial-use concern for a paid product (Pro plan) even if low practical risk for an internal helper; GitHub reports the repo as NOASSERTION (not an OSI licence).

### postgres-performance (CJHarmath)
- Generic patterns (pg_stat_statements, covering indexes, OFFSET vs keyset, batch processing, aggregations, partitioning, caching) plus SQLAlchemy async pool tuning and read replicas. `EXPLAIN (ANALYZE, BUFFERS)` as default. No Supabase, RLS or Supavisor content. Python/FastAPI oriented, irrelevant to a Next.js app. 0 stars, 12 installs, no licence file anywhere in the repo.

### pgbot postgres-diagnostics
- Content is a CLI wrapper skill: runs `pgbot inspect/queries/tables/vacuum/indexes/why/...` against a DSN. Sensible rules (read-only, no EXPLAIN ANALYZE, caveats on unused indexes), but depends on installing an external binary and giving it a DB connection string. Supabase MCP (`get_advisors`, `execute_sql`) and `pg_stat_statements` already cover this. Repo LICENSE is Apache-2.0 text but GitHub shows NOASSERTION; the skill itself has no licence field.

### Copies (agentic-awesome-skills, openai/plugins, fcakyon)
- All three are re-packaged copies of the upstream Supabase skill. `diff` shows only frontmatter additions (registry fields, shorter description) and minor reference rewording in the sickn33 copy ("measured metrics ... never invent speedups", clearer LIKE/trigram note). Content is slightly edited by the repackager, so provenance is weaker than upstream. `openai/plugins` has no LICENSE file (frontmatter says MIT, upstream is MIT, but repo-level licence is absent); fcakyon is Apache-2.0 repo with MIT skill.

## 6. Overlap

| Pair | Overlap |
|---|---|
| supabase-postgres-best-practices x 3 copies | 100% duplicate; keep only upstream |
| supabase-postgres-best-practices x `ecc:postgres-patterns` | `ecc:postgres-patterns` (148 lines, ECC) states it is "Based on Supabase best practices": index cheat sheet, data types, `(SELECT auth.uid())` RLS line 67, SKIP LOCKED, anti-pattern detection queries, config template. The official skill covers the same topics in 34 rule files with explanations and EXPLAIN output, so it is a superset in depth but ~8x the token surface when fully loaded (only loaded on demand). |
| postgresql-code-review x `ecc:postgres-patterns` / `ecc:database-reviewer` agent | Fully redundant, and the ECC versions are more Supabase-correct |
| database-designer (migration part) x `ecc:database-migrations` (430 lines: safe add column, concurrent index, zero-downtime rename/drop, large data migrations, ORM-specific flows) | Overlap on expand-contract and migration safety; `database-migrations` is prose in-context, no scripts. database-designer adds generated rollback SQL and index recommendation scripts. |
| postgres-performance x `ecc:postgres-patterns` | Redundant (indexes, keyset pagination, batching, partitioning) |
| supabase x supabase-postgres-best-practices | Complementary, not redundant: `supabase` = Auth/RLS/Data API/CLI/MCP security traps and routing; best-practices = SQL performance/schema rules. Small overlap on RLS and `SECURITY DEFINER`. |
| pgbot x Supabase MCP (`get_advisors`, `execute_sql`, `query_logs`) | Redundant for this project |

## 7. Licence assessment (from W1b)

| Skill | Licence | Install implication |
|---|---|---|
| supabase-postgres-best-practices | MIT (skill + repo, copyright Supabase) | OK |
| supabase | repo MIT, SKILL.md has no field | OK under repo licence |
| postgresql-code-review | repo MIT (GitHub), no skill field | OK, but rejected on quality |
| database-designer | MIT + Commons Clause | Flag: commercial-use concern |
| postgres-performance | none | All rights reserved: do not install |
| pgbot | Apache-2.0 LICENSE text, GitHub NOASSERTION, no skill field | Ambiguous; rejected anyway on install-script grounds |
| openai copy | no LICENSE file in repo (frontmatter claims MIT) | Do not use the copy |
| agentic / fcakyon copies | MIT / Apache-2.0 + MIT | OK but redundant |

## Recommendations for buddget

1. Install `supabase-postgres-best-practices` (upstream supabase/agent-skills only), pinned to the commit reviewed in W1b, and keep `ecc:postgres-patterns` as the short cheat sheet. Add a one-line note in project guidance that where the skill says `EXPLAIN ANALYZE`, the repo rule (plain `EXPLAIN` on live) wins, and that pooling advice must be checked against Supavisor.
2. For `supabase`: use as a reference for the security checklist, or install and accept its network lookups. If installed, tell the agent not to create `.mcp.json`, not to file GitHub issues, and that migrations follow `CLAUDE.md` (hand-written file, `execute_sql`, no `db pull`). Re-review on each version bump since content is intentionally dynamic.
3. Do not install postgresql-code-review, database-designer, postgres-performance, pgbot, or the three copies.
4. Mitigation if any skill is installed: keep sandbox on, do not allow `curl | sh` and `npx` from skill instructions, review diff of the skill folder on every update.

Files reviewed: all SKILL.md, README.md, CHANGELOG.md, `assets/feedback-issue-template.md`, `references/skill-feedback.md`, 12 of 34 best-practices reference files (security, conn, data-pagination, schema-pk/FK, monitor), the 3 database-designer Python files (import/syscall grep plus structure), and `ecc:postgres-patterns` / `ecc:database-migrations` headings under the user-level ECC plugin folder. The remaining reference rules and the database-designer long references/expected outputs were scanned by pattern search only by this reviewer; the orchestrator then read all 34 reference files in full (2026-11-26) and found no unsafe instruction.
