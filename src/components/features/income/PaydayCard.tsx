'use client'

import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { GripVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/IconButton'
import { SelectableCard, selectableCardVariants } from '@/components/ui/SelectableCard'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { cn } from '@/lib/utils'
import type { IncomeSourceType } from '@/lib/store/types'

export type PaydayBadgeVariant = 'positive' | 'warning' | 'brand' | 'muted'

export interface PaydayCardProps {
  type: IncomeSourceType | undefined
  name: string
  cadence: string
  /** "→ SNB •• 2231", or the ink "Paid into: not set · Set". */
  destination: string
  destinationMissing: boolean
  amount: string
  status: { variant: PaydayBadgeVariant; label: string }
  onOpen: () => void
  /** Reorder mode: grip handle instead of tap-to-open, and the lifted look while dragged. */
  reorder?: {
    dragging: boolean
    handleLabel: string
    onHandlePointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void
    onHandleKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => void
  }
}

/** One payday stream on Paydays: type chip, name, cadence, destination, expected amount, one status. */
export function PaydayCard({ type, name, cadence, destination, destinationMissing, amount, status, onOpen, reorder }: PaydayCardProps) {
  const body = (
    <span className="flex w-full min-w-0 items-center gap-3 text-start">
      {reorder ? (
        <IconButton
          variant="ghost"
          size="sm"
          aria-label={reorder.handleLabel}
          className="w-7 shrink-0 cursor-grab touch-none text-[var(--color-brand-text-muted)] active:cursor-grabbing"
          onPointerDown={reorder.onHandlePointerDown}
          onKeyDown={reorder.onHandleKeyDown}
        >
          <GripVertical className="size-[18px]" strokeWidth={2} />
        </IconButton>
      ) : null}
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">
        <IncomeTypeIcon type={type} className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{name}</span>
        <span className="text-[0.78125rem] text-[var(--color-brand-text-secondary)]">{cadence}</span>
        <span
          className={cn(
            'text-[0.78125rem]',
            destinationMissing ? 'font-semibold text-[var(--color-brand-primary-ink)]' : 'text-[var(--color-brand-text-secondary)]',
          )}
        >
          {destination}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-[5px]">
        <span className="font-mono-numbers text-[0.90625rem] font-semibold text-[var(--color-brand-text-primary)]">{amount}</span>
        <Badge variant={status.variant} size="xs">
          {status.label}
        </Badge>
      </span>
    </span>
  )

  return (
    <div
      className="rounded-2xl transition-transform duration-[180ms] ease-out"
      style={
        reorder?.dragging
          ? { transform: 'translateY(-4px) scale(1.02)', boxShadow: 'var(--shadow-lg)', position: 'relative', zIndex: 2 }
          : undefined
      }
    >
      {reorder ? (
        // Not a button while reordering: the grip is the only control, and a button can't hold one.
        <div className={selectableCardVariants({ layout: 'row', surface: 'card' })}>{body}</div>
      ) : (
        <SelectableCard as="action" surface="card" layout="row" onClick={onOpen}>
          {body}
        </SelectableCard>
      )}
    </div>
  )
}
