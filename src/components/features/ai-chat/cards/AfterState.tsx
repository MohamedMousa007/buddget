'use client'

import { AlertCircle, Check, Clock, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProposalState } from '@/lib/buddgy/client/chatTypes'
import { useBuddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'
import { useBuddgyChatCopy } from '@/lib/i18n/buddgyChatCopy'
import { cn } from '@/lib/utils'

const LOOK = {
  applied: { tint: 'bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]', Icon: Check },
  undone: { tint: 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]', Icon: Undo2 },
  dismissed: { tint: 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]', Icon: Clock },
  stale: { tint: 'bg-[var(--color-brand-amber-soft)] text-[var(--color-brand-amber)]', Icon: Clock },
  failed: { tint: 'bg-[var(--color-brand-red-soft)] text-[var(--color-brand-red)]', Icon: AlertCircle },
} as const

export interface AfterStateProps {
  state: ProposalState
  onUndo: () => void
  /** Only a card that could not apply offers Try again; the apply re-checks, so nothing doubles. */
  onRetry?: () => void
}

/** What became of a card, on one line: Done with Undo, Undone, Skipped, Out of date, or Couldn't apply with Try again. */
export function AfterState({ state, onUndo, onRetry }: AfterStateProps) {
  const chat = useBuddgyChatCopy()
  const copy = useBuddgyCardCopy()
  const { status } = state
  if (status === 'pending') return null
  const { tint, Icon } = LOOK[status]
  const sub =
    status === 'applied' ? state.message
    : status === 'failed' ? state.message || copy.after.failed
    : status === 'stale' ? state.proposal.preview.title
    : copy.after[status]
  return (
    <div role="status" className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] py-1.5 pe-1.5 ps-3 text-[0.84375rem] leading-snug">
      <span aria-hidden className={cn('flex size-[30px] shrink-0 items-center justify-center rounded-full', tint)}>
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-[var(--color-brand-text-primary)]">{chat.statuses[status]}</span>
        {sub ? <span dir="auto" className="truncate text-[0.78125rem] text-[var(--color-brand-text-secondary)]">{sub}</span> : null}
      </span>
      {status === 'applied' && state.undo ? (
        <Button variant="ghost" size="touch" onClick={onUndo} className="shrink-0 px-3">
          <Undo2 aria-hidden />
          {chat.undo}
        </Button>
      ) : null}
      {status === 'failed' && onRetry ? (
        <Button variant="ghost" size="touch" onClick={onRetry} className="shrink-0 px-3">
          {copy.after.tryAgain}
        </Button>
      ) : null}
    </div>
  )
}
