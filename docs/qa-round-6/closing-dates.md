# Round 6 closing: dates, debts, SMS date parser

## Live database
- Migration 0243 (`supabase/migrations/0243_repair_yy_mm_dd_sms_dates.sql`) APPLIED LIVE (project ydihurtbcnoflhormgzi). Nothing half-applied.
- Before: 5 rows in the wrong year (3 income_events, 2 expenses; ids start 0473c90c, 1202a9e4, 8290b9ea, 944ebd53, 41c10f37). `occurrence_date` is NULL on all; no unique index involves a date (only sms_log_id and template+occurrence), so no collision possible.
- Dry run in `BEGIN ... ROLLBACK`: exactly 5 rows changed. Live apply, then re-SELECT: received/expense dates now 2026-10-24, 2026-10-25, 2026-10-21 (incomes), 2026-07-30, 2026-07-09 (expenses); future/<2020 expenses = 0. Date = Cairo day of `sms_parse_log.received_at`; the unlinked expense uses its created_at Cairo day. `updated_at` bumped so devices re-pull. No schema change, so `database.types.ts` is unchanged.

## Status per ID
| ID | Status | Change / test |
|---|---|---|
| DEB-1 / TZL-2 | Fixed | New `src/lib/time/calendarDays.ts` (y/m/d arithmetic). `subscriptionDates.advanceCycle`/`computeNextBillingDate`, `subscriptionOccurrence.cycleWindow`, `subscriptionForecast` (limit, `isSameDay`). Tests `calendarDays.test.ts`, `dstWeekly.test.ts` (105 rows over 2 years, paid detection, forecast today), Cairo + New York. |
| DEB-2 | Fixed | `computeCreditCardBalance` cycleStart via addCalendarDays. `cardCycleDates.test.ts` (7 due days x 26 months daily, DST-day first charge). |
| DEB-3 | Fixed | `bnplPlanDebt()` in `bnplSplit.ts`, startDate = installmentFirstDue; hook `useAddExpenseSheet` uses it. Test in `cardCycleDates.test.ts`. |
| DEB-4 | Fixed | `lib/subscriptions/logDue.ts` (`chargesToLog`, last 3 cycles from trackedFrom, trial aware; `subscriptionChargeId` deterministic). Store `logDueSubscriptions` back-fills; `markSubscriptionPaid({expenseId})` skips an existing id; `addExpense` accepts optional id. `useLogDueSubscriptions` (boot + 60s tick, waits for expenses hydration) mounted in `ModalProvider`; the page-only effect removed. Tests in `dstWeekly.test.ts` (idempotent re-run, back-fill capped at 3, no back-fill before tracking). |
| DEB-5 | Fixed | `lib/debt/cardDue.ts` used by `useDebtTabData`: regularDue = min(cycle charges, outstanding), after no longer subtracts instalments. Test in `cardCycleDates.test.ts`. |
| FUZ-1 / FUZ-2 | Fixed | `paydaySchedule.ts`: `taken` keyed by ISO date; `nearestFreeDay` (same month, in window, working day first, later first) when both shifted and raw date are taken; shifts use calendar-day helpers. Existing "shift reverts to the unshifted date" rule kept. Test `paydayCollisions.test.ts` incl. exhaustive count conservation. |
| DBI-1 | Fixed (code + data) | `parseSmsDay`: dd/mm/yy vs yy/mm/dd by nearest to received_at (yy/mm/dd only believed within 35 d), null (caller uses received day) if the nearest is over 366 d off, 4-digit years untouched, same rule for DDMMMYY. `matchCuratedPattern` now gets `receivedAt` (sms/parse route, usePendingSmsPreviews). Test `parseSmsDayOrder.test.ts` incl. 6000-case property (within 36 d). Data: migration 0243 above. |
| REG-2 / TZL-1 | Fixed | `resolveUserTimeZone` (Cairo default) in `server/userTimeZone.ts`; used by `matchSalary` and as last fallback in `weekStart.ts`. `matchSalary.test.ts`: two tests that assumed a UTC default now pass an explicit Sat+Sun user; new test that null/invalid prefs equal Cairo. |
| TZL-3 | Fixed | wealth page hawl dates use `parseDateOnly`; `pocketIdentity` parses date-only locally and uses `monthNames(locale)` (callers pass locale). Test in `parseSmsDayOrder.test.ts`. |
| TZL-10 | Fixed | `weeksElapsed` (7-day periods) in `useDebtTabData`. |
| TZL-11 | Fixed | `legacyWeeklyWalk`, `addByFrequency`, `heroStats` use calendar helpers. |

## Verification
`TZ=Africa/Cairo vitest run src/lib src/hooks`: 4176 pass, 1 fail (`subscriptionMerge.test.ts` updatedAt round trip: caused by another fixer's uncommitted mapper changes, not this area). eslint on touched files: 0 errors. `tsc` errors seen are in other agents' files (ModalShell.exit.test, liteReact, devices route).

## Left / notes
- New York full-suite run was still in flight when this was written; targeted new tests pass in both zones.
- Deleting an auto-logged subscription charge re-creates it with the same deterministic id (same as before: it was re-logged with a random id).
- Native/TestFlight untouched.
