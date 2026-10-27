import type { FinanceStore } from '@/lib/store/types'
import { isOwedToUser } from '@/lib/debts/debtDirection'
import { planForMonth } from '@/lib/budget/activations'
import {
  budgetCategoriesFromPlan,
  categorySpendingForPlanRows,
  otherRowName,
  planRowNames,
  unassignedSpend,
  totalExpenseBudgetFromPlan,
  totalPlannedExpensesForPlan,
  totalPlannedSavingsAllocationForPlan,
} from '@/lib/budget/budgetPlans'
import {
  filterExpensesByMonth,
  projectedIncomeForMonth,
  actualIncomeForMonth,
  calculateTotalSpent,
  calculateTotalSpentExcludingSavings,
  calculateCategorySpending,
  calculateTotalBudget,
  calculateTotalBudgetExcludingSavings,
  calculateBudgetUsedPercent,
  budgetMonthKeyFor,
  calculateDaysLeftInMonth,
  totalSavingsHoldingsInBase,
  totalSavingsAccountsBalanceInBase,
  netSavingsLedgerInBaseForMonth,
  calculateLeftToSpendCashFlow,
  effectiveCategoryBudget,
  totalDebtRemainingDetail,
  expenseAmountInBase,
  calculateCashOutflow,
  cashSavingsDepositsInBaseForMonth,
  filterDebtPaymentsByMonth,
} from '@/lib/utils/calculations'
import {
  daysElapsedInMonth,
  totalDaysInMonth,
  dailySpendingRate,
  projectedMonthSpend,
  spendingPaceStatus,
  suggestedDailyBudget,
  topOverspentCategories,
  type PaceStatus,
  type OverspentCategory,
} from '@/lib/utils/spendingPace'

export interface MonthlyStatsInput {
  expenses: FinanceStore['expenses']
  incomeSources: FinanceStore['incomeSources']
  incomeEvents: FinanceStore['incomeEvents']
  budgetCategories: FinanceStore['budgetCategories']
  budgetPlans: FinanceStore['budgetPlans']
  budgetPlanActivations: FinanceStore['budgetPlanActivations']
  activeBudgetPlanId: FinanceStore['activeBudgetPlanId']
  savingsHoldings: FinanceStore['savingsHoldings']
  savingsAccounts: FinanceStore['savingsAccounts']
  savingsTransactions: FinanceStore['savingsTransactions']
  debts: FinanceStore['debts']
  debtPayments: FinanceStore['debtPayments']
  settings: FinanceStore['settings']
  exchangeRates: FinanceStore['exchangeRates']
  goldPricePerGram: FinanceStore['goldPricePerGram']
  goldPriceAvailable: FinanceStore['goldPriceAvailable']
  monthFilter: string
  trustLocalFinance: boolean
}

