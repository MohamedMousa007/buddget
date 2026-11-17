'use client'

import { MembershipPanel } from '@/components/features/membership/PointsList'
import { useLocale } from '@/lib/i18n'
import { plainDate } from '@/components/features/rewards/pageParts'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { useRewardsCopy, type RewardsCopy } from '@/lib/i18n/rewardsCopy'
import type { HistoryItem } from '@/lib/loyalty/rewardsTypes'
import { cn } from '@/lib/utils'

/** What a history row is called: the Pro period for a subscription receipt, the Sparks credited for a pack. */
export function historyLabel(item: Pick<HistoryItem, 'kind' | 'productId' | 'sparks'>, h: RewardsCopy['plan']['history']): string {
  const id = item.productId ?? ''
  if (item.kind === 'sparks') return h.sparks(item.sparks ?? Number(/^sparks_(\d+)/.exec(id)?.[1] ?? 0))
  return /annual|year/i.test(id) ? h.proYearly : h.proMonthly
}

/** "App Store" / "Google Play" for a store receipt; a grant from buddget names buddget; anything else is left blank. */
export function historySource(item: Pick<HistoryItem, 'store' | 'type'>, names: { appStore: string; playStore: string; gift: string }): string {
  if (item.type === 'ADMIN_GRANT' || item.store === 'admin') return names.gift
  return item.store === 'app_store' ? names.appStore : item.store === 'play_store' ? names.playStore : ''
}

export function historyPrice(item: Pick<HistoryItem, 'priceMicros' | 'currency'>): string {
  if (item.priceMicros === null || !item.currency) return ''
  return `${item.currency} ${(item.priceMicros / 1_000_000).toFixed(2)}`
}

/** Subscription receipts and Sparks packs in one list, newest first. A returned purchase keeps its row with the price struck through. */
export function BillingHistory({ items, limit }: { items: readonly HistoryItem[]; limit?: number }) {
  const c = useMembershipCopy()
  const h = useRewardsCopy().plan.history
  const { locale } = useLocale()
  const date = (iso: string) => plainDate(iso, locale)
  const rows = limit ? items.slice(0, limit) : items
  return (
    <MembershipPanel>
      {rows.length === 0 ? (
        <div dir="auto" className="px-4 py-3.5">
          <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{c.billing.none}</p>
          <p className="mt-0.5 text-xs text-[var(--color-brand-text-secondary)]">{c.billing.noneHint}</p>
        </div>
      ) : rows.map((item, i) => {
        const source = historySource(item, { appStore: c.plans.appStore, playStore: c.plans.playStore, gift: h.gift })
        const price = historyPrice(item)
        return (
          <div key={`${item.at}-${item.productId}-${i}`} className={cn('flex items-center justify-between gap-3 px-4 py-[13px] text-sm', i > 0 && 'border-t border-[var(--color-brand-border)]')}>
            <span dir="auto" className="min-w-0 text-[var(--color-brand-text-primary)]">
              {historyLabel(item, h)}
              <small className="block text-[0.71875rem] text-[var(--color-brand-text-muted)]">{source ? `${date(item.at)} · ${source}` : date(item.at)}</small>
            </span>
            {price ? <b dir="ltr" className={cn('font-mono-numbers shrink-0 font-semibold text-[var(--color-brand-text-primary)]', item.refundedAt && 'text-[var(--color-brand-text-muted)] line-through')}>{price}</b> : null}
          </div>
        )
      })}
    </MembershipPanel>
  )
}
