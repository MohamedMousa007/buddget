'use client'

import { useState } from 'react'
import type { Goal } from '@/lib/store/types'
import type { Dictionary } from '@/lib/i18n/types'
import { useGoalProgress } from '@/hooks/useGoalProgress'
import { useAverageMonthlySpendBase } from '@/hooks/useAverageMonthlySpendBase'
import { useDebtRemainingForGoal } from '@/hooks/useDebtRemainingForGoal'
import { formatCurrency } from '@/lib/utils/formatters'
import { GoalCardMetaRows } from '@/components/features/goals/GoalCardMetaRows'
import { GoalCardTop } from '@/components/features/goals/GoalCardTop'
import { GoalCardFooter } from '@/components/features/goals/GoalCardFooter'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'

export type GoalCardProps = {
  goal: Goal
  t: Dictionary['goals']
  onEdit: (g: Goal) => void
  onDelete: (id: string) => void
  compact?: boolean
}

export function GoalCard({ goal, t, onEdit, onDelete, compact }: GoalCardProps) {
  const [open, setOpen] = useState(false)
  const { currentAmount, percent, monthsRemaining } = useGoalProgress(goal)
  const avgMonthlySpendBase = useAverageMonthlySpendBase()
  const debtRemainingDisplay = useDebtRemainingForGoal(goal)
  const pct = percent ?? 0
  const confirm = useConfirm()

  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]/90 backdrop-blur-sm p-4 transition-shadow',
        compact ? 'p-3' : ''
      )}
    >
      <GoalCardTop
        goal={goal}
        t={t}
        compact={compact}
        percent={percent}
        monthsRemaining={monthsRemaining}
        pct={pct}
        open={open}
        onToggleOpen={() => setOpen((o) => !o)}
        onEdit={() => onEdit(goal)}
        onDelete={async () => {
          if (await confirm({ title: t.confirmDelete, destructive: true })) onDelete(goal.id)
        }}
      />

      {!compact && goal.category !== 'spending_control' ? (
        <p className="text-sm text-[var(--color-brand-text-secondary)] mt-2">
          {formatCurrency(currentAmount, goal.currency)}
          {goal.targetAmount !== null ? (
            <>
              {' '}
              / {formatCurrency(goal.targetAmount, goal.currency)}
            </>
          ) : null}
        </p>
      ) : null}

      <GoalCardMetaRows
        goal={goal}
        t={t}
        currentAmount={currentAmount}
        avgMonthlySpendBase={avgMonthlySpendBase}
        debtRemainingDisplay={debtRemainingDisplay}
      />

      <GoalCardFooter goal={goal} t={t} compact={compact} open={open} />
    </div>
  )
}
