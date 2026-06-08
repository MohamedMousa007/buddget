'use client'
import Link from 'next/link'
import { useSmsMiniActivity } from '@/hooks/useSmsMiniActivity'
import { KIND_TO_BADGE, SMS_BADGES } from '@/lib/sms/transactionTypes'
import type { SmsTransactionType } from '@/lib/sms/transactionTypes'

export function SmsActivityMini() {
  const items = useSmsMiniActivity()
  if (!items.length) return null

  return (
    <div className="rounded-2xl bg-[var(--color-brand-elevated)] px-3 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-muted)]">
          ⚡ Auto-tracked today
        </p>
        <Link
          href="/settings"
          className="text-[10px] text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-secondary)]"
        >
          View all
        </Link>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const badgeKey = item.kind ? (KIND_TO_BADGE[item.kind] as SmsTransactionType) : null
          const badge = badgeKey ? SMS_BADGES[badgeKey] : null
          const label = item.clean_title ?? item.merchant ?? 'Bank transaction'

          return (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {badge && (
                  <span className="shrink-0 text-sm">{badge.icon}</span>
                )}
                <span className="text-xs text-[var(--color-brand-text-primary)] truncate">
                  {label}
                </span>
              </div>
              {item.amount != null && (
                <span className="shrink-0 text-xs font-mono text-[var(--color-brand-text-secondary)]">
                  {item.currency} {item.amount.toLocaleString()}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
