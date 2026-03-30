'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
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

export function useMonthlyStats() {
  const {
    expenses,
    incomeSources,
    budgetCategories,
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
    const monthlyExpenses = filterExpensesByMonth(expenses, monthFilter, settings.monthStartDay)
    const rawMonthlyIncome = calculateMonthlyIncome(
      incomeSources,
      settings.baseCurrency,
      exchangeRates
    )
    const incomeBlocked =
      settings.noIncomeDeclared === true && incomeSources.length === 0
    const totalIncome = incomeBlocked ? 0 : rawMonthlyIncome
    const totalSpent = calculateTotalSpent(monthlyExpenses, settings.baseCurrency, exchangeRates)
    const totalSpentForExpenseBudget = calculateTotalSpentExcludingSavings(
      monthlyExpenses,
      settings.baseCurrency,
      exchangeRates
    )
    const totalBudget = calculateTotalBudget(budgetCategories, settings, totalIncome)
    const totalExpenseBudget = calculateTotalBudgetExcludingSavings(
      budgetCategories,
      settings,
      totalIncome
    )
    const remaining = totalExpenseBudget - totalSpentForExpenseBudget
    const budgetUsedPercent = calculateBudgetUsedPercent(totalSpentForExpenseBudget, totalExpenseBudget)
    const categorySpending = calculateCategorySpending(
      monthlyExpenses,
      settings.baseCurrency,
      exchangeRates
    )
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

    const categoryBudgetCaps = Object.fromEntries(
      budgetCategories.map((b) => [
        b.category,
        effectiveCategoryBudget(b, settings, totalIncome),
      ])
    ) as Record<string, number>

    const debtRemainingTotal = totalDebtRemainingInBase(
      debts,
      debtPayments,
      settings.baseCurrency,
      exchangeRates,
      goldPricePerGram
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
      daysLeft,
      savingsTotal,
      savingsHoldingsTotal,
      savingsFromExpenses,
      categoryBudgetCaps,
      debtRemainingTotal,
      baseCurrency: settings.baseCurrency,
      incomeBlocked,
    }
  }, [
    expenses,
    incomeSources,
    budgetCategories,
    savingsHoldings,
    debts,
    debtPayments,
    settings,
    exchangeRates,
    goldPricePerGram,
    monthFilter,
  ])
}

export const INCOME_BLOCKED_HINT =
  'Add at least one income source under Income for these totals to update.'
