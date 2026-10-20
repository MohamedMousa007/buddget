'use client'

import { AppLink } from '@/components/ui/AppLink'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useGoalProgress } from '@/hooks/useGoalProgress'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Goal, GoalCategory } from '@/lib/store/types'

function GoalLensLine({ goal }: { goal: Goal }) {
  const { currentAmount, percent } = useGoalProgress(goal)
  const target = goal.category === 'spending_control' ? goal.monthlySpendingLimit : goal.targetAmount
  return (
    <AppLink
      href="/goals"
      className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 text-sm"
    >
      <span aria-hidden>{goal.emoji}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-brand-text-primary)]">{goal.name}</span>
      <span className="shrink-0 text-xs text-[var(--color-brand-text-secondary)] font-mono-numbers">
        {target ? `${formatCurrency(currentAmount, goal.currency, false)} / ${formatCurrency(target, goal.currency, false)}` : ''}
        {percent !== null ? ` · ${percent}%` : ''}
      </span>
    </AppLink>
  )
}

/**
 * One-line "lens" onto the /goals list for goals of the given categories. The list itself
 * lives only on /goals; Budget shows spending limits, Debts shows debt-freedom goals.
 */
export function GoalLensList({ categories }: { categories: GoalCategory[] }) {
  const goals = useFinanceStore((s) => s.goals)
  const shown = goals.filter((g) => g.status === 'active' && categories.includes(g.category))
  if (shown.length === 0) return null
  return (
    <div className="space-y-2">
      {shown.map((g) => (
        <GoalLensLine key={g.id} goal={g} />
      ))}
    </div>
  )
}
