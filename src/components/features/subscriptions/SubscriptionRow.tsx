'use client'

import { TransactionRow } from '@/components/transactions/TransactionRow'
import { useSubscriptionDates } from '@/hooks/useSubscriptionDates'
import { useT } from '@/lib/i18n'
import type { RowModel } from '@/lib/subscriptions/subscriptionRows'
import { formatCurrency } from '@/lib/utils/formatters'
import { BrandTile } from './BrandTile'
import { StatusChip } from './StatusChip'
import { chipLabel, noteLabel, rowAmount, TRACKING_ICON } from './subscriptionLabels'

/**
 * One subscription as a shared `TransactionRow`: logo in the icon slot, name (+ plan) as the
 * title, date + tracking icon + one status chip as the subtitle, amount with its note beneath.
 * Everything else (split, cost per use, sharing detail) waits for the detail sheet.
 */
export function SubscriptionRow({ row, onOpen }: { row: RowModel; onOpen: () => void }) {
  const t = useT()
  const { shortDate } = useSubscriptionDates()
  const { sub } = row
  const Track = TRACKING_ICON[sub.tracking ?? 'sms']
  return (
    <TransactionRow
      icon={<BrandTile brandKey={sub.brandKey} name={sub.name} size={40} />}
      iconBg="transparent"
      onClick={onOpen}
      title={
        <>
          {sub.name}
          {sub.planName ? <span className="font-normal text-[var(--color-brand-text-secondary)]"> · {sub.planName}</span> : null}
        </>
      }
      subtitle={
        <>
          <span className="shrink-0">{row.date ? shortDate(row.date) : '—'}</span>
          <Track className="mx-1.5 size-3 shrink-0" strokeWidth={1.75} aria-hidden />
          <StatusChip tone={row.chip.tone} icon={row.chip.icon}>
            {chipLabel(row.chip, t.subscriptions.ui, shortDate)}
          </StatusChip>
        </>
      }
      amount={<span className={row.struck ? 'line-through' : undefined}>{rowAmount(row.amount, row.approx)}</span>}
      amountColor={row.struck ? 'var(--color-brand-text-muted)' : undefined}
      sub={row.note ? noteLabel(row.note, t.subscriptions.ui, formatCurrency) : undefined}
    />
  )
}
