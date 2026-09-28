'use client'

import { Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Goal } from '@/lib/store/types'
import type { Dictionary } from '@/lib/i18n/types'
import { GoalProgressBar } from '@/components/features/goals/GoalProgressBar'
import { Badge } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/IconButton'

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
      <button type="button" onClick={onToggleOpen} aria-expanded={open} className="flex-1 text-start min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xl shrink-0" aria-hidden>
            {goal.emoji}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[var(--color-brand-text-primary)] truncate">{goal.name}</span>
              {goal.status === 'achieved' ? (
                <Badge variant="positive" size="xs">{t.achieved}</Badge>
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
        <IconButton onClick={onEdit} aria-label={t.editGoal}>
          <Pencil className="size-4" />
        </IconButton>
        <IconButton variant="danger" onClick={onDelete} aria-label={t.deleteGoal}>
          <Trash2 className="size-4" />
        </IconButton>
        <IconButton
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-label={open ? t.collapse : t.expand}
          className="lg:hidden"
        >
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </IconButton>
      </div>
    </div>
  )
}
