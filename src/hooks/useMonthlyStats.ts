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
} from '@/lib/budget/budgetPlans'
import {
  filterExpensesByMonth,
  calculateMonthlyIncome,
  calculateTotalSpent,
  calculateTotalSpentExcludingSavings,
  calculateCategorySpending,
  calculateTotalBudget,
  calculateTotalBudgetExcludingSavings,
  calculateBudgetUsedPercent,
  calculateDaysLeftInMonth,
  totalSavingsHoldingsInBase,
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

function filterBySharedScope<T extends { sharedPlanId?: string | null }>(
  items: T[],
  activeSharedBudgetId: string | null
): T[] {
  if (activeSharedBudgetId) {
    return items.filter((x) => x.sharedPlanId === activeSharedBudgetId)
  }
  return items.filter((x) => !x.sharedPlanId)
}

function supabaseAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  )
}

export function useMonthlyStats() {
  const { session } = useAuth()
  const trustLocalFinance = !supabaseAuthConfigured() || session != null

  const {
    expenses,
    incomeSources,
    budgetCategories,
    budgetPlans,
    activeBudgetPlanId,
    activeSharedBudgetId,
    savingsHoldings,
    debts,
    debtPayments,
    settings,
    exchangeRates,
    goldPricePerGram,
  } = useFinanceStore(
    useShallow((s) => ({
      expenses: s.expenses,
      incomeSources: s.incomeSources,
      budgetCategories: s.budgetCategories,
      budgetPlans: s.budgetPlans,
      activeBudgetPlanId: s.activeBudgetPlanId,
      activeSharedBudgetId: s.activeSharedBudgetId,
      savingsHoldings: s.savingsHoldings,
      debts: s.debts,
      debtPayments: s.debtPayments,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
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
        savingsFromExpenses: 0,
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
      }
    }
    const scopedExpenses = filterBySharedScope(expenses, activeSharedBudgetId)
    const scopedIncome = filterBySharedScope(incomeSources, activeSharedBudgetId)
    const scopedDebts = filterBySharedScope(debts, activeSharedBudgetId)
    const debtIdSet = new Set(scopedDebts.map((d) => d.id))
    const scopedDebtPayments = debtPayments.filter((p) => debtIdSet.has(p.debtId))

    const monthlyExpenses = filterExpensesByMonth(scopedExpenses, monthFilter, settings.monthStartDay)
    const rawMonthlyIncome = calculateMonthlyIncome(
      scopedIncome,
      settings.baseCurrency,
      exchangeRates
    )
    const incomeBlocked =
      settings.noIncomeDeclared === true && scopedIncome.length === 0
    const totalIncome = incomeBlocked ? 0 : rawMonthlyIncome
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
      : calculateTotalBudget(budgetCategories, settings, totalIncome)
    const totalExpenseBudget = activePlan
      ? totalExpenseBudgetFromPlan(activePlan, settings.baseCurrency, exchangeRates)
      : calculateTotalBudgetExcludingSavings(budgetCategories, settings, totalIncome)
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

    const savingsFromExpenses = monthlyExpenses
      .filter((e) => e.category === 'Savings')
      .reduce((sum, e) => sum + expenseAmountInBase(e, settings.baseCurrency, exchangeRates), 0)

    const savingsHoldingsTotal = totalSavingsHoldingsInBase(
      savingsHoldings,
      settings.baseCurrency,
      exchangeRates
    )

    const savingsTotal = savingsHoldingsTotal + savingsFromExpenses

    const effectiveBudgetRows = planForCategoryBar
      ? budgetCategoriesFromPlan(planForCategoryBar, settings.baseCurrency, exchangeRates)
      : []
    const categoryBudgetCaps = Object.fromEntries(
      effectiveBudgetRows.map((b) => [
        b.category,
        planForCategoryBar ? b.budgetedAmount : effectiveCategoryBudget(b, settings, totalIncome),
      ])
    ) as Record<string, number>

    const debtRemainingTotal = totalDebtRemainingInBase(
      scopedDebts,
      scopedDebtPayments,
      settings.baseCurrency,
      exchangeRates,
      goldPricePerGram
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
      savingsFromExpenses,
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
    }
  }, [
    expenses,
    incomeSources,
    budgetCategories,
    budgetPlans,
    activeBudgetPlanId,
    activeSharedBudgetId,
    savingsHoldings,
    debts,
    debtPayments,
    settings,
    exchangeRates,
    goldPricePerGram,
    monthFilter,
    trustLocalFinance,
  ])
}

export const INCOME_BLOCKED_HINT =
  'Add at least one income source under Income for these totals to update.'
