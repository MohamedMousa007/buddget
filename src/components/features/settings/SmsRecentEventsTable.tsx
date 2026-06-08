'use client'

import { useT } from '@/lib/i18n'
import { SMS_BADGES } from '@/lib/sms/transactionTypes'
import type { SmsEvent } from '@/hooks/useSmsTracking'
import type { SmsTransactionType } from '@/lib/sms/transactionTypes'
import Link from 'next/link'

interface Props {
  events: SmsEvent[]
  onUndo: (event: SmsEvent) => void
  undoingId: string | null
  undoMessage: { id: string; text: string } | null
}

/**
 * Compact list of recent SMS activity shown in Settings — merges the iOS/webhook
 * (`sms_events`) and Android AI (`sms_parse_log`) pipelines. Successful rows show
 * a badge + amount + optional Undo; failed/skipped rows show a diagnostic message
 * with a support-readable code chip.
 */
export function SmsRecentEventsTable({ events, onUndo, undoingId, undoMessage }: Props) {
  const t = useT()

  if (!events.length) {
    return (
      <p className="text-xs text-[var(--color-brand-text-muted)] italic">{t.smsTracking.recentEmpty}</p>
    )
  }

  return (
    <ul className="space-y-2">
      {events
        .filter((ev) => ev.parsed_ok) // User app shows only successful transactions
        .map((ev) => {
        const badge = ev.badge_key ? SMS_BADGES[ev.badge_key as SmsTransactionType] : null
        const canUndo =
          ev.source === 'event'
            ? !!ev.expense_id && !!ev.undo_expires_at && new Date(ev.undo_expires_at) > new Date()
            : !!(ev.expense_id || ev.income_id)
        const msg = undoMessage?.id === ev.id ? undoMessage.text : null
        const label = ev.clean_title ?? ev.merchant

        return (
          <li
            key={`${ev.source}-${ev.id}`}
            className="flex items-start gap-3 rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2.5"
          >
            {badge && (
              <span className={`shrink-0 mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${badge.color}`}>
                {badge.icon} {badge.label}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--color-brand-text-primary)] truncate">
                {ev.currency} {ev.amount?.toLocaleString()}
                {label ? ` · ${label}` : ''}
              </p>
              <p className="text-[10px] text-[var(--color-brand-text-muted)]">
                {ev.bank_name ? `${ev.bank_name} · ` : ''}{new Date(ev.received_at).toLocaleString()}
              </p>
              {msg && (
                <p className={`text-[10px] mt-0.5 ${msg === 'expired' ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-green)]'}`}>
                  {msg === 'expired' ? t.smsTracking.recentUndoExpired : t.smsTracking.recentUndoSuccess}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {ev.expense_id && (
                <Link
                  href={`/expenses?highlight=${ev.expense_id}`}
                  className="text-[10px] text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] transition-colors"
                >
                  {t.smsTracking.recentViewExpense}
                </Link>
              )}
              {canUndo && (
                <button
                  type="button"
                  onClick={() => onUndo(ev)}
                  disabled={undoingId === ev.id}
                  className="text-[10px] text-[var(--color-brand-red)] hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  {undoingId === ev.id ? '…' : t.smsTracking.recentUndo}
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
