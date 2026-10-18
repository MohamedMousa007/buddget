'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useGoalAllocationRuns } from '@/hooks/useGoalAllocationRuns'
import { buildGoalProgressContext, computeGoalProgress } from '@/lib/goals/computeGoalProgress'
import { withDebtDerived } from '@/lib/goals/debtGoal'
import { getGoalStatus, type GoalStatusView } from '@/lib/goals/goalStatus'
import type { Goal } from '@/lib/store/types'

export interface GoalRow {
  goal: Goal
  current: number
  /** 0-100, rounded; limit goals are spent / limit. */
  percent: number
  status: GoalStatusView
}

const ATTENTION = new Set(['over', 'due', 'behind'])

/** Every goal with live progress and its single status, sorted needs-attention first then by target date. */
export function useGoalRows(): GoalRow[] {
  const { monthFilter } = useSettingsStore()
  const runs = useGoalAllocationRuns()
  const slice = useFinanceStore(
    useShallow((s) => ({
      goals: s.goals,
      savingsAccounts: s.savingsAccounts,
      debts: s.debts,
      debtPayments: s.debtPayments,
      expenses: s.expenses,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
      goldPriceAvailable: s.goldPriceAvailable,
      settings: s.settings,
    })),
  )
  return useMemo(() => {
    const ctx = buildGoalProgressContext(slice, monthFilter)
    const now = new Date()
    const rows = slice.goals.map((stored): GoalRow => {
      const goal = withDebtDerived(stored, ctx)
      const current = computeGoalProgress(stored, ctx)
      const basis = goal.category === 'spending_control' ? goal.monthlySpendingLimit : goal.targetAmount
      const percent = basis && basis > 0 ? Math.min(100, Math.round((current / basis) * 100)) : 0
      return { goal, current, percent, status: getGoalStatus({ goal, current, runs: runs[goal.id] ?? [], now }) }
    })
    return rows.sort((a, b) => {
      const A = ATTENTION.has(a.status.kind)
      const B = ATTENTION.has(b.status.kind)
      if (A !== B) return A ? -1 : 1
      return (a.goal.targetDate ?? '9999').localeCompare(b.goal.targetDate ?? '9999')
    })
  }, [slice, monthFilter, runs])
}
