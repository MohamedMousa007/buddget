'use client'

import { useMemo } from 'react'
import { AppLink as Link } from '@/components/ui/AppLink'
import { useShallow } from 'zustand/react/shallow'
import { Target } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useGoalProgress } from '@/hooks/useGoalProgress'
import { useT } from '@/lib/i18n'
import type { Goal } from '@/lib/store/types'

/**
 * Profile page card: active / achieved counts and next milestone link to /goals.
 */
export function ProfileGoalsSummary() {
  const t = useT()
  const goals = useFinanceStore(useShallow((s) => s.goals))
  const { activeCount, achievedThisYear, next } = useMemo(() => {
    const y = new Date().getFullYear()
    const active = goals.filter((g) => g.status === 'active' || g.status === 'paused')
    const achieved = goals.filter((g) => {
      if (g.status !== 'achieved' || !g.achievedAt) return false
      return g.achievedAt.slice(0, 4) === String(y)
    })
    const sorted = [...active].sort((a, b) => a.priority - b.priority)
    return {
      activeCount: active.length,
      achievedThisYear: achieved.length,
      next: sorted[0],
    }
  }, [goals])

  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-brand-text-primary)] flex items-center gap-2">
            <Target className="w-4 h-4 text-[var(--color-brand-red)]" aria-hidden />
            {t.goals.pageTitle}
          </h2>
          <p className="text-xs text-[var(--color-brand-text-muted)] mt-1">
            {t.goals.profileSummaryLine(activeCount, achievedThisYear)}
          </p>
          {next ? <NextMilestone goal={next} /> : null}
        </div>
        <Link
          href="/goals"
          className="text-xs shrink-0 text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]"
        >
          {t.goals.manage} →
        </Link>
      </div>
    </div>
  )
}

function NextMilestone({ goal }: { goal: Goal }) {
  const t = useT()
  const { percent } = useGoalProgress(goal)
  return (
    <p className="text-xs text-[var(--color-brand-text-secondary)] mt-2">
      {t.goals.nextMilestone}: {goal.name}
      {percent !== null ? ` (${percent}%)` : null}
    </p>
  )
}
