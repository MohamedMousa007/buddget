# PR #54 (`claude/perf-audit-phase-a` @ 4fa1569): browser, API and live suites

Run 2026-11-27 by the cloud QA runner. Setup:
- `next dev -p 3100 --webpack` with `NEXT_PUBLIC_DEV_AUTH_BYPASS=0`, an empty `NEXT_PUBLIC_API_BASE_URL`, `TZ=Africa/Cairo` and `REVENUECAT_IGNORE_SANDBOX=1`, against the live Frankfurt project.
- Workers 1, line reporter, trace off.
- Throwaway `QA_PW`, `QA_SYNC_PW`, `CRON_SECRET` and RevenueCat test secrets, set on both the server and the runner.

| # | Suite | Passed | Failed | Skipped |
|---|---|---|---|---|
| 1a | `e2e/api/round2/pro-rewards/` (Playwright) | 81 (83 after re-run) | 2 on the first run, 0 on re-run | 0 |
| 1b | `pro-rewards/unit` (Vitest) | 8 | 0 | 0 |
| 2 | `e2e/api/round3/admin-devices.spec.ts` | 4 | 0 | 0 |
| 3 | `e2e/api/round2/support/support-loop.spec.ts` | 6 | 0 | 0 |
| 4 | `e2e/sync/` live sync (Vitest, 4 files) | 21 | 0 | 0 |

## Failures on the first run of 1a (both pass on re-run, neither caused by this PR)
- **F4b** (`40-referrals.spec.ts:74`): five 500s with "Manifest file is empty". The dev server was compiling `/api/referrals/redeem` for the first time while 10 parallel calls hit it. A dev-server artefact.
- **F9** (`40-referrals.spec.ts:178`): the friend had no `referrals` row because the redeem call just before it was answered 429. This PR doesn't change the redeem route, `rateLimit.ts` or `clientIp.ts`. Flaky: a redeem rate-limit bucket on the live database.

## What these suites cover in the PR
- **Sync delta retry and chunked writes:** the live sync suite, 21 passed.
- **`loyalty_refresh_tier` fast path (0352), plan and flag caching:** the pro-rewards loyalty, tier, billing and admin specs, all passed.
- **Audit before admin actions and the in-app confirm:** admin-devices A1–A3 and pro-rewards D8, passed.
- **Not covered here:** compound admin cursors, the directory total, the earlier receipt quota check and the admin sign-in reply. Those are covered by the unit tests (`npm run verify`: 7,928 passed in both time zones).

## Cleanup
Three synthetic `qa-e2e-sync*` users were created and deleted. **0 `qa-e2e-*` users are left.** The dev server is stopped.
