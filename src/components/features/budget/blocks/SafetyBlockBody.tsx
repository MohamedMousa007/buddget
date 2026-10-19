'use client'

import { Clock, Flag } from 'lucide-react'
import { useBudgetBlocksCopy } from '@/components/features/budget/useBlocksCopy'
import type { BlockBodyProps } from '@/components/features/budget/types'
import { Button } from '@/components/ui/button'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { formatCurrency } from '@/lib/utils/formatters'
import { coverGauge, cycleCloseDate, toIsoDate } from './geometry'
import { BodyFrame, FlatCard, StatusLine } from './parts'

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString()

/** Months-of-cover gauge: how long the held cash would carry the essentials. */
export function SafetyBlockBody({ view, block, mode, onOpenLine, onAdd }: BlockBodyProps) {
  const t = useBudgetBlocksCopy()
  const { formatMonth, formatDayMonth } = useLocalizedFormatters()
  const money = (n: number) => formatCurrency(n, view.base, false)
  const { monthsHeld, targetMonths, liquid, essentialsMonthly, reachedMonth } = view.extras.safety
  const line = block.lines[0]
  const month = mode === 'month'
  const planned = line && essentialsMonthly > 0 ? line.amount / essentialsMonthly : 0
  const gauge = coverGauge(monthsHeld, targetMonths, month ? planned : 0)
  const close = formatDayMonth(toIsoDate(cycleCloseDate(new Date(), view.dayOfCycle, view.daysInCycle)))

  const trail = month
    ? line
      ? { tone: 'pri' as const, icon: Clock, text: t.safety.atClose(money(line.amount), close) }
      : null
    : monthsHeld >= targetMonths
      ? { tone: 'ok' as const, icon: Flag, text: t.safety.targetReached }
      : reachedMonth
        ? { tone: 'pri' as const, icon: Flag, text: t.safety.reachedBy(formatMonth(reachedMonth)) }
        : { tone: 'warn' as const, icon: Flag, text: t.safety.noContribution }

  return (
    <BodyFrame>
      <FlatCard className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline gap-2">
          <span className="font-mono-numbers text-[28px] leading-none font-semibold text-[var(--color-brand-text-primary)]">{oneDecimal(monthsHeld)}</span>
          <span className="text-sm text-[var(--color-brand-text-secondary)]">{t.safety.ofTarget(targetMonths)}</span>
          {trail ? <StatusLine tone={trail.tone} icon={trail.icon} className="ms-auto font-mono-numbers font-semibold">{trail.text}</StatusLine> : null}
        </div>

        <div className="relative h-[30px]" role="img" aria-label={`${oneDecimal(monthsHeld)} / ${targetMonths}`}>
          <div className="absolute inset-x-0 top-0 h-2.5 rounded-full bg-[var(--color-brand-elevated)]">
            {gauge.extra > 0 ? (
              <div
                className="absolute inset-y-0 rounded-full bg-[color-mix(in_srgb,var(--color-brand-primary-bright)_35%,var(--color-brand-card))]"
                style={{ insetInlineStart: 0, width: `${gauge.held + gauge.extra}%` }}
              />
            ) : null}
            <div className="absolute inset-y-0 start-0 rounded-full bg-[var(--color-cat-1)]" style={{ width: `${gauge.held}%` }} />
          </div>
          {gauge.ticks.map((tick) => (
            <span
              key={tick.months}
              className={
                tick.isTarget
                  ? 'absolute top-3.5 -translate-x-1/2 text-[10.5px] font-bold whitespace-nowrap text-[var(--color-brand-primary-ink)] rtl:translate-x-1/2'
                  : 'absolute top-3.5 -translate-x-1/2 font-mono-numbers text-[10.5px] font-semibold text-[var(--color-brand-text-muted)] rtl:translate-x-1/2'
              }
              style={{ insetInlineStart: `${tick.left}%` }}
            >
              {tick.isTarget ? t.safety.gaugeTarget(tick.months) : tick.months}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--color-brand-border)] pt-2.5">
          <span className="min-w-0 flex-1 font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">
            {month && line ? t.safety.reachesAtClose(Math.round((monthsHeld + planned) * 10) / 10) : t.safety.held(money(liquid), money(essentialsMonthly))}
          </span>
          {line ? (
            <Button variant="ghost" size="touch" onClick={() => onOpenLine(line.line.id)}>
              {month ? t.safety.topUp : t.safety.adjust}
            </Button>
          ) : (
            <Button variant="ghost" size="touch" onClick={() => onAdd('safety')}>
              {t.safety.add}
            </Button>
          )}
        </div>
      </FlatCard>
    </BodyFrame>
  )
}
