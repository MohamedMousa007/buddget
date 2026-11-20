# Brief for every investigation agent

You are one of several read-only investigators. The lead session owns the plan and all decisions. Read this file, then only your rows in `01-issue-register.md`.

## Rules
1. **Read-only.** Change no product code, tests, migrations or config. The only file you write is your own findings file (path in your prompt).
2. **No dev server, no test runner, no live database query, no network calls to production.** If a database fact would settle something, write the exact SQL you want under "Queries for the lead" and the lead runs it.
3. Find the **root cause**, not the symptom. Trace the real code path: UI event, store, service, API route, SQL function. Quote `path:line` for every claim.
4. Separate **confirmed** (you read the code that does it) from **hypothesis** (plausible, not proven). Say what evidence is missing.
5. The owner's proposed solutions are suggestions. Say so when a simpler or safer fix exists, and when a proposal cannot work.
6. Check history for your area: `git log --oneline -15 -- <paths>` and `git branch -r --no-merged origin/main` (recent work lives on `claude/wizardly-elion-081241`, `claude/practical-khayyam-2539d2`, `claude/inspiring-boyd-84cc3b`, `claude/ecstatic-shamir-e2f695`, `ios/one-automation-sms`). State whether each symptom still exists at `origin/main` (this worktree) or only in an older native build (current store builds: iOS 146, Android vc180, built at `75e4ce8c`). An unmerged branch may already fix it.
7. Reuse first: name the existing component, hook, service or SQL function a fix would build on (`src/components/ui`, `src/components/features`, `docs/DESIGN_SYSTEM.md`).
8. Look for a cause shared with other issues, including ones outside your set.
9. Existing tests: list the test files and `e2e/` cases (see `e2e/README.md`) that already cover the area.
10. Do not read the whole repository. Start from `docs/REPO_MAP.md` or `CLAUDE_CONTEXT.md` only if you cannot find your entry point with a search.
11. A hook blocks your first shell command and your first write to a new file until you state the facts it asks for in plain text; state them and repeat the same call.

## Findings file: one section per issue

| Field | Content |
|---|---|
| Issue ID | BDG-XXX |
| Summary | one sentence |
| Severity | P0 / P1 / P2 / P3 |
| Reproducibility | consistent / intermittent / unconfirmed, with the exact steps |
| Platform | web / iOS / Android / all |
| Affected components | exact paths and lines |
| Backend dependencies | routes, SQL functions, tables |
| Root cause | confirmed explanation, or the ranked hypotheses |
| Evidence | `path:line` quotes |
| Shared causes | related issue IDs |
| Proposed solution | files to change, what changes, any migration, what is reused |
| Regression risk | what could break |
| Test that proves it | the smallest test that fails today and passes after the fix (unit, integration, Playwright or native), or "owner review" for a visual-only change |
| Confidence | high / medium / low |
| Missing evidence | what you could not verify here |

End the file with: "Queries for the lead", "Decisions that need the owner", "Decisions that need Council".

## What you send back
About 300 words: per issue, the root cause in one line with its confidence, the fix direction in one line, and anything that surprised you. The detail stays in the file.
