'use client'

import type { RowModel } from '@/lib/subscriptions/subscriptionRows'
import { useSubscriptionDates } from '@/hooks/useSubscriptionDates'
import { useT } from '@/lib/i18n'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import { BrandTile } from './BrandTile'
import { StatusChip } from './StatusChip'
import { chipLabel, noteLabel, rowAmount, TRACKING_ICON } from './subscriptionLabels'

/**
 * One subscription: logo, name (+ plan), next date, tracking icon, one status chip, amount.
 * Everything else (split, cost per use, sharing detail) waits for the detail sheet.
 */
export function SubscriptionRow({ row, onOpen }: { row: RowModel; onOpen: () => void }) {
  const t = useT()
  const { shortDate: formatDateShort } = useSubscriptionDates()
  const { sub } = row
  const Track = TRACKING_ICON[sub.tracking ?? 'sms']
  return (
    <button
      type="button"
      onClick={onOpen}
      data-raw-button-ok="a whole list row is the tap target"
      className="flex min-h-16 w-full items-center gap-3 px-3.5 py-2.5 text-start outline-none focus-visible:bg-[var(--color-brand-elevated)]"
    >
      <BrandTile brandKey={sub.brandKey} name={sub.name} size={40} />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">
          {sub.name}
          {sub.planName ? (
            <span className="font-normal text-[var(--color-brand-text-secondary)]"> · {sub.planName}</span>
          ) : null}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-brand-text-secondary)]">
          <span className="shrink-0 whitespace-nowrap font-mono-numbers">{row.date ? formatDateShort(row.date) : '—'}</span>
          <Track className="size-3 shrink-0 text-[var(--color-brand-text-muted)]" strokeWidth={1.75} aria-hidden />
          <StatusChip tone={row.chip.tone} icon={row.chip.icon}>
            {chipLabel(row.chip, t.subscriptions.ui, formatDateShort)}
          </StatusChip>
        </span>
      </span>
      <span className="flex shrink-0 flex-col gap-0.5 text-end">
        <span
          className={cn(
            'font-mono-numbers text-[15px] font-semibold',
            row.struck
              ? 'text-[var(--color-brand-text-muted)] line-through'
              : 'text-[var(--color-brand-text-primary)]',
          )}
        >
          {rowAmount(row.amount, row.approx)}
        </span>
        {row.note ? (
          <span className="font-mono-numbers text-[11px] text-[var(--color-brand-text-secondary)]">
            {noteLabel(row.note, t.subscriptions.ui, formatCurrency)}
          </span>
        ) : null}
      </span>
    </button>
  )
}
