'use client'

import { format } from 'date-fns'
import { BAND_FG2, BAND_MIX, BandScale, HeroBand } from '@/components/features/hero/HeroBand'
import { useSubscriptionDates } from '@/hooks/useSubscriptionDates'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import type { HeroNumbers } from '@/lib/subscriptions/subscriptionForecast'
import { formatFlex } from '@/lib/utils/formatters'

/**
 * Subscriptions' hero, the shared `HeroBand` drawn as a rounded card (Light touch `page-subs`): what subscriptions cost a
 * month, paid vs still due this month, then one line with the next charge and the yearly total.
 */
export function SubscriptionsHero({ hero, base, loading }: { hero: HeroNumbers | null; base: string; loading: boolean }) {
  const c = useDebtsSubsLtCopy().subs.hero
  const { shortDate } = useSubscriptionDates()
  const blank = loading || !hero
  const dash = '—'
  const total = blank ? 0 : hero.paid + hero.left
  const pct = total > 0 && hero ? Math.min(100, (hero.paid / total) * 100) : 0
  const next = !blank && hero.next ? c.next(hero.next.sub.name, shortDate(format(hero.next.due, 'yyyy-MM-dd'))) : ''
  const year = !blank && hero.perYear > 0 ? c.aYear(formatFlex(hero.perYear)) : ''

  return (
    <HeroBand
      label={c.label}
      contained
      numbers={
        <p className="flex min-w-0 items-baseline gap-1.5">
          <span className="font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.03em]">{blank ? dash : formatFlex(hero.monthlyEquivalent)}</span>
          <span className={`min-w-0 truncate whitespace-nowrap text-[0.8125rem] ${BAND_FG2}`}>{base} {c.aMonth}</span>
        </p>
      }
      bar={
        <>
          <div className="h-1.5 rounded-full" style={{ background: BAND_MIX }}>
            <div className="h-full rounded-full bg-[var(--flow-band-fg)]" style={{ width: `${pct}%` }} />
          </div>
          <BandScale>
            <span dir="auto" className="min-w-0 truncate whitespace-nowrap">{c.paid(blank ? '0' : formatFlex(hero.paid))}</span>
            <span dir="auto" className="min-w-0 shrink-0 truncate whitespace-nowrap">{c.due(blank ? '0' : formatFlex(hero.left))}</span>
          </BandScale>
        </>
      }
      note={next || year ? (
        <span dir="auto">
          {next ? <b className="font-semibold text-[var(--flow-band-fg)]">{next}</b> : null}
          {next && year ? '  ' : ''}
          {year}
        </span>
      ) : dash}
    />
  )
}
