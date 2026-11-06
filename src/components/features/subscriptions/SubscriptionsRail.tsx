'use client'

import { Clock, TrendingUp } from 'lucide-react'
import { useSubscriptionDates } from '@/hooks/useSubscriptionDates'
import { useT } from '@/lib/i18n'
import { microClassName } from '@/lib/ui/microLabelStyle'
import type { Insight, StripDay } from '@/lib/subscriptions/subscriptionNudges'
import { cn } from '@/lib/utils'
import { signedPct } from './subscriptionLabels'
import { formatFixed2 } from '@/lib/utils/formatters'

/** Desktop rail: the 30-day strip, then at most two insight cards. */
export function SubscriptionsRail({ strip, insights }: { strip: StripDay[]; insights: Insight[] }) {
  const t = useT()
  const ui = t.subscriptions.ui.rail
  const { shortDate: formatDateShort } = useSubscriptionDates()
  return (
    <div className="hidden flex-col gap-4 lg:flex">
      <h2 className={microClassName}>{ui.next30}</h2>
      <div className="grid grid-cols-10 gap-1.5">
        {strip.map((d) => (
          <div
            key={d.date.toISOString()}
            className={cn(
              'flex h-11 flex-col items-center justify-center gap-1 rounded-[10px]',
              d.isToday && 'bg-[var(--color-brand-primary-soft)] font-bold',
            )}
          >
            <span className="font-mono-numbers text-[0.6875rem] text-[var(--color-brand-text-primary)]">{d.date.getDate()}</span>
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
                ? ui.priceMove(formatFixed2(i.row.priceChange.from), formatFixed2(i.row.priceChange.to), signedPct(i.row.priceChange.pct))
                : ui.trialThen(
                    sub.trialEnd ? formatDateShort(sub.trialEnd.slice(0, 10)) : '',
                    formatFixed2(i.kind === 'trial' ? i.amount : sub.amount),
                  )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
