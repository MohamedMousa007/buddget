# B5 adversarial review (uncommitted diff)

Read-only review. Ledger file docs/QA_ROUND_2_LEDGER.md does not exist in this worktree; reviewed the diff only. No blockers found; 3 mediums, rest low.

## Medium

### M1 planForMonth override applies to the latest activation's own month
src/lib/budget/activations.ts:30. Condition `keyOf(latest) <= monthKey` fires when monthKey equals the latest activation's cycle. If a plan was activated without a log row (active != latest.planId), the log row for that very cycle (which says plan X governs) is overridden by the active plan. The comment says "months the log does not reach", i.e. strictly `<`. Scenario: log has {2026-10 -> A}, user sets B active without a row; October (the cycle A was activated in, history already judged by A) now judged by B. Fix: use `keyOf(latest) < monthKey` (and decide current-cycle explicitly), add test for equality month.

### M2 Flow hero "Money in" now includes projected, unreceived income and ignores the range/segment
src/components/features/flow/useFlowBand.ts:81. `stats.totalIncome` = actual events + projected fallback for open paydays (monthlyStats.ts:137), whole cycle. Before it was counted ledger "in" rows in the resolved range. With a non-month range preset (7 days, custom) Money in still shows full-cycle income while the list below shows only the range, and mid-cycle it shows paydays that have not happened as "Money in". Also 0 when incomeBlocked. Fix: if intended, label as expected or use `periodReceived` (realizedOnly); at minimum use `all` when rangePreset !== 'month'. No test covers this.

### M3 Reports "This year" in early cycle of January shows the previous year
src/lib/reports/reportsPeriod.ts:21. `back = current.getMonth()` where `current` is the cycle key's month. With monthStartDay=25 on Jan 10 the cycle key is Dec of last year, so back=11, count=12: Jan..Dec of the previous year, labelled "This year". Fix: base thisYear on `now.getFullYear()` (back = months from Jan of now's year to current, clamped >= 0, count = back+1 and cap at 1 when current is previous year) or accept and add test. Test file does not cover now in Jan with day<start.

## Low

### L1 CategoryPieChart "Other" collides with a real "Other" category
src/components/reports/CategoryPieChart.tsx:61 and foldTail. Folded slice is named 'Other'; a genuine 'Other' category in the head yields two slices named Other and a duplicate React `key={d.name}` (warning, wrong cell reuse). Also a genuine 'Other' at exactly 6 slices gets the muted colour. Fix: key by index, fold flag instead of name compare, localised label.

### L2 WidgetSync cycle key frozen between recomputes
src/lib/native/WidgetSync.tsx:43. `cycleKeyFor(new Date(), ...)` is inside useMemo with no time dependency, so after a cycle rollover the snapshot stays on the old cycle until expenses/settings change. It no longer follows the store monthFilter (intended) but also loses the only thing that re-ran it. Fix: add a cycle-key value computed in render (or the same rollover tick) to deps. Also sumBudget now counts Debt/Remittance rows; verify against totalExpenseBudgetFromPlan to avoid widget budget != Flow budget.

### L3 isLearning inconsistent across callers
src/lib/notifications/useNotifications.ts:80 calls isLearning without base/rates (falls back to raw `effectivePlanCategoryAmount`), usePlanView passes base/rates. Multi-currency plan can be "learning" in one place and not the other (alerts vs UI). Fix: pass base and rates in the notifications selector.

### L4 Reports pace panel uses app monthFilter, gated by range
src/app/(app)/reports/page.tsx:63. `dateRange==='thisMonth'` refers to the current cycle but `stats` follows settings monthFilter; if the user is browsing another month (monthClosed false for a future cycle) the pace panel shows that month's numbers under "This month". Fix: also require monthFilter === current cycle key.

### L5 recordActivation ignores later rows
src/lib/budget/activations.ts (recordActivation). "In force" is computed from rows < cycleKey only; if rows exist after cycleKey, switching back to the plan that precedes them silently drops the cycleKey row yet later rows still apply, which is correct, but a no-op switch when a later row exists is not detectable by the caller (no toast). Minor; confirm intended.

### L6 closedCycles merge
BudgetPlanPage.tsx:453 / closeMemory.ts:42. `.sort().slice(-24)` is lexicographic on `YYYY-MM` which is fine; merge returns `local` by reference when nothing new, callers must not mutate. Local-only removal never propagates (set union), by design. No issue found.

## Checked, no issue
- computeMonthlyStats leftToSpend -> remaining rename: all consumers grep'd (wealth page passes it to AddSavingsSheetV3 whose prop is unused; runAiCommand, buddgy reports/context, tests). Contract consistent; netCashFlow added to the empty-state branch too. buddgy context.ts keeps `leftToSpend` meaning budget-left, which now matches its label.
- calculateDaysLeftInMonth future-cycle branch and getMonthRange clamp (28) consistent with budgetMonthKeyFor/cycleKeyFor.
- useCycleAwareMonth rollover: monthAfterRollover logic correct; interval and listener cleaned up.
- useDebtTabData cycle window: currentCycle end is endOfDay, inclusive; deps include monthStartDay.
- historyResults/monthClose over rounding: now consistent (over only when rounded > 0).
- Reports range: filterExpensesByRange end is endOfDay via getMonthRange, CSV savings window consistent.
- debtPayoff spare/freed rollover logic: no double count found.
- openPaydays cycle months: correct for startDay>1.
