'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { countedDebtPayments, countedDebts } from '@/lib/spending/exclusion'
import { buildGoalProgressContext, computeGoalProgress } from '@/lib/goals/computeGoalProgress'
import { withDebtDerived } from '@/lib/goals/debtGoal'
import type { Goal } from '@/lib/store/types'

/**
 * Live progress for a single goal: computed amount, percent toward target, and ETA months.
 */
export function useGoalProgress(stored: Goal) {
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const slice = useFinanceStore(
    useShallow((s) => ({
      savingsAccounts: s.savingsAccounts,
      debts: s.debts,
      debtPayments: s.debtPayments,
      expenses: s.expenses,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
      goldPriceAvailable: s.goldPriceAvailable,
      settings: s.settings,
      paymentMethods: s.paymentMethods,
    }))
  )

  return useMemo(() => {
    const ctx = buildGoalProgressContext(
      { ...slice, debts: countedDebts(slice.debts, slice.paymentMethods), debtPayments: countedDebtPayments(slice.debtPayments, slice.debts, slice.paymentMethods) },
      monthFilter,
    )
    const currentAmount = computeGoalProgress(stored, ctx)
    const goal = withDebtDerived(stored, ctx)

    if (goal.category === 'spending_control' && goal.monthlySpendingLimit && goal.monthlySpendingLimit > 0) {
      const pct = Math.min(
        100,
        Math.round((currentAmount / goal.monthlySpendingLimit) * 100)
      )
      return {
        currentAmount,
        percent: pct,
        monthsRemaining: null as number | null,
      }
    }

    const percent =
      goal.targetAmount !== null && goal.targetAmount > 0
        ? Math.min(100, Math.round((currentAmount / goal.targetAmount) * 100))
        : null

    const monthsRemaining =
      goal.monthlyContribution &&
      goal.monthlyContribution > 0 &&
      goal.targetAmount !== null &&
      goal.targetAmount > 0
        ? Math.max(0, Math.ceil((goal.targetAmount - currentAmount) / goal.monthlyContribution))
        : null

    return { currentAmount, percent, monthsRemaining }
  }, [stored, slice, monthFilter])
}
