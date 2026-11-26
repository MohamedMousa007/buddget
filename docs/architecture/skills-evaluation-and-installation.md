# Database skills: evaluation and installation (Phase 12)

Checked 2026-11-26. Downloads were saved to a scratch folder as untrusted data. **No downloaded file was executed, imported or installed by any script, and no `npx skills add`, `pip` or `curl | sh` ran.** Raw metadata: [`_work/W1b-skills-metadata.md`](_work/W1b-skills-metadata.md). Line-level security notes: [`_work/W2d-skill-security.md`](_work/W2d-skill-security.md).

Stack match: Buddgy runs **PostgreSQL 17 on Supabase**, accessed through supabase-js and PostgREST, with no ORM. The two PostgreSQL candidates were therefore applicable on engine grounds, and the search added Supabase-specific candidates. Prisma, Drizzle and SQLAlchemy skills are not relevant.

## 1. Result

| Skill | Decision | One-line reason |
|---|---|---|
| `supabase-postgres-best-practices` (supabase/agent-skills) | **INSTALLED** | First-party, MIT, Markdown only, matches the stack |
| `database-designer` (borghei/Claude-Skills) | **NOT INSTALLED; research reference only** | Commons Clause condition plus bundled scripts, and little it adds for Supabase |
| `postgresql-code-review` (github/awesome-copilot) | **REJECTED** | Applicable engine, but generic and partly wrong; superseded by the installed skill |
| `postgres-performance` (CJHarmath/claude-agents-skills) | **REJECTED** | No licence (all rights reserved); SQLAlchemy and FastAPI oriented |
| `supabase` (supabase/agent-skills) | **REFERENCE ONLY** | Its migration workflow and network fetches conflict with `CLAUDE.md` |
| `postgres-diagnostics` (pgrundev/pgbot) | **REJECTED (unsafe)** | Tells the agent to pipe a remote install script to the shell; needs a DB connection string |
| Three repackaged copies of the Supabase skill (sickn33, openai/plugins, fcakyon) | **REJECTED (duplicates)** | Same content as upstream; `openai/plugins` has no licence file |

## 2. Metrics

Repository metrics describe the whole repo; skill metrics describe the one skill path. They are kept apart on purpose. "skills.sh installs" is the per-skill count on that directory's page. Where none was shown, the table says so.

| Skill | Repo stars / forks / open issues | Repo last push | Skill path last commit (SHA, date) | skills.sh installs (skill) | Repo licence (GitHub) | Skill licence (frontmatter) |
|---|---|---|---|---|---|---|
| database-designer | 1,224 / 222 / 4 | 2026-11-24 | `6ac3bdbc351893d18d1a76aeb405901e7a6ba943`, 2026-11-08 | 180 | NOASSERTION (file: MIT + Commons Clause) | MIT + Commons Clause |
| postgresql-code-review | 41,595 / 5,443 / 146 | 2026-11-25 | `caab1f623bb68a330f294a11279597d7ae7be737`, 2026-02-24 | 13,007 | MIT | none stated |
| postgres-performance | 0 / 0 / 0 | 2025-12-22 | `f3107fbd2c77ef772102609166033b39266e258f`, 2025-12-22 | 12 | none (no LICENSE file) | none stated |
| **supabase-postgres-best-practices** | 3,144 / 281 / 535 | 2026-11-12 | **`1207767388a0ffb55f21fb4e6988fee96942431d`, 2026-07-30** | 499,480 | MIT | MIT |
| supabase | same repo | 2026-11-12 | `c9be0e931b7930f7d02126d04774d904c381e7d7`, 2026-10-02 | 376,192 | MIT | none stated |
| postgres-diagnostics (pgbot) | 1,523 / 74 / 6 | 2026-11-24 | `788f01881c769f95ba4c262eae8533937119e857`, 2026-09-01 | 47 | NOASSERTION (file: Apache-2.0 text) | none stated |
| copy: sickn33/agentic-awesome-skills | 50,393 / 7,312 / 2 | 2026-11-26 | `6d4ea18320984083107f07ff69587fa355ee94c0`, 2026-10-24 | 229 | MIT | MIT |
| copy: openai/plugins | 8,398 / 1,117 / 57 | 2026-11-18 | `7118aaa3dc64814099fc65bf52a7a41adf0f98f2`, 2026-06-18 | 9 | none | MIT |
| copy: fcakyon/claude-codex-settings | 1,218 / 116 / 4 | 2026-11-26 | `c78ce6a33a4f4488739c4ee0fc304875d669e5b4`, 2026-10-01 | 51 | Apache-2.0 | MIT |

