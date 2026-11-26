'use client'

import { useState } from 'react'
import { parseISO } from 'date-fns'
import { Sparkles } from 'lucide-react'
import { OptionChip } from '@/components/ui/OptionChip'
import { ChartDataTable } from '@/components/reports/ChartDataTable'
import { useLocale } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useInsightsLtCopy } from '@/lib/i18n/insightsLtCopy'
import { monthsStory } from '@/lib/insights/charts'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { cn } from '@/lib/utils'
import { formatWhole } from '@/lib/utils/formatters'
import { ChartBox, useChartTip } from './ChartTip'
import { Emphasis, InsightsSection } from './InsightsParts'

interface Props {
  /** Oldest first; the last is the running cycle. */
  months: { key: string; spent: number; received: number }[]
  /** Cycles in this calendar year (the Year view). */
  yearKeys: readonly string[]
  budget: number
  /** Free: the Year chip opens the locked sheet instead. */
  yearLocked: boolean
  onLocked: () => void
}

/** Six cycles (or the year) as bars against today's budget line, with one sentence about how they went. */
export function MonthByMonth({ months, yearKeys, budget, yearLocked, onLocked }: Props) {
  const c = useInsightsLtCopy().months
  const { locale } = useLocale()
  const hidden = useMask('lists')
  const money = (n: number) => (hidden ? MASK : formatWhole(n))
  const chart = useChartTip()
  const [year, setYear] = useState(false)
  const yearOn = year && !yearLocked
  const shown = yearOn ? months.filter((m) => yearKeys.includes(m.key)) : months.slice(-6)
  const label = (key: string, long = false) => formatLocalized(parseISO(`${key}-01`), long ? 'MMMM' : 'MMM', locale)
  const top = Math.max(budget, ...shown.map((m) => m.spent), 1) * 1.1
  const { story, keptPct } = monthsStory(shown, budget)
  const sentence = story
    ? story.kind === 'overThenUnder' ? c.overThenUnder(label(shown[story.index].key, true), money(story.by))
      : story.kind === 'lastOver' ? c.lastOver(label(shown[story.index].key, true), money(story.by))
      : c.allUnder
    : null
  const kept = keptPct === null || hidden ? '' : c.kept(keptPct)

  return (
    <InsightsSection
      title={c.title}
      right={
        <span className="inline-flex gap-1">
          <OptionChip size="sm" surface="card" selected={!yearOn} onClick={() => setYear(false)}>{c.six}</OptionChip>
          <OptionChip size="sm" surface="card" selected={yearOn} onClick={() => (yearLocked ? onLocked() : setYear(true))}>
            {c.year}
            {yearLocked ? <Sparkles aria-hidden className="size-3 text-[var(--color-brand-gold)]" /> : null}
          </OptionChip>
        </span>
      }
    >
      <ChartBox tip={chart.tip} boxRef={chart.setBox} onLeave={chart.hide} className="mt-4">
        <div dir="ltr" className="relative flex h-[128px] items-end gap-3 border-b border-[var(--color-brand-border)] px-1" role="img" aria-label={c.aria}>
          {budget > 0 ? (
            <span aria-hidden className="absolute inset-x-0 border-t border-dashed border-[var(--color-brand-border-strong)]" style={{ bottom: `${(budget / top) * 100}%` }} />
          ) : null}
          {shown.map((m, i) => {
            const current = i === shown.length - 1 && m.key === months[months.length - 1].key
            const over = budget > 0 && m.spent > budget
            return (
              <span key={m.key} className="flex h-full flex-1 flex-col items-center justify-end" {...chart.bind(c.tip(label(m.key), money(m.spent), current ? 'soFar' : over ? 'over' : 'under'))}>
                <span
                  className={cn(
                    'block w-full max-w-7 rounded-t-[4px]',
                    current ? 'bg-[var(--color-brand-primary)]' : over ? 'bg-[var(--color-brand-amber)]' : 'bg-[color-mix(in_oklab,var(--color-brand-primary)_45%,var(--color-brand-card))]',
                  )}
                  style={{ height: `${(m.spent / top) * 100}%` }}
                />
              </span>
            )
          })}
        </div>
        <div dir="ltr" className={cn('mt-1.5 flex px-1', shown.length > 6 ? 'gap-1' : 'gap-3')}>
          {shown.map((m) => (
            <span key={m.key} className={cn('min-w-0 flex-1 truncate text-center font-semibold text-[var(--color-brand-text-muted)]', shown.length > 6 ? 'text-[0.5625rem]' : 'text-[0.6875rem]')}>
              {label(m.key)}
            </span>
          ))}
        </div>
      </ChartBox>
      {budget > 0 ? <p className="mt-1 text-[0.6875rem] text-[var(--color-brand-text-muted)]">{c.budgetLine}</p> : null}
      {sentence || kept ? (
        <p className="mt-3 text-[0.8125rem] text-[var(--color-brand-text-secondary)] [&_b]:font-mono-numbers">
          <Emphasis text={`${sentence ?? ''}${kept}`.trim()} />
        </p>
      ) : null}
      <ChartDataTable caption={c.aria} headers={c.headers} rows={shown.map((m) => [label(m.key, true), money(m.spent)])} />
    </InsightsSection>
  )
}
