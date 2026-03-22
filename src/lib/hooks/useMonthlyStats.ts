'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import {
  filterExpensesByMonth,
  calculateMonthlyIncome,
  calculateTotalSpent,
  calculateCategorySpending,
  calculateTotalBudget,
  calculateBudgetUsedPercent,
  calculateDaysLeftInMonth,
  totalSavingsHoldingsInBase,
  effectiveCategoryBudget,
  totalDebtRemainingInBase,
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
    const totalIncome = calculateMonthlyIncome(
      incomeSources,
      settings.baseCurrency,
      exchangeRates
    )
    const totalSpent = calculateTotalSpent(monthlyExpenses)
    const totalBudget = calculateTotalBudget(budgetCategories, settings, totalIncome)
    const remaining = totalBudget - totalSpent
    const budgetUsedPercent = calculateBudgetUsedPercent(totalSpent, totalBudget)
    const categorySpending = calculateCategorySpending(monthlyExpenses)
    const daysLeft = calculateDaysLeftInMonth(monthFilter, settings.monthStartDay)

    const savingsFromExpenses = monthlyExpenses
      .filter((e) => e.category === 'Savings')
      .reduce((sum, e) => sum + e.amountInBaseCurrency, 0)

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
      totalBudget,
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
