'use client'

import { SubscriptionBrandIcon } from '@/components/features/subscriptions/SubscriptionBrandIcon'
import { Badge } from '@/components/ui/badge'
import type { SubscriptionBrand } from '@/lib/constants/subscriptionCatalog'
import type { Dictionary } from '@/lib/i18n/types'
import type { Subscription } from '@/lib/store/types'

export function SubscriptionCardInfo({
  sub,
  brand,
  pmLabel,
  paidThisCycle,
  formatDateShort,
  t,
}: {
  sub: Subscription
  brand: SubscriptionBrand | undefined
  pmLabel: string
  /** This cycle's charge has landed — derived from linked expenses, never from the date. */
  paidThisCycle?: boolean
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
            <Badge variant="muted" size="xs">{t.trial}</Badge>
          ) : null}
          {sub.status === 'paused' ? (
            <Badge variant="muted" size="xs">{t.paused}</Badge>
          ) : null}
          {paidThisCycle ? (
            <Badge variant="positive" size="xs">{t.paidThisCycle}</Badge>
          ) : null}
        </div>
        <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5 truncate">
          {line2} · {pmLabel}
        </p>
      </div>
    </>
  )
}