/** Pure month figures (income, spend, left to spend, pace). The hook and Buddgy's tools both read this. */
export function computeMonthlyStats(input: MonthlyStatsInput) {
  const { expenses, incomeSources, incomeEvents, budgetCategories, budgetPlans, budgetPlanActivations, activeBudgetPlanId, savingsHoldings, savingsAccounts, savingsTransactions, debts, debtPayments, settings, exchangeRates, goldPricePerGram, goldPriceAvailable, monthFilter, trustLocalFinance } = input
  if (!trustLocalFinance) {
    const daysLeft = calculateDaysLeftInMonth(monthFilter, settings.monthStartDay)
    return {
      monthlyExpenses: [],
      totalIncome: 0,
      totalSpent: 0,
      totalSpentExcludingSavings: 0,
      cashOutflow: 0,
      totalBudget: 0,
      totalExpenseBudget: 0,
      remaining: 0,
      budgetUsedPercent: 0,
      categorySpending: {} as ReturnType<typeof calculateCategorySpending>,
      spendingByEnum: {} as ReturnType<typeof calculateCategorySpending>,
      unassignedSpendByCategory: {} as Record<string, number>,
      unassignedSpendTotal: 0,
      dashboardBudgetCategories: [],
      daysLeft,
      savingsTotal: 0,
      savingsHoldingsTotal: 0,
      savingsAccountsTotal: 0,
      savingsFromExpenses: 0,
      netSavingsTransfersThisMonth: 0,
      monthClosed: false,
      projectedMonthSavings: 0,
      realizedMonthSavings: 0,
      savingsThisMonth: 0,
      leftToSpend: 0,
      categoryBudgetCaps: {} as Record<string, number>,
      debtRemainingTotal: 0,
      debtRemainingIncomplete: false,
      baseCurrency: settings.baseCurrency,
      incomeBlocked: false,
      daysElapsed: 1,
      dailyRate: 0,
      projectedSpend: 0,
      paceStatus: 'on_track' as PaceStatus,
      suggestedDaily: 0,
      overBudgetCategories: [] as OverspentCategory[],
      plannedSavingsBudget: 0,
    }
  }
  const monthlyExpenses = filterExpensesByMonth(expenses, monthFilter, settings.monthStartDay)
  // Two income numbers: `projectedIncome` (expected recurring — budgets scale on it)
  // vs `totalIncome`/actual (events + projected fallback — the KPI + realized savings).
  const rawProjectedIncome = projectedIncomeForMonth(
    incomeSources,
    settings.baseCurrency,
    exchangeRates,
    monthFilter,
    settings.monthStartDay
  )
  const rawActualIncome = actualIncomeForMonth(
    incomeSources,
    incomeEvents,
    settings.baseCurrency,
    exchangeRates,
    monthFilter,
    settings.monthStartDay
  )
  const incomeBlocked =
    settings.noIncomeDeclared === true && incomeSources.length === 0 && incomeEvents.length === 0
  const projectedIncome = incomeBlocked ? 0 : rawProjectedIncome
  const totalIncome = incomeBlocked ? 0 : rawActualIncome
  const totalSpent = calculateTotalSpent(monthlyExpenses, settings.baseCurrency, exchangeRates)
  const totalSpentForExpenseBudget = calculateTotalSpentExcludingSavings(
    monthlyExpenses,
    settings.baseCurrency,
    exchangeRates
  )
  // A past month is judged by the plan that was active then; the current month by the active plan.
  const activePlan = planForMonth(budgetPlans, budgetPlanActivations, monthFilter, activeBudgetPlanId)
  /** Plan drives dashboard category rows only when it has at least one category row. */
  const planForCategoryBar =
    activePlan != null && activePlan.categories.length > 0 ? activePlan : null

  const totalBudget = activePlan
    ? totalPlannedExpensesForPlan(activePlan, settings.baseCurrency, exchangeRates)
    : calculateTotalBudget(budgetCategories, settings, projectedIncome)
  const totalExpenseBudget = activePlan
    ? totalExpenseBudgetFromPlan(activePlan, settings.baseCurrency, exchangeRates)
    : calculateTotalBudgetExcludingSavings(budgetCategories, settings, projectedIncome)
  const plannedSavingsBudget = activePlan
    ? totalPlannedSavingsAllocationForPlan(activePlan, settings.baseCurrency, exchangeRates)
    : budgetCategories
        .filter((b) => b.category === 'Savings')
        .reduce((s, b) => s + effectiveCategoryBudget(b, settings, projectedIncome), 0)
  const remaining = totalExpenseBudget - totalSpentForExpenseBudget
  const budgetUsedPercent = calculateBudgetUsedPercent(totalSpentForExpenseBudget, totalExpenseBudget)
  const spendingByEnum = calculateCategorySpending(
    monthlyExpenses,
    settings.baseCurrency,
    exchangeRates
  )
  const rowNames = planForCategoryBar ? planRowNames(planForCategoryBar) : []
  // Spend no plan row covers: still in every total; also consumes the plan's Other row.
  const unassignedSpendByCategory = planForCategoryBar ? unassignedSpend(spendingByEnum, rowNames) : {}
  const unassignedSpendTotal = Object.values(unassignedSpendByCategory).reduce((s, v) => s + v, 0)
  const otherRow = otherRowName(rowNames)
  const rowSpending = planForCategoryBar
    ? categorySpendingForPlanRows(spendingByEnum, planForCategoryBar)
    : spendingByEnum
  const categorySpending =
    otherRow != null && unassignedSpendTotal > 0
      ? { ...rowSpending, [otherRow]: (rowSpending[otherRow] ?? 0) + unassignedSpendTotal }
      : rowSpending
  const daysLeft = calculateDaysLeftInMonth(monthFilter, settings.monthStartDay)

  // Month-filtered: used for budget progress and savings nudge notifications.
  const savingsFromExpenses = monthlyExpenses
    .filter((e) => e.category === 'Savings')
    .reduce((sum, e) => sum + expenseAmountInBase(e, settings.baseCurrency, exchangeRates), 0)

  // All-time: so the cumulative "Saved" total persists across month boundaries.
  const allTimeSavingsFromExpenses = expenses
    .filter((e) => e.category === 'Savings')
    .reduce((sum, e) => sum + expenseAmountInBase(e, settings.baseCurrency, exchangeRates), 0)

  const savingsHoldingsTotal = totalSavingsHoldingsInBase(
    savingsHoldings,
    settings.baseCurrency,
    exchangeRates
  )
  const goldOk = goldPriceAvailable !== false
  const savingsAccountsTotal = totalSavingsAccountsBalanceInBase(
    savingsAccounts,
    settings.baseCurrency,
    exchangeRates,
    goldPricePerGram,
    goldOk
  )

  const savingsTotal = savingsAccountsTotal + savingsHoldingsTotal + allTimeSavingsFromExpenses

  const netSavingsTransfersThisMonth = netSavingsLedgerInBaseForMonth(
    savingsTransactions,
    monthFilter,
    settings.monthStartDay,
    settings.baseCurrency,
    exchangeRates,
    { pricePerGram: goldPricePerGram, available: goldOk }
  )

  // Month-scoped savings semantics. While the user is inside the
  // current cycle the dashboard shows what they're *projected* to save
  // based on the active plan (income − planned expense budget). Once
  // the cycle has closed (a past `monthFilter`), we surface what they
  // *actually* saved (income − actual spend). Both clamp at zero so a
  // shortfall reads as zero saved rather than a negative figure.
  const monthClosed = monthFilter < budgetMonthKeyFor(new Date(), settings.monthStartDay)
  // Projected savings plans on expected income; realized reconciles against actual.
  const projectedMonthSavings = Math.max(0, projectedIncome - totalExpenseBudget)
  const realizedMonthSavings = Math.max(0, totalIncome - totalSpentForExpenseBudget)
  const savingsThisMonth = monthClosed ? realizedMonthSavings : projectedMonthSavings

  const leftToSpend = calculateLeftToSpendCashFlow({
    monthStr: monthFilter,
    monthStartDay: settings.monthStartDay,
    expenses,
    incomeSources,
    incomeEvents,
    savingsTransactions,
    baseCurrency: settings.baseCurrency,
    exchangeRates,
    incomeBlocked,
    gold: { pricePerGram: goldPricePerGram, available: goldOk },
    // Reserve the still-unfunded part of the monthly savings target from spendable cash.
    monthlyTarget: plannedSavingsBudget,
  })

  const effectiveBudgetRows = planForCategoryBar
    ? budgetCategoriesFromPlan(planForCategoryBar, settings.baseCurrency, exchangeRates)
    : []
  const categoryBudgetCaps = Object.fromEntries(
    effectiveBudgetRows.map((b) => [
      b.category,
      planForCategoryBar ? b.budgetedAmount : effectiveCategoryBudget(b, settings, projectedIncome),
    ])
  ) as Record<string, number>

  const { total: debtRemainingTotal, incomplete: debtRemainingIncomplete } = totalDebtRemainingDetail(
    debts.filter((d) => !isOwedToUser(d)),
    debtPayments,
    settings.baseCurrency,
    exchangeRates,
    goldPricePerGram,
    goldOk,
    expenses
  )

  // Cash that actually left the account this month — the flow side of net worth.
  // Distinct from `totalSpentExcludingSavings` (consumption), which every budget/pace
  // figure below must keep using. See calculateCashOutflow for why they differ.
  const cashOutflow = calculateCashOutflow({
    monthExpenses: monthlyExpenses,
    monthDebtPayments: filterDebtPaymentsByMonth(debtPayments, monthFilter, settings.monthStartDay),
    debts,
    monthSavingsDeposits: cashSavingsDepositsInBaseForMonth(
      savingsTransactions,
      monthFilter,
      settings.monthStartDay,
      settings.baseCurrency,
      exchangeRates,
      { pricePerGram: goldPricePerGram, available: goldOk }
    ),
    baseCurrency: settings.baseCurrency,
    exchangeRates,
  })

  const elapsed = daysElapsedInMonth(monthFilter, settings.monthStartDay)
  const totalDays = totalDaysInMonth(monthFilter, settings.monthStartDay)
  const dailyRate = dailySpendingRate(totalSpentForExpenseBudget, elapsed)
  const projectedSpend = projectedMonthSpend(dailyRate, totalDays)
  const paceStatus = spendingPaceStatus(projectedSpend, totalExpenseBudget)
  const suggestedDaily = suggestedDailyBudget(remaining, daysLeft)

  const catIcons = Object.fromEntries(
    effectiveBudgetRows.map((b) => [b.category, b.icon ?? ''])
  ) as Record<string, string>
  const overBudgetCategories = topOverspentCategories(
    categorySpending,
    categoryBudgetCaps,
    elapsed,
    totalDays,
    catIcons,
  )

  return {
    monthlyExpenses,
    totalIncome,
    totalSpent,
    totalSpentExcludingSavings: totalSpentForExpenseBudget,
    totalBudget,
    totalExpenseBudget,
    remaining,
    budgetUsedPercent,
    categorySpending,
    spendingByEnum,
    unassignedSpendByCategory,
    unassignedSpendTotal,
    /** Rows for CategoryBar caps/labels (active plan or legacy `budgetCategories`). */
    dashboardBudgetCategories: effectiveBudgetRows,
    daysLeft,
    savingsTotal,
    savingsHoldingsTotal,
    savingsAccountsTotal,
    savingsFromExpenses,
    netSavingsTransfersThisMonth,
    monthClosed,
    projectedMonthSavings,
    realizedMonthSavings,
    savingsThisMonth,
    leftToSpend,
    categoryBudgetCaps,
    debtRemainingTotal,
    /** True when an owed gold debt is left out of the total because gold has no live price. */
    debtRemainingIncomplete,
    cashOutflow,
    baseCurrency: settings.baseCurrency,
    incomeBlocked,
    daysElapsed: elapsed,
    dailyRate,
    projectedSpend,
    paceStatus,
    suggestedDaily,
    overBudgetCategories,
    plannedSavingsBudget,
  }
}
