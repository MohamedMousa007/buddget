# W1b: public GitHub Claude/Postgres skills metadata

Date checked: 2026-11-26. Research only: nothing installed, no downloaded file executed, `npx skills add` not run.

Downloaded copies (untrusted, not executed): `<scratchpad>/skills-src/<skill-name>/`, each with `LICENSE.repo` where the repo has one.

## Summary

Repo-level = the whole GitHub repository (stars, forks, issues, last push, repo license). Skill-level = the skill folder only (last commit touching its path, SKILL.md frontmatter license, skills.sh install count). Install counts come from the skills.sh detail page metadata (schema.org InstallAction counter) and the 8-point weekly sparkline label. 'not available' means not found.

| # | Skill | Repo | Repo stars | Repo forks | Repo open issues | Repo last push | Repo license (GitHub SPDX) | Skill license (frontmatter) | skills.sh installs | Scripts in folder |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `database-designer` | borghei/Claude-Skills | 1224 | 222 | 4 | 2026-11-24 | NOASSERTION | MIT + Commons Clause | 180 | yes: index_optimizer.py, migration_generator.py, schema_analyzer.py |
| 2 | `postgresql-code-review` | github/awesome-copilot | 41595 | 5443 | 146 | 2026-11-25 | MIT | not available (no license field) | 13007 | no |
| 3 | `postgres-performance` | CJHarmath/claude-agents-skills | 0 | 0 | 0 | 2025-12-22 | none | not available (no license field) | 12 | no |
| 4 | `supabase-postgres-best-practices` | supabase/agent-skills | 3144 | 281 | 535 | 2026-11-12 | MIT | MIT | 499480 | no |
| 5 | `supabase` | supabase/agent-skills | 3144 | 281 | 535 | 2026-11-12 | MIT | not available (no license field) | 376192 | no |
| 6 | `supabase-postgres-best-practices` | sickn33/agentic-awesome-skills | 50393 | 7312 | 2 | 2026-11-26 | MIT | MIT | 229 | no |
| 7 | `supabase-postgres-best-practices` | openai/plugins | 8398 | 1117 | 57 | 2026-11-18 | none | MIT | 9 | no |
| 8 | `supabase-postgres-best-practices` | fcakyon/claude-codex-settings | 1218 | 116 | 4 | 2026-11-26 | Apache-2.0 | MIT | 51 | no |
| 9 | `postgres-diagnostics` | pgrundev/pgbot | 1523 | 74 | 6 | 2026-11-24 | NOASSERTION | not available (no license field) | 47 | no |

Note: the repo-level license for `pgrundev/pgbot` is also NOASSERTION, but its LICENSE file is Apache-2.0 text. The repo-level license for `borghei/Claude-Skills` is reported by GitHub as NOASSERTION (not recognised); the LICENSE file text is MIT + Commons Clause (see below). `openai/plugins` and `CJHarmath/claude-agents-skills` have no LICENSE file at all.

## 1. `engineering/database-designer` in borghei/Claude-Skills

