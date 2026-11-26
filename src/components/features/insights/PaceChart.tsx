'use client'

import { addDays } from 'date-fns'
import { ChartDataTable } from '@/components/reports/ChartDataTable'
import { useLocale } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useInsightsLtCopy } from '@/lib/i18n/insightsLtCopy'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { formatWhole } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import { ChartBox, useChartTip } from './ChartTip'
import { InsightsSection } from './InsightsParts'

interface Props {
  /** Running total from the cycle's start (index 0 = 0), one per elapsed day. */
  cumulative: number[]
  totalDays: number
  /** The cycle's first day, for the date labels. */
  start: Date
  /** 0 when there is no budget: the plan line is left out. */
  budget: number
  /** Where the cycle ends at this pace; null while it is too early to say. */
  projected: number | null
}

const W = 320
const H = 118
/** Below this share of the width, two axis labels would touch: the edge label gives way to "Today". */
const LABEL_GAP = 0.18

/** Cumulative spend against the plan line, today marked, the rest projected. One axis (days); tap or hover for the day's figures. */
export function PaceChart({ cumulative, totalDays, start, budget, projected }: Props) {
  const c = useInsightsLtCopy().pace
  const { locale } = useLocale()
  const hidden = useMask('lists')
  const money = (n: number) => (hidden ? MASK : formatWhole(n))
  const chart = useChartTip()
  const today = Math.max(0, cumulative.length - 1)
  const spent = cumulative[today] ?? 0
  const heading = projected !== null && today < totalDays ? projected : null
  const top = Math.max(budget, heading ?? 0, spent, 1) * 1.1
  const x = (d: number) => 8 + (d / totalDays) * (W - 16)
  const y = (v: number) => H - 4 - (v / top) * (H - 16)
  const pct = (px: number) => `${(px / W) * 100}%`
  const todayAt = x(today) / W
  const showStart = today === 0 || todayAt - 8 / W > LABEL_GAP
  const showEnd = today === 0 || (W - 8) / W - todayAt > LABEL_GAP
  const day = (d: number) => formatLocalized(addDays(start, Math.max(0, d - 1)), 'MMM d', locale)
  const planAt = (d: number) => (budget > 0 ? (budget * d) / totalDays : null)
  const valueAt = (d: number) => (d <= today ? cumulative[d] : heading !== null ? spent + ((heading - spent) * (d - today)) / (totalDays - today) : null)
  const path = cumulative.map((v, d) => `${d ? 'L' : 'M'}${x(d).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')

  return (
    <InsightsSection
      title={c.title}
      right={
        heading !== null ? (
          <span className="text-end">
            <b className="block font-mono-numbers text-[0.9375rem] text-[var(--color-brand-text-primary)]">≈ {money(heading)}</b>
            <span className="text-xs text-[var(--color-brand-text-muted)]">{c.by(day(totalDays))}</span>
          </span>
        ) : null
      }
    >
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-brand-text-secondary)]">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 rounded bg-[var(--color-brand-primary)]" />{c.legend.you}</span>
        {budget > 0 ? <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0 w-4 border-t-2 border-dashed border-[var(--color-brand-text-muted)]" />{c.legend.plan}</span> : null}
        {heading !== null ? <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0 w-4 border-t-2 border-dotted border-[var(--color-brand-amber)]" />{c.legend.heading}</span> : null}
      </div>
      <ChartBox tip={chart.tip} boxRef={chart.setBox} onLeave={chart.hide} className="mt-3">
        {/* Text lives in HTML, not the scaled SVG, so it stays 10px however wide the chart is. */}
        <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={c.aria} direction="ltr">
          <line x1="8" x2={W - 8} y1={y(0)} y2={y(0)} stroke="var(--color-brand-border)" strokeWidth="1" />
          {budget > 0 ? (
            <>
              <line x1="8" x2={W - 8} y1={y(budget)} y2={y(budget)} stroke="var(--color-brand-border-strong)" strokeWidth="1" strokeDasharray="3 3" />
              <path d={`M${x(0)} ${y(0)} L${x(totalDays)} ${y(budget)}`} fill="none" stroke="var(--color-brand-text-muted)" strokeWidth="1.5" strokeDasharray="4 4" />
            </>
          ) : null}
          <path d={`${path} L${x(today)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="var(--color-brand-primary)" opacity=".1" />
          <path d={path} fill="none" stroke="var(--color-brand-primary)" strokeWidth="2" strokeLinejoin="round" />
          {heading !== null ? (
            <path d={`M${x(today)} ${y(spent)} L${x(totalDays)} ${y(heading)}`} fill="none" stroke="var(--color-brand-amber)" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
          ) : null}
          <circle cx={x(today)} cy={y(spent)} r="4.5" fill="var(--color-brand-primary)" stroke="var(--color-brand-card)" strokeWidth="2" />
          {Array.from({ length: totalDays }, (_, i) => {
            const d = i + 1
            const v = valueAt(d)
            if (v === null) return null
            const plan = planAt(d)
            return (
              <rect
                key={d}
                x={x(d) - (W - 16) / totalDays / 2}
                y="0"
                width={(W - 16) / totalDays}
                height={H}
                fill="transparent"
                {...chart.bind(c.tip(day(d), d <= today, money(v), plan === null ? null : money(plan)))}
              />
            )
          })}
        </svg>
        {budget > 0 ? (
          <span
            className="pointer-events-none absolute -translate-y-full font-mono-numbers text-[0.625rem] leading-none text-[var(--color-brand-text-muted)]"
            style={{ right: pct(8), top: `calc(${(y(budget) / H) * 100}% - 3px)` }}
          >
            {c.budget(money(budget))}
          </span>
        ) : null}
        </div>
        <div dir="ltr" aria-hidden className="relative mt-1 h-3.5 text-[0.625rem] leading-[0.875rem] text-[var(--color-brand-text-muted)]">
          {showStart ? <span className="absolute" style={{ left: pct(8) }}>{day(1)}</span> : null}
          {today > 0 ? (
            <span
              className={cn('absolute whitespace-nowrap font-semibold text-[var(--color-brand-text-secondary)]', showStart && showEnd && '-translate-x-1/2')}
              style={!showStart ? { left: pct(8) } : !showEnd ? { right: pct(8) } : { left: pct(x(today)) }}
            >
              {c.today}
            </span>
          ) : null}
          {showEnd ? <span className="absolute" style={{ right: pct(8) }}>{day(totalDays)}</span> : null}
        </div>
      </ChartBox>
      <ChartDataTable
        caption={c.aria}
        headers={c.headers}
        rows={cumulative.slice(1).map((v, i) => {
          const plan = planAt(i + 1)
          return [day(i + 1), money(v), plan === null ? '—' : money(plan)]
        })}
      />
    </InsightsSection>
  )
}
