'use client'

import { HeroBand } from '@/components/features/hero/HeroBand'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import type { InsightHero, InsightInput } from '@/lib/insights/types'
import type { Currency } from '@/lib/store/types'
import { addDays } from 'date-fns'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useLocale } from '@/lib/i18n'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'

/** The one answer at the top: what can be spent per day until payday, and when the money runs out at the current pace. */
export function InsightsHero({ hero, input, currency }: { hero: InsightHero; input: InsightInput; currency: Currency }) {
  const t = useT()
  const { locale } = useLocale()
  const c = t.insights
  const hidden = useMask('hero')
  const money = (n: number) => (hidden ? MASK : formatCurrency(n, currency, false))
  const lastsOn = hero.runOutInDays === null ? null : formatLocalized(addDays(new Date(), hero.runOutInDays), 'd MMM', locale)
  const note = hero.state === 'learning' ? c.heroLearning(hero.daysMore) : hero.perDay > 0 ? (hero.state === 'tight' ? c.heroTight(hero.runOutInDays ?? 0) : c.heroNote(hero.daysLeft)) : c.heroNone
  return (
    <HeroBand
      contained
      label={c.heroLabel}
      numbers={
        <>
          <span className="font-mono-numbers text-[2rem] font-extrabold leading-none">{money(hero.perDay)}</span>
          <span className="ms-2 text-sm font-semibold opacity-80">{c.heroUnit(currency)}</span>
        </>
      }
      note={note}
      cells={[
        { label: c.cellSpent, value: money(input.spent), dir: 'out' },
        { label: c.cellPace, value: money(input.dailyRate) },
        { label: c.cellLasts, value: lastsOn ?? c.cellLastsAfter },
      ]}
    />
  )
}
