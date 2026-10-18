'use client'

import { Clock, TrendingUp } from 'lucide-react'
import { useSubscriptionDates } from '@/hooks/useSubscriptionDates'
import { useT } from '@/lib/i18n'
import { money2 } from '@/lib/subscriptions/subscriptionFormat'
import type { Insight, StripDay } from '@/lib/subscriptions/subscriptionNudges'
import { cn } from '@/lib/utils'
import { signedPct } from './subscriptionLabels'

const LABEL = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]'

/** Desktop rail: the 30-day strip, then at most two insight cards. */
export function SubscriptionsRail({ strip, insights }: { strip: StripDay[]; insights: Insight[] }) {
  const t = useT()
  const ui = t.subscriptions.ui.rail
  const { shortDate: formatDateShort } = useSubscriptionDates()
  return (
    <aside className="hidden w-[22rem] shrink-0 flex-col gap-4 border-s border-[var(--color-brand-border)] ps-8 lg:flex">
      <h2 className={LABEL}>{ui.next30}</h2>
      <div className="grid grid-cols-10 gap-1.5">
        {strip.map((d) => (
          <div
            key={d.date.toISOString()}
            className={cn(
              'flex h-11 flex-col items-center justify-center gap-1 rounded-[10px]',
              d.isToday && 'bg-[var(--color-brand-primary-soft)] font-bold',
            )}
          >
            <span className="font-mono-numbers text-[11px] text-[var(--color-brand-text-primary)]">{d.date.getDate()}</span>
            <span
              className={cn('size-[5px] rounded-full', d.due ? 'bg-[var(--color-brand-primary-bright)]' : 'bg-transparent')}
            />
          </div>
        ))}
      </div>
      {insights.map((i) => {
        const Icon = i.kind === 'price' ? TrendingUp : Clock
        const { sub } = i.row
        const name = sub.planName ? `${sub.name} ${sub.planName}` : sub.name
        return (
          <div
            key={`${i.kind}-${sub.id}`}
            className="flex flex-col gap-1.5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3.5 shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-brand-text-secondary)]">
              <Icon className="size-4 text-[var(--color-brand-primary-bright)]" strokeWidth={1.75} aria-hidden />
              {i.kind === 'price' ? ui.priceChange : ui.trialEnding}
            </div>
            <div className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{name}</div>
            <div className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">
              {i.kind === 'price' && i.row.priceChange
                ? ui.priceMove(money2(i.row.priceChange.from), money2(i.row.priceChange.to), signedPct(i.row.priceChange.pct))
                : ui.trialThen(
                    sub.trialEnd ? formatDateShort(sub.trialEnd.slice(0, 10)) : '',
                    money2(i.kind === 'trial' ? i.amount : sub.amount),
                  )}
            </div>
          </div>
        )
      })}
    </aside>
  )
}