Notes:
- The supabase/agent-skills repo has 535 open issues; its last push was 2026-11-12 and it is actively released (CHANGELOG 1.6.0).
- No ratings were found on any directory, so none are reported.

## 3. Licence evaluation

- **database-designer (MIT + Commons Clause).** The repo's LICENSE adds the Commons Clause condition to MIT. In substance it withholds the right to sell the software, meaning to offer for a fee a product or service whose value comes entirely or substantially from the skill. It also requires the condition to travel with any attribution. The repo README states that internal business use is allowed and that selling or repackaging as a paid product is not.
  - **Assessment:** using it as an internal engineering aid on a commercial app is very likely within the allowed use. Committing a copy into Buddget's repository is redistribution that must carry the condition. The Commons Clause is not an OSI licence, and its edge cases (for example a paid consulting engagement that uses it) are untested.
  - **Decision:** not installed by default, kept as a research reference. Installing it is the **owner's call**. Nothing in this audit depended on it.
- **postgres-performance:** no licence file, so all rights are reserved by default and it cannot be copied in. Rejected on that ground alone.
- **openai/plugins copy:** no licence file at repo level. Rejected (the upstream original is MIT anyway).
- **supabase-postgres-best-practices:** MIT. The repo `LICENSE` is copied into the installed folder as required.

## 4. Security inspection

All candidates were inspected file by file (the 12.7 checklist). Summary:

| Check | supabase-postgres-best-practices | database-designer | postgresql-code-review | pgbot |
|---|---|---|---|---|
| Frontmatter valid, no `allowed-tools` or hooks | Yes | Yes | Yes | Yes |
| Scripts or executables | None (37 files: SKILL.md, CHANGELOG, 34 references, LICENSE) | 3 Python files (stdlib only; read input files, optional `--output`; no network, subprocess, eval or env access) | None | None, but it instructs installing an external CLI |
| Network or install instructions | None in the skill (the directory page suggests `npx skills add`, which was not used) | None | None | `curl ... \| sh`, brew, `npx @pgbot/cli` |
| Credential or secret requests | None (one example `password 'xxx'` in a `create role` sample) | None | None | Needs a DB connection string |
| Instruction overrides or prompt injection | None found | None found | None found | None found |
| Content matches description | Yes | Yes (generic; no RLS or Supabase awareness) | Partly: see below | Yes |
| Verdict | **SAFE** | SAFE WITH NOTES | SAFE WITH NOTES | **UNSAFE** |

The Sonnet reviewer read 12 of the 34 reference files line by line. The remaining 22 were then read in full by the orchestrating session (2026-11-26): no unsafe instruction, no executable content.

Technical problems in `postgresql-code-review`, verified by reading its SKILL.md:
- Lines 18-19 build a GIN index on the expression `data->'status'`, then query `data @> '{...}'`. That index cannot serve that query.
- Line 160's RLS example uses `current_setting('app.current_user_id')`, not Supabase's `auth.uid()`.
- Lines 109 and 118 present `NOW()` and `CURRENT_TIMESTAMP` as different choices. They are the same function in Postgres.

## 5. Installed skill

