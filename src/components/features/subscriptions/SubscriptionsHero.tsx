'use client'

import { format } from 'date-fns'
import { BAND_FG2, BAND_MIX, BandScale, HeroBand, type HeroBandCell } from '@/components/features/hero/HeroBand'
import { useSubscriptionDates } from '@/hooks/useSubscriptionDates'
import { useT } from '@/lib/i18n'
import type { HeroNumbers } from '@/lib/subscriptions/subscriptionForecast'
import { money0, money2 } from '@/lib/subscriptions/subscriptionFormat'

/**
 * Subscriptions' hero is the shared `HeroBand` (Flow, Wealth and Debts use it too), so its
 * size and rhythm are theirs. Only the content is ours: due in 30 days, paid vs left, and
 * the monthly / yearly / next-charge strip. Same height while loading, empty or populated.
 */
export function SubscriptionsHero({ hero, base, loading }: { hero: HeroNumbers | null; base: string; loading: boolean }) {
  const t = useT()
  const ui = t.subscriptions.ui.hero
  const { shortDate } = useSubscriptionDates()
  const blank = loading || !hero
  const empty = !blank && hero.monthlyEquivalent === 0 && hero.due30 === 0
  const dash = '—'
  const total = blank ? 0 : hero.paid + hero.left
  const pct = total > 0 && hero ? Math.min(100, (hero.paid / total) * 100) : 0

  const cells: [HeroBandCell, HeroBandCell, HeroBandCell] = [
    { label: ui.monthlyEquivalent, value: blank || empty ? dash : money0(hero.monthlyEquivalent) },
    { label: ui.perYear, value: blank || empty ? dash : money0(hero.perYear) },
    {
      label: ui.nextCharge,
      value: blank || !hero.next ? dash : shortDate(format(hero.next.due, 'yyyy-MM-dd')),
    },
  ]

  return (
    <HeroBand
      label={ui.label}
      numbers={
        <p className="flex min-w-0 items-baseline gap-1.5">
          <span className="font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.03em]">
            {blank ? dash : money2(hero.due30)}
          </span>
          <span className={`min-w-0 truncate whitespace-nowrap text-[13px] ${BAND_FG2}`}>{base}</span>
        </p>
      }
      bar={
        <>
          <div className="h-1.5 rounded-full" style={{ background: BAND_MIX }}>
            <div className="h-full rounded-full bg-[var(--flow-band-fg)]" style={{ width: `${pct}%` }} />
          </div>
          <BandScale>
            <span className="min-w-0 truncate whitespace-nowrap">{ui.paid(blank ? '0' : money0(hero.paid))}</span>
            <span className="min-w-0 shrink-0 truncate whitespace-nowrap">{ui.left(blank ? '0' : money0(hero.left))}</span>
          </BandScale>
        </>
      }
      cells={cells}
    />
  )
}
