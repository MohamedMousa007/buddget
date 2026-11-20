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

## Step 1 tests: runner job 2 (2026-11-20, commit `541020cd`)

| Step | Result |
|---|---|
| `vitest` on `src/lib/server/ai/buddgy`, `src/app/api/buddgy` | 33 passed, 1 failed. All new stream cases in `gateway.test.ts` passed (21 of 21). The new route test passed. |
| `npm run verify` | **failed**, 2 of 6,571; lint, types, migration check, audit and build OK |

Both failures were in tests, not in the app:
1. `route.test.ts:52`: the older content-length test saw the new test's call on a shared mock. Fixed in `b80e285b` (mocks cleared before each test).
2. `sqlContracts.test.ts:35`: it pinned `ai_quota_settle_core` to its 0298 body, which 0337 changes on purpose. Fixed in `b80e285b`: it now checks that the function keeps no maintained counter and does not charge `error` or `aborted_empty`.

Status: step 1 is **not yet Automated verification**; the rerun on `b80e285b` decides it.

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

## Runner job 3 (2026-11-20, commit `b80e285b`)

| Step | Result |
|---|---|
| `vitest` on the Buddgy, usage, chat copy and SQL contract tests | 76 passed, 1 failed. Every new case passed: stream settle (21 of 21), route meta and label (2 of 2), SQL contract for 0337 (5 of 5), reset formatter (3 of 3), chat limit copy (4 of 4), new notice rules. |
| `npm run verify` | failed, 1 of 6,579; lint, types, migration check, audit, build OK; New York the same |
| `10-screens` journey | 12 of 12 passed; 0 synthetic users left |

The failure was an older test, `usageNotices.test.ts:170`, that expected a blocked sheet in the chat to stay hidden once shown. That is the behaviour BDG-012 changed on purpose. Fixed in the next commit: the old check now runs on the Flow screen, where once a session still holds, and a new line checks the chat shows it again.

## Runner job 4 (2026-11-20, commit `3f57e6ac`)

`npm run verify` passed: lint 0 errors, types OK, 6,579 passed and 0 failed in both Africa/Cairo and America/New_York (181 skipped), coverage above the floor (lines 83.07%), migration check OK, audit OK, production build OK. No journeys ran, so no synthetic users were made. Steps 1 and 2 are now **Automated verification** for their rules; the visible sheet and label stay **Manual verification required**.

## Runner job 5 (2026-11-20, commit `d358fbd9`)

| Step | Result |
|---|---|
| `vitest` on the AI quota, Buddgy route, chat client and SQL contract tests | 114 passed, 0 failed, 19 files |
| `npm run verify` | passed: lint 0 errors, types OK, 6,589 passed and 0 failed in Cairo and New York, coverage above the floor, migration check OK (304), audit OK, build OK |
| `node e2e/api/buddgy-turns.mjs` (real route, live PostgREST) | 9 of 9: turn id logged, answered turn charged, Retry free (units 0, exempt), re-run used up once shown, no turn id billed per request, 0 unsettled reservations, 0 synthetic users left |

Step 3 (BDG-011 slice 2) is now **Automated verification**; Retry on a phone stays **Native verification required**.

## Runner job 6 (2026-11-20, commit `0e35780b`)

`vitest` on `src/components/features/ai-chat`: 14 passed (geometry and orb 10 of 10, composer 4 of 4). `npm run verify` passed: 6,599 passed and 0 failed in Cairo and New York, coverage above the floor, migration check, audit and build OK. BDG-014 and BDG-018 logic is now **Automated verification**; the look on a phone stays **Native verification required**.

## Runner job 7 (2026-11-20, commit `c69c423d`)

`vitest` on `src/lib/buddgy` and `src/hooks`: 807 passed, 0 failed. `npm run verify` passed: 6,600 passed and 0 failed in Cairo and New York, coverage above the floor, migration check, audit and build OK. BDG-015's consent rules are now **Automated verification**; the chat closing before a page opens stays **Manual verification required**.

## Runner job 9 (2026-11-20, commit `4bd0c2a3`)

The targeted run passed: Buddgy, hooks, ai-chat and membership, 866 of 866. `npm run verify` had 1 failure, at `noStyledRawButtons.test.ts:144`: the new chat list's two row buttons had no `data-raw-button-ok` reason. Lint, types, migration check, audit and build passed. The markers were added in `b8516a9b`, and the rerun goes with the next job.

## Runner job 10 (2026-11-20, commit `ac0fdb8f`)

- **Targeted run:** 988 of 988 passed across payment, accounts, payments, rewards, membership, ai-chat, buddgy and hooks.
- **`npm run verify`:** 1 failure, at `a11yFixes.test.tsx:188` (A11-8). Eight `text-[Npx]` font sizes in the new card faces don't follow the iOS text size. Converted to rem in `1749eeb1`; at the default size they look the same. Lint, types, migration check (306), audit and build passed.
- **Screenshots:** 12 taken (6 English, 6 Arabic): Accounts strip, wallet carousel, add-card sheet top and themes, expense sheet, Rewards streak. They went to the owner for the visual check.
- **Synthetic users:** 0 left on live.

## Runner job 11 (2026-11-20, commit `ccbf5a4c`)

`npm run verify` passed: 6,658 passed and 0 failed in Cairo and New York, coverage above the floor, lint, types, migration check (306), audit and build OK. Card faces, the streak strip, Claude-style chats and BDG-003 are now **Automated verification**; their look stays with the owner (screenshots from job 10) and the device checks.

## Runner job 12 (2026-11-21, commit `f99b9a17`)

- **Unit:** 919 passed, 1 failed, at `actionCards.render.test.tsx:62`. Cause: the test's `getInitialState` spy never took effect under zustand v5, so the render read an empty store. Fixed in `44952132`. The same fix went into `plan.render.test.tsx`.
- **Journey `g-buddgy`:** failed 2 of 2. Cause, found by reading the code: BDG-014's focus listener re-laid out the chat panel between mousedown and mouseup on Send, so the click missed. Fixed in `926da68d` with a press gate: layout changes from focus wait until the press ends. Not yet reproduced or rerun.
- **Other gates:** lint, types, migration check, audit and build passed. 0 synthetic users left.

## Cloud job 13 (2026-11-21, commit `47a42278`, parallel runner)

The same two failures as job 12, both already fixed in `44952132` and `926da68d`:
- `actionCards.render.test.tsx:62`
- `g-buddgy.spec.ts:26`

Everything else passed: 1,395 other targeted tests (including budget-in-chat), lint, types, migration check, audit and build. 0 `qa-e2e-job13-*` users left. Runner notes: the container's Playwright browser is build 1243 while the repo wants 1255, and the journey names its users from the test title.
