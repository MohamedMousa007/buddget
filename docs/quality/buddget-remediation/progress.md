# Progress and handoff

Read this first in any new session. Then read only the documents your work needs.

## Where things stand (2026-11-20)
- Phase: **waiting for the owner.** Investigation, fix plan (revision 2), Council and independent audit are done. No product code, migration or test has been changed or run.
- Start with `00-investigation-index.md`: summary, open decisions, roadmap.
- Branch: `claude/risk-based-testing-philosophy-9bacd9` (docs only; not merged to dev or main).
- Lead: Claude Fable 5.2 (the brief names Opus). Investigators, Council voices and the auditor were subagents on Opus and Sonnet.
- Gate: nothing is built until the owner rules on the list in section I of the index.

## Standing decisions
- Testing follows `CLAUDE.md` "What to test: by risk, not everything" (owner rule, 2026-11-20), which overrides the brief's "Playwright for every issue". Tiers are in `01-issue-register.md`. Playwright stays at workers 1. Tests run only on the cloud QA runner.
- "Jobs 10 and 12" and the "sync rerun" are numbered cloud QA runner jobs from the session "Fable 5 prioritization strategy" (`local_b13bbb44-e2f0-4b84-9288-4b23c85d0598`), not scheduled database jobs. See `02-backend-job-status.md`.

## Next steps
1. Owner: the four actions and fifteen rulings in the index.
2. Then build in the order of `05-fix-plan.md`, test-first per item (`08`), runs on the cloud QA runner only.
3. Server-only fixes go first: 1.2 server part, 1.1 slice 1, the SMS device-row precedence.
4. UI-only items: mockup, owner approval, build, screenshot.
5. Record every run in `09`, device checks in `10`, and the outcome in `11-implementation-report.md` with the four labels from `CLAUDE.md`.