| Field | Value |
|---|---|
| Skill | `supabase-postgres-best-practices` v1.1.1 (frontmatter), CHANGELOG 1.6.0 |
| Source | https://github.com/supabase/agent-skills, path `skills/supabase-postgres-best-practices` |
| Commit | `1207767388a0ffb55f21fb4e6988fee96942431d` (2026-07-30), the last commit touching that path when checked |
| Licence | MIT (copied as `LICENSE` in the folder) |
| Date checked | 2026-11-26 |
| Install path | `.claude/skills/supabase-postgres-best-practices/` (project level; nothing global) |
| Files | `SKILL.md`, `CHANGELOG.md`, `LICENSE`, `references/` (34 files). Original structure kept; nothing edited |
| Why selected | First-party Supabase guidance for the exact stack: RLS with `(select auth.uid())`, FK and partial indexes, keyset pagination, lock hygiene, definer-function ownership checks. The most adopted by far (about 499k installs) |
| Phases it supports | 2 (schema), 3 (N+1, data access), 4 (indexes), 5 (pagination), 9 (partitioning, pooling), 10 (RLS and privileges) |
| Overlap | Superset of the installed `ecc:postgres-patterns` cheat sheet. It complements `ecc:database-migrations` (migration safety), which stays as is |

Verification (12.9):
1. `SKILL.md` is present, and the frontmatter parses: `name`, `description`, `license: MIT`, `metadata`.
2. Every `references/*.md` link named in `SKILL.md` and `_sections.md` resolves.
3. The folder `.claude/skills/` did not exist before, so nothing was overwritten.
4. It is installed at project level only.
5. Discovery has been checked **structurally only**: a fresh Claude Code session in this repo should list it, and no new session was opened to confirm.
6. No skill scripts exist, so none were run.

**Commit caveat:** `.gitignore:58` ignores `.claude/*` (only `settings.json` is excepted). The folder needs `git add -f` (or an owner-approved `.gitignore` exception) to reach the repo. Until it is committed, it lives only in this worktree.

### Where the installed skill conflicts with project rules (project rules win)

The skill's description asks to be loaded before any database change, so these conflicts will come up:

| Skill reference | Conflict | Project rule |
|---|---|---|
| `monitor-explain-analyze` | Recommends `EXPLAIN ANALYZE` | Plain `EXPLAIN` only on the live DB (`CLAUDE.md`, database load) |
| `monitor-pg-stat-statements` | `create extension`, `pg_stat_statements_reset()` | Already installed; never reset without a recorded snapshot |
| `conn-idle-timeout`, `conn-limits` | `ALTER SYSTEM`, `pgbouncer.ini` | Not available on managed Supabase; Supavisor is the pooler |
| `security-privileges` | `revoke all on schema public from public` | Grants are managed by migrations 0315 and 0316; follow those |
| `security-rls-basics` | Leads with a `current_setting` pattern | Use `(select auth.uid())` |
| `schema-primary-keys` | `bigint identity` or UUIDv7 (`pg_uuidv7`) | Client-minted UUIDs for offline sync |
| `data-batch-inserts` | `COPY ... FROM '/path'` | Never read server files through SQL |
| `schema-partitioning` | — | Agrees with this audit: only beyond about 100M rows |

## 6. Rejected and reference-only candidates

- **database-designer:** reference only (licence condition, scripts, no Supabase or RLS awareness). Its migration-generation feature was not used, in line with the brief.
- **postgresql-code-review:** rejected for the technical errors above, and because the installed skill covers the same ground correctly.
- **postgres-performance:** rejected (no licence, SQLAlchemy focus, 0 stars, no activity since 2025-12).
- **supabase:** reference only. It tells the agent to fetch docs and changelogs on every task, create `.mcp.json`, and use a migration path (`execute_sql` then `db pull`) that differs from `CLAUDE.md`'s migration order.
- **pgbot postgres-diagnostics:** rejected as unsafe (pipe-to-shell install, external binary, connection string). It is also redundant with the Supabase MCP advisors and `pg_stat_statements`.
- **Repackaged copies:** rejected as duplicates. One has no licence file, and the upstream original is preferred for provenance.
