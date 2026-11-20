# Test results

## Baseline: runner job 1 (2026-11-20, commit `665108ca`, today's code before any fix)

Runner: cloud session "qa-runner: remediation program". Africa/Cairo, workers 1, no retries.

| Step | Result |
|---|---|
| `npm run verify` | **passed**: 6,568 tests passed, 181 skipped, 0 failed, same in Cairo and New York; lint 0 errors; types, migration check, audit and build OK; coverage above the floor |
| `vitest` on `src/lib/buddgy`, `src/lib/billing`, `src/lib/supabase/remote`, `useSetupProgress` | 988 passed, 0 failed |
| `g-buddgy` journey | 1 of 1 passed |
| `d-pockets` journeys D and D2 | 2 of 2 passed |
| `round2/pro-rewards/10-screens` | 12 of 12 passed (J1 to J9 at phone size; J2, J4, J5 again at desktop) |
| Synthetic users left on live | 0 |

Meaning: no existing test catches any of the 28 issues today. That is expected: the new cases in `08` are the ones written to fail first.

Runner notes kept for later jobs: the unit tests ran with app credentials removed, so none could reach live; the container's Chromium needs a path override (scratchpad wrapper config, no repo change); `NODE_USE_ENV_PROXY=1` is needed to reach Supabase; `POST /api/auth/welcome` answered 502 on the dev server 47 times without failing any journey (not investigated; possibly the dev server having no email key, see QA-10 notes); the runner wrote a git-ignored `.env.local` from the container's own environment.

## Step 1 tests (job 2)
Not run yet. Job text is in `11-implementation-report.md`.

## What stands in for a baseline today

Evidence that each defect exists now, without a test run:

| ID | Evidence | Kind |
|---|---|---|
| BDG-001 | `settingsMapper.ts:8` maps System to `dark`; live enum is `dark,light` | code read by the lead + live catalog |
| BDG-011 | 26 of 53 chat calls failed in 14 days, all on the retired quick-tier model; commit `880058ab` records 404s since 19 October | live counts + git history |
| BDG-013 | 7,634 units per successful call, 14% cached; 8 chats at 10 to 15 thousand units after one turn; note line at 30,000 | live counts + code read by an investigator |
| BDG-019 | no billing event in the database at all; all 50 entitlement rows are the default kind | live counts |
| BDG-008 | 2 of 7 collecting iPhones never delivered an SMS; 1 account with two collecting phones | live counts |
| BDG-004 to 006 | 51 invite codes, 0 completed referrals | live counts |
| BDG-H2 | runner jobs 9 and 13: R14 failed 2 of 3 runs, R17 failed | earlier runner output |
| all others | code read by one investigator, `path:line` in `findings/` | code read, not independently rerun |

## After approval
This file gets, per issue: the case, the failing run before the fix (with the runner's output line), the passing run after, and the regression suite result.
