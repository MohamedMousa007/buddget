'use client'

import { useMemo } from 'react'
import { AppLink as Link } from '@/components/ui/AppLink'
import { useShallow } from 'zustand/react/shallow'
import { Target } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useGoalProgress } from '@/hooks/useGoalProgress'
import { GoalProgressBar } from '@/components/features/goals/GoalProgressBar'
import { useT } from '@/lib/i18n'
import type { Goal } from '@/lib/store/types'

function GoalRow({ goal }: { goal: Goal }) {
  const { percent } = useGoalProgress(goal)
  const short = goal.name.length > 22 ? `${goal.name.slice(0, 20)}…` : goal.name
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-base shrink-0" aria-hidden>
        {goal.emoji}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between gap-2 text-xs text-[var(--color-brand-text-secondary)]">
          <span className="truncate">{short}</span>
          {percent !== null ? <span>{percent}%</span> : null}
        </div>
        <GoalProgressBar percent={percent} thin className="mt-1" />
      </div>
    </div>
  )
}

/**
 * Compact dashboard strip: top active goals with thin progress bars and link to /goals.
 */
export function GoalsWidget() {
  const t = useT()
  const goals = useFinanceStore(useShallow((s) => s.goals))
  const top = useMemo(() => {
    return goals
      .filter((g) => g.status === 'active')
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3)
  }, [goals])

  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]/90 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-[var(--color-brand-text-primary)] flex items-center gap-2">
          <Target className="w-4 h-4 text-[var(--color-brand-red)]" aria-hidden />
          {t.goals.pageTitle}
        </h2>
        <Link
          href="/goals"
          className="text-xs text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]"
        >
          {t.goals.seeAll}
        </Link>
      </div>
      {top.length === 0 ? (
        <Link
          href="/goals"
          className="block text-sm text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)]"
        >
          {t.goals.dashboardEmpty}
        </Link>
      ) : (
        <div className="space-y-3">
          {top.map((g) => (
            <GoalRow key={g.id} goal={g} />
          ))}
        </div>
      )}
    </div>
  )
}
