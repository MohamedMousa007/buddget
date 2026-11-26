'use client'

import { addMonths } from 'date-fns'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useLocale } from '@/lib/i18n'
import { formatLocalized, weekdayNames } from '@/lib/i18n/dateFormat'
import { useInsightsLtCopy } from '@/lib/i18n/insightsLtCopy'
import type { Insight, InsightInput } from '@/lib/insights/types'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { cn } from '@/lib/utils'
import { formatCompact, formatWhole } from '@/lib/utils/formatters'
import { ChartBox, useChartTip } from './ChartTip'
import { LockedSection } from './InsightsParts'

/** The week as it runs in Egypt and the Gulf: Saturday first. */
const WEEK = [6, 0, 1, 2, 3, 4, 5]

function WeekBars({ byDay, peak, money }: { byDay: number[]; peak: number; money: (n: number) => string }) {
  const c = useInsightsLtCopy().patterns
  const { locale } = useLocale()
  const names = weekdayNames(locale, 'narrow')
  const long = weekdayNames(locale)
  const max = Math.max(...byDay, 1)
  const chart = useChartTip()
  return (
    <ChartBox tip={chart.tip} boxRef={chart.setBox} onLeave={chart.hide}>
      <div dir="ltr" className="mt-3 flex h-14 items-end gap-1.5" role="img" aria-label={c.weekAria}>
        {WEEK.map((d) => (
          <span key={d} className="flex h-full flex-1 flex-col justify-end" {...chart.bind(`${long[d]} · ${c.avg(money(byDay[d]))}`)}>
            <span className={cn('block rounded-t-[3px]', d === peak ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-sunken)]')} style={{ height: `${(byDay[d] / max) * 100}%` }} />
          </span>
        ))}
      </div>
      <div dir="ltr" className="mt-1 flex gap-1.5">
        {WEEK.map((d) => <span key={d} className="flex-1 text-center text-[0.625rem] font-semibold text-[var(--color-brand-text-muted)]">{names[d]}</span>)}
      </div>
    </ChartBox>
  )
}

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const x = (i: number) => 4 + (i * 130) / Math.max(1, values.length - 1)
  const y = (v: number) => 44 - ((v - lo) / span) * 38
  const p = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const last = values.length - 1
  return (
    <svg viewBox="0 0 138 48" className="mt-2 h-12 w-full" role="img" aria-label={label} direction="ltr">
      <path d={`${p} L${x(last)} 48 L${x(0)} 48 Z`} fill="var(--color-brand-green)" opacity=".12" />
      <path d={p} fill="none" stroke="var(--color-brand-green)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(last)} cy={y(values[last])} r="3.5" fill="var(--color-brand-green)" />
    </svg>
  )
}

interface Props {
  input: InsightInput
  insights: Insight[]
  locked: boolean
  onLocked: () => void
}

/** Pro: the most expensive weekday and where net worth is heading. Free sees the section locked, with no figures behind it. */
export function PatternsSection({ input, insights, locked, onLocked }: Props) {
  const c = useInsightsLtCopy().patterns
  const { locale } = useLocale()
  const hidden = useMask('lists')
  const money = (n: number) => (hidden ? MASK : formatWhole(n))
  if (locked) {
    const teaser = (
      <div className="grid grid-cols-2 gap-3">
        <div className="flex h-14 items-end gap-1.5">
          {[40, 35, 30, 32, 45, 90, 65].map((h, i) => <span key={i} className="flex-1 rounded-t-[3px] bg-[var(--color-brand-sunken)]" style={{ height: `${h}%` }} />)}
        </div>
        <div className="h-14 rounded-xl bg-[var(--color-brand-elevated)]" />
      </div>
    )
    return <LockedSection title={c.title} what={c.lockedWhat} teaser={teaser} onUnlock={onLocked} />
  }

  const big = insights.find((f) => f.kind === 'weekdayPattern')
  const day = big ? Number(big.params.day) : null
  const nw = input.netWorthPath
  const values = nw?.values ?? []
  const now = values.at(-1) ?? null
  const prev = values.length > 1 ? values[values.length - 2] : null
  const change = now !== null && prev !== null && prev !== 0 ? Math.round(((now - prev) / Math.abs(prev)) * 1000) / 10 : null
  const Trend = change !== null && change < 0 ? TrendingDown : TrendingUp

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card padding="md" render={<section />}>
        <p className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{c.bigDay}</p>
        {day !== null ? (
          <>
            <p className="mt-1 text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{weekdayNames(locale)[day]}</p>
            <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{c.avg(money(Number(big?.params.avg ?? 0)))}</p>
            <WeekBars byDay={input.weekday.byDay} peak={day} money={money} />
          </>
        ) : (
          <p className="mt-1 text-xs text-[var(--color-brand-text-muted)]">{c.bigDayNone}</p>
        )}
      </Card>
      <Card padding="md" render={<section />}>
        <p className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{c.nw}</p>
        {nw && now !== null ? (
          <>
            <p className="mt-1 font-mono-numbers text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{money(now)}</p>
            <p className={cn('inline-flex flex-wrap items-center gap-1 font-mono-numbers text-xs font-semibold', change !== null && change < 0 ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-green)]')}>
              <Trend aria-hidden className="size-3.5" />
              {change !== null ? `${Math.abs(change)}% · ` : ''}
              {c.nwBy(hidden ? MASK : formatCompact(nw.projected, locale), formatLocalized(addMonths(new Date(), 12), 'MMM yyyy', locale))}
            </p>
            {values.length > 1 ? <Sparkline values={values} label={c.nwAria} /> : null}
          </>
        ) : (
          <p className="mt-1 text-xs text-[var(--color-brand-text-muted)]">{c.nwNone}</p>
        )}
      </Card>
    </div>
  )
}
