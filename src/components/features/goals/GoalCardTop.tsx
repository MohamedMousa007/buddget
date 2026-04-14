'use client'

import { Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Goal } from '@/lib/store/types'
import type { Dictionary } from '@/lib/i18n/types'
import { GoalProgressBar } from '@/components/features/goals/GoalProgressBar'

type Props = {
  goal: Goal
  t: Dictionary['goals']
  compact?: boolean
  percent: number | null
  monthsRemaining: number | null
  pct: number
  open: boolean
  onToggleOpen: () => void
  onEdit: () => void
  onDelete: () => void
}

export function GoalCardTop({
  goal,
  t,
  compact,
  percent,
  monthsRemaining,
  pct,
  open,
  onToggleOpen,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="flex items-start justify-between gap-2">
      <button type="button" onClick={onToggleOpen} className="flex-1 text-start min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xl shrink-0" aria-hidden>
            {goal.emoji}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[var(--color-brand-text-primary)] truncate">{goal.name}</span>
              {goal.status === 'achieved' ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {t.achieved}
                </span>
              ) : null}
            </div>
            {!compact && goal.status === 'active' ? (
              <div className="mt-2">
                <GoalProgressBar percent={percent} />
                <div className="flex justify-between mt-1 text-xs text-[var(--color-brand-text-secondary)]">
                  <span>{pct}%</span>
                  {monthsRemaining !== null ? (
                    <span>
                      ~{monthsRemaining} {t.monthsRemaining}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {compact ? (
              <div className="mt-2">
                <GoalProgressBar percent={percent} thin />
              </div>
            ) : null}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="p-2 rounded-lg hover:bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]"
          aria-label={t.editGoal}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 rounded-lg hover:bg-[var(--color-brand-elevated)] text-[var(--color-brand-red)]"
          aria-label={t.deleteGoal}
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onToggleOpen}
          className="p-2 rounded-lg hover:bg-[var(--color-brand-elevated)] lg:hidden"
          aria-expanded={open}
        >
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
