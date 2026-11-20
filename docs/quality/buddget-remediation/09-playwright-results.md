# Test results

## Baseline: status as of 2026-11-20

**No test was run in this phase.** Nothing below is "tested".

| Item | State | Why |
|---|---|---|
| New cases from `08-playwright-test-plan.md` | not written | written test-first at the start of each approved fix |
| Baseline run | **Blocked** | tests run only on the cloud QA runner; the existing runner ("qa-runner: round 2 fix branches gate + live suites") is not among the sessions this one can list or message (checked with the session list and the agent list), and it still holds jobs 18 to 21 |
| Runner jobs 18 to 21 (sync, S8a, UI sweep, S-2) | result unknown | the runner cannot message back; results exist only in its own chat |

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
