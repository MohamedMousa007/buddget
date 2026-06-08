'use client'
import { CheckCircle, X } from 'lucide-react'
import { useSmsConfirmations } from '@/hooks/useSmsConfirmations'
import { SMS_BADGES, KIND_TO_BADGE } from '@/lib/sms/transactionTypes'
import type { SmsTransactionType } from '@/lib/sms/transactionTypes'

export function SmsPendingConfirmationsBanner() {
  const { pending, confirmItem, dismissItem } = useSmsConfirmations()

  if (!pending.length) return null

  return (
    <div className="space-y-2">
      {pending.map((item) => {
        const badgeKey = item.kind ? (KIND_TO_BADGE[item.kind] as SmsTransactionType) : null
        const badge = badgeKey ? SMS_BADGES[badgeKey] : null
        const title = item.clean_title ?? item.merchant ?? 'Bank transaction'
        const formattedAmount = item.amount != null
          ? `${item.currency ?? ''} ${item.amount.toLocaleString()}`
          : null

        return (
          <div
            key={item.id}
            className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {badge && (
                  <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.color}`}>
                    {badge.icon} {badge.label}
                  </span>
                )}
                <p className="text-xs font-medium text-[var(--color-brand-text-primary)] truncate">
                  {title}
                  {formattedAmount && (
                    <span className="ml-1.5 font-mono text-[var(--color-brand-text-secondary)]">
                      {formattedAmount}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void dismissItem(item.id)}
                className="shrink-0 text-[var(--color-brand-text-muted)]"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {item.bank_name && (
              <p className="mt-0.5 text-[10px] text-[var(--color-brand-text-muted)]">
                {item.bank_name}
                {item.account_last4 ? ` ••••${item.account_last4}` : ''}
              </p>
            )}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void confirmItem(item.id)}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-green)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-brand-green)]"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Add Expense
              </button>
              <button
                type="button"
                onClick={() => void dismissItem(item.id)}
                className="rounded-xl px-3 py-1.5 text-xs text-[var(--color-brand-text-muted)]"
              >
                Dismiss
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
