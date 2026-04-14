'use client'

import { SubscriptionBrandIcon } from '@/components/features/subscriptions/SubscriptionBrandIcon'
import type { SubscriptionBrand } from '@/lib/constants/subscriptionCatalog'
import type { Dictionary } from '@/lib/i18n/types'
import type { Subscription } from '@/lib/store/types'

export function SubscriptionCardInfo({
  sub,
  brand,
  pmLabel,
  formatDateShort,
  t,
}: {
  sub: Subscription
  brand: SubscriptionBrand | undefined
  pmLabel: string
  formatDateShort: (dateStr: string) => string
  t: Dictionary['subscriptions']
}) {
  const line2 =
    sub.status === 'cancelled' && sub.cancelledAt
      ? `${t.cancelledOn} ${formatDateShort(sub.cancelledAt.slice(0, 10))}`
      : sub.nextBillingDate
        ? `${t.renewsOn} ${formatDateShort(sub.nextBillingDate)}`
        : '—'

  return (
    <>
      <SubscriptionBrandIcon
        brandKey={sub.brandKey}
        color={brand?.color ?? '#64748b'}
        emoji={brand?.emoji ?? '📋'}
        initial={brand?.initial ?? sub.name.slice(0, 2)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--color-brand-text-primary)] truncate">
            {sub.name}
            {sub.planName ? (
              <span className="text-[var(--color-brand-text-muted)] font-normal"> · {sub.planName}</span>
            ) : null}
          </span>
          {sub.status === 'trial' ? (
            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)]">
              {t.trial}
            </span>
          ) : null}
          {sub.status === 'paused' ? (
            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)]">
              {t.paused}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5 truncate">
          {line2} · {pmLabel}
        </p>
      </div>
    </>
  )
}
