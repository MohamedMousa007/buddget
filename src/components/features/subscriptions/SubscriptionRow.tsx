'use client'

import { TransactionRow } from '@/components/transactions/TransactionRow'
import { useSubscriptionDates } from '@/hooks/useSubscriptionDates'
import { useT } from '@/lib/i18n'
import type { RowModel } from '@/lib/subscriptions/subscriptionRows'
import { formatCurrency } from '@/lib/utils/formatters'
import { BrandTile } from './BrandTile'
import { StatusChip } from './StatusChip'
import { chipLabel, noteLabel, rowAmount } from './subscriptionLabels'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'
import type { Chip } from '@/lib/subscriptions/subscriptionRows'

/** An active plan shows no badge; only what Buddgy flagged on it (a declined charge, a new price, a plan change, a share). */
const ALERTS = new Set<Chip['key']>(['failed', 'price', 'planChanges', 'shared'])

/**
 * One subscription as a shared `TransactionRow`: logo in the icon slot, name (+ plan) as the
 * title, date · card + one status badge or alert chip as the subtitle, amount with its note beneath.
 * Everything else (split, cost per use, sharing detail) waits for the detail sheet.
 */
export function SubscriptionRow({ row, onOpen }: { row: RowModel; onOpen: () => void }) {
  const t = useT()
  const { shortDate } = useSubscriptionDates()
  const { sub } = row
  const method = useFinanceStore((s) => (sub.paymentMethodId ? s.paymentMethods.find((m) => m.id === sub.paymentMethodId) : undefined))
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
          {method ? (
            <span dir="auto" className="min-w-0 truncate">{` · ${accountTitle(method)}${method.last4 ? ` ••${method.last4}` : ''}`}</span>
          ) : null}
          {row.status !== 'active' ? (
            <SubscriptionStatusBadge status={row.status} className="ms-1.5" />
          ) : ALERTS.has(row.chip.key) ? (
            <StatusChip tone={row.chip.tone} icon={row.chip.icon}>
              {chipLabel(row.chip, t.subscriptions.ui, shortDate)}
            </StatusChip>
          ) : null}
        </>
      }
      amount={<span className={row.struck ? 'line-through' : undefined}>{rowAmount(row.amount, row.approx)}</span>}
      amountColor={row.struck ? 'var(--color-brand-text-muted)' : undefined}
      sub={row.note ? noteLabel(row.note, t.subscriptions.ui, formatCurrency) : undefined}
    />
  )
}
