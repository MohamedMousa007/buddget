'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { buildGoalProgressContext, computeGoalProgress } from '@/lib/goals/computeGoalProgress'
import type { Goal } from '@/lib/store/types'

/**
 * Live progress for a single goal: computed amount, percent toward target, and ETA months.
 */
export function useGoalProgress(goal: Goal) {
  const { monthFilter } = useSettingsStore()
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
    }))
  )

  return useMemo(() => {
    const ctx = buildGoalProgressContext(slice, monthFilter)
    const currentAmount = computeGoalProgress(goal, ctx)

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
  }, [goal, slice, monthFilter])
}