- Role: 1. Requested candidate
- Repo (repo-level): 1224 stars, 222 forks, 4 open issues, last push 2026-11-24T11:54:10Z, GitHub license SPDX `NOASSERTION`
- Skill (skill-level): last commit touching `engineering/database-designer` is `6ac3bdbc351893d18d1a76aeb405901e7a6ba943` dated 2026-11-08T17:19:54Z ("fix: make engineering and PM skills ready for reasoning-first models (v4.17.0) (#66)")
- Skill frontmatter license: MIT + Commons Clause
- Repo LICENSE file: present, first lines: `Commons Clause License Condition v1.0 + MIT / The Software is provided to you by the Licensor under the License, as / defined below, subject to the following co`
- skills.sh installs (skill-level): 180 (https://www.skills.sh/borghei/Claude-Skills/database-designer)
- Install instructions: README 'Installation': `cd engineering/database-designer/` and `chmod +x *.py`. README says 'Python 3.7+ (no external dependencies required)'. Usage is `python3 scripts/*.py`. Not run.
- Files in skill folder (17, sizes are blob bytes from the git tree):

| File | Bytes |
|---|---|
| `database-designer/README.md` | 12115 |
| `database-designer/SKILL.md` | 7875 |
| `database-designer/assets/sample_query_patterns.json` | 9244 |
| `database-designer/assets/sample_schema.json` | 9365 |
| `database-designer/assets/sample_schema.sql` | 8301 |
| `database-designer/assets/sample_schema_target.json` | 10117 |
| `database-designer/expected_outputs/index_optimization_sample.txt` | 2639 |
| `database-designer/expected_outputs/migration_sample.txt` | 4509 |
| `database-designer/expected_outputs/schema_analysis_sample.txt` | 7474 |
| `database-designer/references/database_selection_decision_tree.md` | 16344 |
| `database-designer/references/index_strategy_patterns.md` | 11831 |
| `database-designer/references/normalization_guide.md` | 10672 |
| `database-designer/references/patterns-and-troubleshooting.md` | 3999 |
| `database-designer/references/workflows-and-tools.md` | 7608 |
| `database-designer/scripts/index_optimizer.py` | 39599 |
| `database-designer/scripts/migration_generator.py` | 50531 |
| `database-designer/scripts/schema_analyzer.py` | 42482 |

## 2. `skills/postgresql-code-review` in github/awesome-copilot

- Role: 2. Requested candidate
- Repo (repo-level): 41595 stars, 5443 forks, 146 open issues, last push 2026-11-25T20:42:20Z, GitHub license SPDX `MIT`
- Skill (skill-level): last commit touching `skills/postgresql-code-review` is `caab1f623bb68a330f294a11279597d7ae7be737` dated 2026-02-24T03:39:33Z ("Convert all prompts to skills and update plugin manifests")
- Skill frontmatter license: not available (no license field)
- Repo LICENSE file: present, first lines: `MIT License / Copyright GitHub, Inc. / Permission is hereby granted, free of charge, to any person obtaining a copy / of this software and associated documentat`
- skills.sh installs (skill-level): 13007 (https://www.skills.sh/github/awesome-copilot/postgresql-code-review)
- Install instructions: None in SKILL.md. Single file, no scripts.
- Files in skill folder (1, sizes are blob bytes from the git tree):

| File | Bytes |
|---|---|
| `postgresql-code-review/SKILL.md` | 7439 |

## 3. `skills/postgres-performance` in CJHarmath/claude-agents-skills

- Role: 3. Requested candidate
- Repo (repo-level): 0 stars, 0 forks, 0 open issues, last push 2025-12-22T22:39:03Z, GitHub license SPDX `none`
- Skill (skill-level): last commit touching `skills/postgres-performance` is `f3107fbd2c77ef772102609166033b39266e258f` dated 2025-12-22T19:37:58Z ("Generic Python/FastAPI agents and skills for Claude Code")
- Skill frontmatter license: not available (no license field)
- Repo LICENSE file: not available (none downloaded)
- skills.sh installs (skill-level): 12 (https://www.skills.sh/CJHarmath/claude-agents-skills/postgres-performance)
- Install instructions: None in SKILL.md. Single file, no scripts. Repo has no LICENSE file.
- Files in skill folder (1, sizes are blob bytes from the git tree):

| File | Bytes |
|---|---|
| `postgres-performance/SKILL.md` | 11131 |

## 4. `skills/supabase-postgres-best-practices` in supabase/agent-skills

- Role: 4. Requested candidate (Supabase)
- Repo (repo-level): 3144 stars, 281 forks, 535 open issues, last push 2026-11-12T15:32:31Z, GitHub license SPDX `MIT`
- Skill (skill-level): last commit touching `skills/supabase-postgres-best-practices` is `1207767388a0ffb55f21fb4e6988fee96942431d` dated 2026-07-30T11:52:48Z ("chore: release main (#216)")
- Skill frontmatter license: MIT
- Repo LICENSE file: present, first lines: `MIT License / Copyright (c) 2026 Supabase / Permission is hereby granted, free of charge, to any person obtaining a copy / of this software and associated docum`
- skills.sh installs (skill-level): 499480 (https://www.skills.sh/supabase/agent-skills/supabase-postgres-best-practices)
- Install instructions: skills.sh page install command begins `npx skills add https://github.com/supabase/agent-skills` (flags truncated in my extraction). SKILL.md itself has no install step. Not run. Reference docs only, no scripts.
- Files in skill folder (36, sizes are blob bytes from the git tree):

| File | Bytes |
|---|---|
| `supabase-postgres-best-practices/CHANGELOG.md` | 5684 |
| `supabase-postgres-best-practices/SKILL.md` | 3231 |
| `supabase-postgres-best-practices/references/_contributing.md` | 4113 |
| `supabase-postgres-best-practices/references/_sections.md` | 1682 |
| `supabase-postgres-best-practices/references/_template.md` | 1040 |
| `supabase-postgres-best-practices/references/advanced-full-text-search.md` | 1468 |
| `supabase-postgres-best-practices/references/advanced-jsonb-indexing.md` | 1444 |
| `supabase-postgres-best-practices/references/conn-idle-timeout.md` | 1282 |
| `supabase-postgres-best-practices/references/conn-limits.md` | 1325 |
| `supabase-postgres-best-practices/references/conn-pooling.md` | 1382 |
| `supabase-postgres-best-practices/references/conn-prepared-statements.md` | 1529 |
| `supabase-postgres-best-practices/references/data-batch-inserts.md` | 1287 |
| `supabase-postgres-best-practices/references/data-n-plus-one.md` | 1361 |
| `supabase-postgres-best-practices/references/data-pagination.md` | 1358 |
| `supabase-postgres-best-practices/references/data-upsert.md` | 1390 |
| `supabase-postgres-best-practices/references/lock-advisory.md` | 1531 |
| `supabase-postgres-best-practices/references/lock-deadlock-prevention.md` | 1855 |
| `supabase-postgres-best-practices/references/lock-short-transactions.md` | 1350 |
| `supabase-postgres-best-practices/references/lock-skip-locked.md` | 1353 |
| `supabase-postgres-best-practices/references/monitor-explain-analyze.md` | 1441 |
| `supabase-postgres-best-practices/references/monitor-pg-stat-statements.md` | 1418 |
| `supabase-postgres-best-practices/references/monitor-vacuum-analyze.md` | 1506 |
| `supabase-postgres-best-practices/references/query-composite-indexes.md` | 1454 |
| `supabase-postgres-best-practices/references/query-covering-indexes.md` | 1287 |
| `supabase-postgres-best-practices/references/query-index-types.md` | 1521 |
| `supabase-postgres-best-practices/references/query-missing-indexes.md` | 1218 |
| `supabase-postgres-best-practices/references/query-partial-indexes.md` | 1347 |
| `supabase-postgres-best-practices/references/schema-constraints.md` | 1880 |
| `supabase-postgres-best-practices/references/schema-data-types.md` | 1453 |
| `supabase-postgres-best-practices/references/schema-foreign-key-indexes.md` | 1679 |
| `supabase-postgres-best-practices/references/schema-lowercase-identifiers.md` | 1728 |
| `supabase-postgres-best-practices/references/schema-partitioning.md` | 1548 |
| `supabase-postgres-best-practices/references/schema-primary-keys.md` | 1821 |
| `supabase-postgres-best-practices/references/security-privileges.md` | 1566 |
| `supabase-postgres-best-practices/references/security-rls-basics.md` | 1372 |
| `supabase-postgres-best-practices/references/security-rls-performance.md` | 2103 |

## 5. `skills/supabase` in supabase/agent-skills

- Role: 4b. Same repo, second skill (optional)
- Repo (repo-level): 3144 stars, 281 forks, 535 open issues, last push 2026-11-12T15:32:31Z, GitHub license SPDX `MIT`
- Skill (skill-level): last commit touching `skills/supabase` is `c9be0e931b7930f7d02126d04774d904c381e7d7` dated 2026-10-02T12:34:48Z ("chore: release main (#609)")
- Skill frontmatter license: not available (no license field)
- Repo LICENSE file: present, first lines: `MIT License / Copyright (c) 2026 Supabase / Permission is hereby granted, free of charge, to any person obtaining a copy / of this software and associated docum`
- skills.sh installs (skill-level): 376192 (https://www.skills.sh/supabase/agent-skills/supabase)
- Install instructions: SKILL.md has no install step. skills.sh install command not extracted. Not run. No scripts.
- Files in skill folder (4, sizes are blob bytes from the git tree):

| File | Bytes |
|---|---|
| `supabase/CHANGELOG.md` | 8345 |
| `supabase/SKILL.md` | 14307 |
| `supabase/assets/feedback-issue-template.md` | 459 |
| `supabase/references/skill-feedback.md` | 1035 |

## 6. `plugins/agentic-awesome-skills/skills/supabase-postgres-best-practices` in sickn33/agentic-awesome-skills

- Role: 5. Search candidate
- Repo (repo-level): 50393 stars, 7312 forks, 2 open issues, last push 2026-11-26T18:59:39Z, GitHub license SPDX `MIT`
- Skill (skill-level): last commit touching `plugins/agentic-awesome-skills/skills/supabase-postgres-best-practices` is `6d4ea18320984083107f07ff69587fa355ee94c0` dated 2026-10-24T09:03:31Z ("chore: release v20.0.0 (#2106)")
- Skill frontmatter license: MIT
- Repo LICENSE file: present, first lines: `MIT License / Copyright (c) 2026 Antigravity User / Permission is hereby granted, free of charge, to any person obtaining a copy / of this software and associat`
- skills.sh installs (skill-level): 229 (https://www.skills.sh/sickn33/agentic-awesome-skills/supabase-postgres-best-practices)
- Install instructions: None in SKILL.md. Second copy of the Supabase Postgres skill inside an aggregator repo (SKILL.md size differs from supabase/agent-skills). Reference docs only, no scripts.
- Files in skill folder (36, sizes are blob bytes from the git tree):

| File | Bytes |
|---|---|
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/CHANGELOG.md` | 2036 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/SKILL.md` | 3475 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/_contributing.md` | 4201 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/_sections.md` | 1682 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/_template.md` | 1040 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/advanced-full-text-search.md` | 1580 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/advanced-jsonb-indexing.md` | 1477 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/conn-idle-timeout.md` | 1282 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/conn-limits.md` | 1394 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/conn-pooling.md` | 1382 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/conn-prepared-statements.md` | 1817 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/data-batch-inserts.md` | 1287 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/data-n-plus-one.md` | 1361 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/data-pagination.md` | 1442 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/data-upsert.md` | 1390 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/lock-advisory.md` | 1531 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/lock-deadlock-prevention.md` | 1899 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/lock-short-transactions.md` | 1538 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/lock-skip-locked.md` | 1353 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md` | 1499 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/monitor-pg-stat-statements.md` | 1418 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/monitor-vacuum-analyze.md` | 1506 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/query-composite-indexes.md` | 1484 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/query-covering-indexes.md` | 1311 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/query-index-types.md` | 1521 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/query-missing-indexes.md` | 1240 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/query-partial-indexes.md` | 1347 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/schema-constraints.md` | 2166 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/schema-data-types.md` | 1453 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/schema-foreign-key-indexes.md` | 1679 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/schema-lowercase-identifiers.md` | 1728 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/schema-partitioning.md` | 1605 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/schema-primary-keys.md` | 1821 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/security-privileges.md` | 1566 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/security-rls-basics.md` | 1598 |
| `agentic-awesome-skills/skills/supabase-postgres-best-practices/references/security-rls-performance.md` | 2387 |

## 7. `plugins/supabase/skills/supabase-postgres-best-practices` in openai/plugins

- Role: 5. Search candidate
- Repo (repo-level): 8398 stars, 1117 forks, 57 open issues, last push 2026-11-18T19:14:28Z, GitHub license SPDX `none`
- Skill (skill-level): last commit touching `plugins/supabase/skills/supabase-postgres-best-practices` is `7118aaa3dc64814099fc65bf52a7a41adf0f98f2` dated 2026-06-18T18:58:30Z ("[codex] Add plugin skill updates (#350)")
- Skill frontmatter license: MIT
- Repo LICENSE file: not available (none downloaded)
- skills.sh installs (skill-level): 9 (https://www.skills.sh/openai/plugins/supabase)
- Install instructions: None in SKILL.md. Second copy of the Supabase Postgres skill inside openai/plugins (SKILL.md size differs from supabase/agent-skills). Reference docs only, no scripts.
- Files in skill folder (36, sizes are blob bytes from the git tree):

| File | Bytes |
|---|---|
| `supabase/skills/supabase-postgres-best-practices/CHANGELOG.md` | 2036 |
| `supabase/skills/supabase-postgres-best-practices/SKILL.md` | 2576 |
| `supabase/skills/supabase-postgres-best-practices/references/_contributing.md` | 4113 |
| `supabase/skills/supabase-postgres-best-practices/references/_sections.md` | 1682 |
| `supabase/skills/supabase-postgres-best-practices/references/_template.md` | 1040 |
| `supabase/skills/supabase-postgres-best-practices/references/advanced-full-text-search.md` | 1468 |
| `supabase/skills/supabase-postgres-best-practices/references/advanced-jsonb-indexing.md` | 1444 |
| `supabase/skills/supabase-postgres-best-practices/references/conn-idle-timeout.md` | 1282 |
| `supabase/skills/supabase-postgres-best-practices/references/conn-limits.md` | 1325 |
| `supabase/skills/supabase-postgres-best-practices/references/conn-pooling.md` | 1382 |
| `supabase/skills/supabase-postgres-best-practices/references/conn-prepared-statements.md` | 1529 |
| `supabase/skills/supabase-postgres-best-practices/references/data-batch-inserts.md` | 1287 |
| `supabase/skills/supabase-postgres-best-practices/references/data-n-plus-one.md` | 1361 |
| `supabase/skills/supabase-postgres-best-practices/references/data-pagination.md` | 1358 |
| `supabase/skills/supabase-postgres-best-practices/references/data-upsert.md` | 1390 |
| `supabase/skills/supabase-postgres-best-practices/references/lock-advisory.md` | 1531 |
| `supabase/skills/supabase-postgres-best-practices/references/lock-deadlock-prevention.md` | 1855 |
| `supabase/skills/supabase-postgres-best-practices/references/lock-short-transactions.md` | 1350 |
| `supabase/skills/supabase-postgres-best-practices/references/lock-skip-locked.md` | 1353 |
| `supabase/skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md` | 1441 |
| `supabase/skills/supabase-postgres-best-practices/references/monitor-pg-stat-statements.md` | 1418 |
| `supabase/skills/supabase-postgres-best-practices/references/monitor-vacuum-analyze.md` | 1506 |
| `supabase/skills/supabase-postgres-best-practices/references/query-composite-indexes.md` | 1454 |
| `supabase/skills/supabase-postgres-best-practices/references/query-covering-indexes.md` | 1287 |
| `supabase/skills/supabase-postgres-best-practices/references/query-index-types.md` | 1521 |
| `supabase/skills/supabase-postgres-best-practices/references/query-missing-indexes.md` | 1218 |
| `supabase/skills/supabase-postgres-best-practices/references/query-partial-indexes.md` | 1347 |
| `supabase/skills/supabase-postgres-best-practices/references/schema-constraints.md` | 1880 |
| `supabase/skills/supabase-postgres-best-practices/references/schema-data-types.md` | 1453 |
| `supabase/skills/supabase-postgres-best-practices/references/schema-foreign-key-indexes.md` | 1679 |
| `supabase/skills/supabase-postgres-best-practices/references/schema-lowercase-identifiers.md` | 1728 |
| `supabase/skills/supabase-postgres-best-practices/references/schema-partitioning.md` | 1548 |
| `supabase/skills/supabase-postgres-best-practices/references/schema-primary-keys.md` | 1821 |
| `supabase/skills/supabase-postgres-best-practices/references/security-privileges.md` | 1566 |
| `supabase/skills/supabase-postgres-best-practices/references/security-rls-basics.md` | 1372 |
| `supabase/skills/supabase-postgres-best-practices/references/security-rls-performance.md` | 2103 |

## 8. `plugins/supabase-skills/skills/supabase-postgres-best-practices` in fcakyon/claude-codex-settings

- Role: 5. Search candidate
- Repo (repo-level): 1218 stars, 116 forks, 4 open issues, last push 2026-11-26T14:20:29Z, GitHub license SPDX `Apache-2.0`
- Skill (skill-level): last commit touching `plugins/supabase-skills/skills/supabase-postgres-best-practices` is `c78ce6a33a4f4488739c4ee0fc304875d669e5b4` dated 2026-10-01T22:31:19Z ("Sync 3rd party skills and track new upstream skills (#314)")
- Skill frontmatter license: MIT
- Repo LICENSE file: present, first lines: `Apache License / Version 2.0, January 2004 / http://www.apache.org/licenses/ / TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION / 1. Definitions. / `
- skills.sh installs (skill-level): 51 (https://www.skills.sh/fcakyon/claude-codex-settings/supabase-postgres-best-practices)
- Install instructions: None in SKILL.md. Second copy of the Supabase Postgres skill inside a personal settings repo (SKILL.md size differs from supabase/agent-skills). Reference docs only, no scripts.
- Files in skill folder (36, sizes are blob bytes from the git tree):

| File | Bytes |
|---|---|
| `supabase-skills/skills/supabase-postgres-best-practices/CHANGELOG.md` | 5684 |
| `supabase-skills/skills/supabase-postgres-best-practices/SKILL.md` | 3231 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/_contributing.md` | 4113 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/_sections.md` | 1682 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/_template.md` | 1040 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/advanced-full-text-search.md` | 1468 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/advanced-jsonb-indexing.md` | 1444 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/conn-idle-timeout.md` | 1282 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/conn-limits.md` | 1325 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/conn-pooling.md` | 1382 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/conn-prepared-statements.md` | 1529 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/data-batch-inserts.md` | 1287 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/data-n-plus-one.md` | 1361 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/data-pagination.md` | 1358 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/data-upsert.md` | 1390 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/lock-advisory.md` | 1531 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/lock-deadlock-prevention.md` | 1855 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/lock-short-transactions.md` | 1350 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/lock-skip-locked.md` | 1353 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md` | 1441 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/monitor-pg-stat-statements.md` | 1418 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/monitor-vacuum-analyze.md` | 1506 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/query-composite-indexes.md` | 1454 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/query-covering-indexes.md` | 1287 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/query-index-types.md` | 1521 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/query-missing-indexes.md` | 1218 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/query-partial-indexes.md` | 1347 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/schema-constraints.md` | 1880 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/schema-data-types.md` | 1453 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/schema-foreign-key-indexes.md` | 1679 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/schema-lowercase-identifiers.md` | 1728 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/schema-partitioning.md` | 1548 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/schema-primary-keys.md` | 1821 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/security-privileges.md` | 1566 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/security-rls-basics.md` | 1372 |
| `supabase-skills/skills/supabase-postgres-best-practices/references/security-rls-performance.md` | 2103 |

## 9. `skills/postgres-diagnostics` in pgrundev/pgbot

- Role: 5. Search candidate
- Repo (repo-level): 1523 stars, 74 forks, 6 open issues, last push 2026-11-24T06:58:02Z, GitHub license SPDX `NOASSERTION`
- Skill (skill-level): last commit touching `skills/postgres-diagnostics` is `788f01881c769f95ba4c262eae8533937119e857` dated 2026-09-01T23:54:02Z ("docs(skill): teach the new commands — why --duration, waits, activity, logs, erd, report")
- Skill frontmatter license: not available (no license field)
- Repo LICENSE file: present, first lines: `Apache License / Version 2.0, January 2004 / http://www.apache.org/licenses/ / Copyright 2026 pgrun.dev / Licensed under the Apache License, Version 2.0 (the "L`
- skills.sh installs (skill-level): 47 (https://www.skills.sh/pgrundev/pgbot/postgres-diagnostics)
- Install instructions: SKILL.md lines 55-57: `curl -fsSL https://pgbot.dev/install | sh` (pipe-to-shell), or `brew install pgrundev/tap/pgbot`, or `npx @pgbot/cli`. Not run. Single file, no scripts in the skill folder. The skill drives an external binary (pgbot) that is not in this repo path.
- Files in skill folder (1, sizes are blob bytes from the git tree):

| File | Bytes |
|---|---|
| `postgres-diagnostics/SKILL.md` | 7027 |

## Borghei Claude-Skills: license detail

Files at repo root: `LICENSE` only (2718 bytes). No separate COMMONS-CLAUSE or NOTICE file exists in the repo. The Commons Clause text is inside `LICENSE`, saved at `<scratchpad>/skills-src/database-designer/LICENSE.repo`. Repo-wide search for license/notice/commons file names found only code and doc files (for example `engineering/dependency-auditor/scripts/license_checker.py`), none of which are licence grants.

Exact restriction wording in LICENSE:

> "Without limiting other conditions in the License, the grant of rights under the License will not include, and the License does not grant to you, the right to Sell the Software."

> "'Sell' means practicing any or all of the rights granted to you under the License to provide to third parties, for a fee or other consideration (including without limitation fees for hosting or consulting/support services related to the Software), a product or service whose value derives, entirely or substantially, from the functionality of the Software."

> "Any license notice or attribution required by the License must also include this Commons Clause License Condition notice."

Header: "Software: Claude Skills Library / License: MIT / Licensor: Amin Borghei (borghei)". Plain-language summary in the same file: "You CANNOT: Sell this software or substantially similar copies of it; Repackage these skills as a paid product or service; Offer a commercial hosted service whose primary value comes from this software; Remove the license or attribution notices."

README line 115 says: "MIT + Commons Clause. Free for open-source, personal, education and internal business use. It can't be sold or repackaged as a paid product."

Frontmatter of `engineering/database-designer/SKILL.md` line 7: `license: MIT + Commons Clause`. The Commons Clause is not an OSI-approved open-source licence, so this skill is source-available rather than open source. Its MIT portion is the usual MIT text with the Commons Clause condition added.

## Not found / not checked

- skills.sh install counts: available for all nine listed skill pages (values above). Repo-level skills.sh data was not checked.
- Downloads were not executed; the pgbot skill's pipe-to-shell installer (`curl ... | sh`) was not run.
