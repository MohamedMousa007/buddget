# Progress and handoff

Read this first in any new session. Then read only the documents your work needs.

## Where things stand (2026-11-20)
- Phase: **1, investigation**. No product code, migration or test has been changed.
- Branch: `claude/risk-based-testing-philosophy-9bacd9`, equal to `origin/main` at `3d65b36f` when work started.
- Lead: Claude Fable 5.2 (the brief names Opus; this session runs on Fable). Investigators: subagents on Opus and Sonnet, read-only.
- Gate: nothing is built until the owner approves the audited plan.

## Standing decisions
- Testing follows `CLAUDE.md` "What to test: by risk, not everything" (owner rule, 2026-11-20), which overrides the brief's "Playwright for every issue". Tiers are in `01-issue-register.md`. Playwright stays at workers 1. Tests run only on the cloud QA runner.
- "Jobs 10 and 12" and the "sync rerun" are numbered cloud QA runner jobs from the session "Fable 5 prioritization strategy" (`local_b13bbb44-e2f0-4b84-9288-4b23c85d0598`), not scheduled database jobs. See `02-backend-job-status.md`.

## Documents
| File | State |
|---|---|
| `01-issue-register.md` | written, tiers set |
| `agent-brief.md` | written |
| `findings/A..G-*.md` | being written by the investigators |
| `02-backend-job-status.md` | pending (lead) |
| `03-root-cause-analysis.md`, `04-cross-system-dependencies.md` | pending, after findings |
| `05-fix-plan.md`, `06-council-review.md`, `07-independent-plan-audit.md` | pending |
| `08-playwright-test-plan.md`, `09-playwright-results.md`, `10-native-test-requirements.md` | pending |
| `11-implementation-report.md` | after approval |

## Investigators
| Stream | Issues | Model | Findings file |
|---|---|---|---|
| A | BDG-001, 002, 023 | Sonnet | `findings/A-settings.md` |
| B | BDG-008 | Opus | `findings/B-sms-setup.md` |
| C1 | BDG-009, 010, 011, 012, 016 | Opus | `findings/C1-buddgy-usage.md` |
| C2 | BDG-013, 015 | Opus | `findings/C2-buddgy-context-actions.md` |
| D | BDG-019, 020, 021, 022 | Opus | `findings/D-billing.md` |
| E | BDG-003, 004, 005, 006, 007 | Sonnet | `findings/E-invites-rewards.md` |
| F | BDG-014, 017, 018 | Sonnet | `findings/F-navigation-keyboard.md` |
| G | BDG-024, 025, 026, 027, 028 | Sonnet | `findings/G-accounts-savings.md` |
| H | jobs 10, 12, sync rerun | lead | `02-backend-job-status.md` |

## Next steps
1. Collect findings, run the queries the investigators ask for (one at a time, counts and ids only).
2. Write 03 and 04, then the fix plan (05).
3. Council (`ecc:council`) on: SMS device state, context compaction, action confirmation, Buddgy drag, invite expiry, cancellation and retention, cross-platform purchase.
4. Independent audit by a fresh agent that sees the brief, root causes and plan, not the lead's reasoning.
5. Test plan by tier; baseline runs go to the cloud QA runner.
6. Present to the owner. Stop.
