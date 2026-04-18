'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useGoalProgress } from '@/hooks/useGoalProgress'
import { paletteFromString } from '@/components/dashboard/categoryVisuals'
import type { Goal } from '@/lib/store/types'

const MAX_CHIPS = 8

/**
 * Horizontal-scroll strip of active goals. Each chip shows an initial-letter
 * tile (pastel tinted via `paletteFromString` so colors are stable per-goal),
 * the goal name, percent, and a thin 48px progress bar.
 */
export function DashboardGoalsStrip() {
  const goals = useFinanceStore(useShallow((s) => s.goals))

  const active = useMemo(
    () =>
      goals
        .filter((g) => g.status === 'active')
        .sort((a, b) => a.priority - b.priority)
        .slice(0, MAX_CHIPS),
    [goals],
  )

  if (active.length === 0) return null

  return (
    <div
      className="flex gap-2 overflow-x-auto overflow-y-visible pb-1 snap-x snap-mandatory scrollbar-none"
      style={{ scrollbarWidth: 'none' }}
    >
      {active.map((goal) => (
        <GoalChip key={goal.id} goal={goal} />
      ))}
    </div>
  )
}

function GoalChip({ goal }: { goal: Goal }) {
  const { percent } = useGoalProgress(goal)
  const palette = paletteFromString(goal.id)
  const pct = Math.max(0, Math.min(100, Math.round(percent ?? 0)))
  const initial = (goal.name || '?').charAt(0).toUpperCase()
  const short = goal.name.length > 16 ? `${goal.name.slice(0, 14)}…` : goal.name

  return (
    <Link
      href="/goals"
      className="shrink-0 snap-start rounded-xl bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] px-3 py-2 flex items-center gap-2 min-w-[152px] hover:bg-[var(--color-brand-elevated)] transition-colors"
    >
      <span
        aria-hidden
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-semibold shrink-0"
        style={{ background: palette.bg, color: palette.text }}
      >
        {initial}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-medium text-[var(--color-brand-text-primary)] truncate">
            {short}
          </span>
          <span className="text-[10px] text-[var(--color-brand-text-secondary)]">{pct}%</span>
        </div>
        <div className="mt-1 h-[3px] w-12 rounded-full bg-[var(--color-brand-elevated)] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: palette.text }}
          />
        </div>
      </div>
    </Link>
  )
}
