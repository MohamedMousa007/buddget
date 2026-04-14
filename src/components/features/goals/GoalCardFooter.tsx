'use client'

import type { Goal } from '@/lib/store/types'
import type { Dictionary } from '@/lib/i18n/types'
import { cn } from '@/lib/utils'

type Props = {
  goal: Goal
  t: Dictionary['goals']
  compact?: boolean
  open: boolean
}

export function GoalCardFooter({ goal, t, compact, open }: Props) {
  if (!(open || !compact)) return null
  return (
    <div
      className={cn(
        'mt-3 text-xs text-[var(--color-brand-text-muted)] space-y-1',
        compact ? 'hidden' : ''
      )}
    >
      {goal.linkedSavingsAccountIds.length > 0 ? (
        <p>
          {t.linkedAccounts}: {goal.linkedSavingsAccountIds.length}
        </p>
      ) : null}
      {goal.notes ? <p className="whitespace-pre-wrap">{goal.notes}</p> : null}
    </div>
  )
}
