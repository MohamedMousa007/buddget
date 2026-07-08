'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import {
  budgetCategoriesFromPlan,
  categorySpendingForPlanRows,
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
  calculateDaysLeftInMonth,
  totalSavingsHoldingsInBase,
  totalSavingsAccountsBalanceInBase,
  netSavingsLedgerInBaseForMonth,
  calculateLeftToSpendCashFlow,
  effectiveCategoryBudget,
  totalDebtRemainingInBase,
  expenseAmountInBase,
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
import { isSupabaseConfigured } from '@/lib/supabase/env'

/** YYYY-MM string for the current calendar month (UTC-local-aligned). */
function currentMonthString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function supabaseAuthConfigured(): boolean {
  return Boolean(
    isSupabaseConfigured()
  )
}

export function useMonthlyStats() {
  const { session } = useAuth()
  const trustLocalFinance = !supabaseAuthConfigured() || session != null

  const {
    expenses,
    incomeSources,
    incomeEvents,
    budgetCategories,
    budgetPlans,
    activeBudgetPlanId,
    savingsHoldings,
    savingsAccounts,
    savingsTransactions,
    debts,
    debtPayments,
    settings,
    exchangeRates,
    goldPricePerGram,
    goldPriceAvailable,
  } = useFinanceStore(
    useShallow((s) => ({
      expenses: s.expenses,
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      budgetCategories: s.budgetCategories,
      budgetPlans: s.budgetPlans,
      activeBudgetPlanId: s.activeBudgetPlanId,
      savingsHoldings: s.savingsHoldings,
      savingsAccounts: s.savingsAccounts,
      savingsTransactions: s.savingsTransactions,
      debts: s.debts,
      debtPayments: s.debtPayments,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
      goldPriceAvailable: s.goldPriceAvailable,
    }))
  )

  const { monthFilter } = useSettingsStore()

  return useMemo(() => {
    if (!trustLocalFinance) {
      const daysLeft = calculateDaysLeftInMonth(monthFilter, settings.monthStartDay)
      return {
        monthlyExpenses: [],
        totalIncome: 0,
        totalSpent: 0,
        totalSpentExcludingSavings: 0,
        totalBudget: 0,
        totalExpenseBudget: 0,
        remaining: 0,
        budgetUsedPercent: 0,
        categorySpending: {} as ReturnType<typeof calculateCategorySpending>,
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
    const activePlan =
      budgetPlans.length > 0
        ? budgetPlans.find((p) => p.id === activeBudgetPlanId) ?? budgetPlans[0]
        : null
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
    const categorySpending = planForCategoryBar
      ? categorySpendingForPlanRows(spendingByEnum, planForCategoryBar)
      : spendingByEnum
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
      exchangeRates
    )

    // Month-scoped savings semantics. While the user is inside the
    // current cycle the dashboard shows what they're *projected* to save
    // based on the active plan (income − planned expense budget). Once
    // the cycle has closed (a past `monthFilter`), we surface what they
    // *actually* saved (income − actual spend). Both clamp at zero so a
    // shortfall reads as zero saved rather than a negative figure.
    const monthClosed = monthFilter < currentMonthString()
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

    const debtRemainingTotal = totalDebtRemainingInBase(
      debts,
      debtPayments,
      settings.baseCurrency,
      exchangeRates,
      goldPricePerGram,
      goldOk,
      expenses
    )

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
  }, [
    expenses,
    incomeSources,
    incomeEvents,
    budgetCategories,
    budgetPlans,
    activeBudgetPlanId,
    savingsHoldings,
    savingsAccounts,
    savingsTransactions,
    debts,
    debtPayments,
    settings,
    exchangeRates,
    goldPricePerGram,
    goldPriceAvailable,
    monthFilter,
    trustLocalFinance,
  ])
}

export const INCOME_BLOCKED_HINT =
  'Add at least one income source under Income for these totals to update.'
