'use client'

import type { Goal } from '@/lib/store/types'
import type { Dictionary } from '@/lib/i18n/types'
import { formatCurrency } from '@/lib/utils/formatters'

type Props = {
  goal: Goal
  t: Dictionary['goals']
  currentAmount: number
  avgMonthlySpendBase: number
  debtRemainingDisplay: number | null
}

export function GoalCardMetaRows({
  goal,
  t,
  currentAmount,
  avgMonthlySpendBase,
  debtRemainingDisplay,
}: Props) {
  if (goal.category === 'emergency_fund' && avgMonthlySpendBase > 0.01) {
    const months = currentAmount / avgMonthlySpendBase
    return (
      <p className="text-xs text-[var(--color-brand-text-muted)]">
        ≈ {months.toFixed(1)} {t.monthsOfExpenses}
      </p>
    )
  }

  if (goal.category === 'debt_freedom' && debtRemainingDisplay !== null) {
    return (
      <p className="text-xs text-[var(--color-brand-text-muted)]">
        {t.debtRemaining}: {formatCurrency(debtRemainingDisplay, goal.currency)}
      </p>
    )
  }

  if (goal.category === 'spending_control' && goal.monthlySpendingLimit) {
    return (
      <p className="text-xs text-[var(--color-brand-text-muted)]">
        {formatCurrency(currentAmount, goal.currency)} / {formatCurrency(goal.monthlySpendingLimit, goal.currency)}{' '}
        {t.thisMonth}
      </p>
    )
  }

  return null
}
