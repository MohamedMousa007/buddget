'use client'

import { Layers } from 'lucide-react'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { ChartDataTable } from '@/components/reports/ChartDataTable'
import { useT } from '@/lib/i18n'
import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { useInsightsLtCopy } from '@/lib/i18n/insightsLtCopy'
import { categoryChipColors } from '@/lib/expenses/categoryChip'
import { OTHER_SLICE, type CategorySlice } from '@/lib/insights/charts'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { formatWhole } from '@/lib/utils/formatters'
import { formatChangePct } from '@/lib/utils/changePct'
import { ChartBox, useChartTip } from './ChartTip'
import { DeltaChip, InsightsSection } from './InsightsParts'

/** Slices take the category ramp by rank, so neighbours never share a colour; "Other" is the neutral. */
const sliceColor = (s: CategorySlice, i: number) => (s.name === OTHER_SLICE ? 'var(--color-brand-text-muted)' : `var(--color-cat-${i + 1})`)

const R = 46
const C = 2 * Math.PI * R

interface Props {
  slices: CategorySlice[]
  currency: string
  /** Last cycle's name, for "vs September". */
  lastMonth: string
  /** Days compared at the start of each cycle. */
  days: number
}

/** A donut with 2px gaps, a legend with shares, then one row per category with its change against last month. */
export function WhereItWent({ slices, currency, lastMonth, days }: Props) {
  const t = useT()
  const c = useInsightsLtCopy().where
  const hidden = useMask('lists')
  const money = (n: number) => (hidden ? MASK : formatWhole(n))
  const chart = useChartTip()
  const name = (s: CategorySlice) => (s.name === OTHER_SLICE ? c.other : categoryLabel(t, s.name))
  const total = slices.reduce((sum, s) => sum + s.amount, 0)
  const gap = slices.length > 1 ? 2 : 0
  const arcs = slices.reduce<{ len: number; off: number }[]>((acc, sl) => {
    const prev = acc[acc.length - 1]
    acc.push({ len: total > 0 ? (sl.amount / total) * C : 0, off: prev ? prev.off + prev.len : 0 })
    return acc
  }, [])

  return (
    <InsightsSection title={c.title} right={<span className="text-xs text-[var(--color-brand-text-muted)]">{c.vs(lastMonth)}</span>}>
      <div className="mt-3 flex items-center gap-4">
        <ChartBox tip={chart.tip} boxRef={chart.setBox} onLeave={chart.hide} className="shrink-0">
          <svg viewBox="0 0 120 120" className="size-[132px] -rotate-90" role="img" aria-label={c.aria}>
            {slices.map((s, i) => (
                <circle
                  key={s.name}
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  stroke={sliceColor(s, i)}
                  strokeWidth="14"
                  strokeDasharray={`${Math.max(0, arcs[i].len - gap)} ${C}`}
                  strokeDashoffset={-arcs[i].off}
                  className="cursor-pointer"
                  {...chart.bind(c.tip(name(s), money(s.amount), s.share))}
                />
            ))}
          </svg>
          <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <b className="font-mono-numbers text-[1.0625rem] text-[var(--color-brand-text-primary)]">{money(total)}</b>
            <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{c.spent(currency)}</span>
          </span>
        </ChartBox>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {slices.map((s, i) => (
            <li key={s.name} className="flex items-center gap-2 text-[0.8125rem]">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: sliceColor(s, i) }} />
              <span className="min-w-0 flex-1 truncate text-[var(--color-brand-text-primary)]">{name(s)}</span>
              <span className="font-mono-numbers text-[var(--color-brand-text-secondary)]">{s.share}%</span>
            </li>
          ))}
        </ul>
      </div>
      <ul className="mt-4 divide-y divide-[var(--color-brand-border)] border-t border-[var(--color-brand-border)]">
        {slices.map((s) => {
          const chip = categoryChipColors(s.name)
          return (
            <li key={s.name} className="flex min-h-12 items-center gap-3">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-[10px]" style={{ background: chip.bg, color: chip.fg }}>
                {s.name === OTHER_SLICE ? <Layers className="size-4" /> : <CategoryIcon category={s.name} className="size-4" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-[var(--color-brand-text-primary)]">{name(s)}</span>
              <DeltaChip pct={s.delta} />
              <span className="min-w-16 text-end font-mono-numbers text-[0.875rem] font-medium text-[var(--color-brand-text-primary)]">{money(s.amount)}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-[0.6875rem] text-[var(--color-brand-text-muted)]">{c.note(days)}</p>
      <ChartDataTable
        caption={c.aria}
        headers={c.headers}
        rows={slices.map((s) => [name(s), money(s.amount), `${s.share}%`, s.delta === null ? '—' : `${s.delta < 0 ? '\u2212' : ''}${formatChangePct(s.delta)}`])}
      />
    </InsightsSection>
  )
}
