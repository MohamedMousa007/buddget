'use client'

import { useMemo } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { Card } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { whereItWent } from '@/lib/budget/whereItWent'
import { everydayPace } from '@/lib/budget/monthSummary'
import type { PlanView } from '@/lib/budget/planView.types'
import type { BudgetBlock } from '@/lib/store/types'
import { getMonthRange } from '@/lib/utils/calculations'
import { formatCurrency } from '@/lib/utils/formatters'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { coverGauge, railDots, railPosition } from './blocks/geometry'
import { useBudgetBlocksCopy } from './useBlocksCopy'
import { useSegmentCopy } from './useSegmentCopy'

/** Top descriptions among this cycle's spend on the plan's everyday lines. */
function useWhereItWent(view: PlanView) {
  const expenses = useFinanceStore((s) => s.expenses)
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const startDay = useFinanceStore((s) => s.settings.monthStartDay)
  return useMemo(() => {
    if (view.mode !== 'month') return []
    const { start, end } = getMonthRange(monthFilter, startDay)
    return whereItWent(expenses, new Set(view.blocks.everyday.lines.map((l) => l.line.name)), start, end)
  }, [expenses, monthFilter, startDay, view])
}

function Title({ children }: { children: string }) {
  return <p className={microClassName}>{children}</p>
}

/** The one card that fits each segment: bills rail, charges, payoff order, cover gauge, goal rings, Zakat note, where it went. */
export function SegmentExtra({ view, block }: { view: PlanView; block: BudgetBlock }) {
  const t = useSegmentCopy()
  const blocks = useBudgetBlocksCopy()
  const { formatDayMonth } = useLocalizedFormatters()
  const money = (n: number) => formatCurrency(n, view.base, false)
  const month = view.mode === 'month'
  const merchants = useWhereItWent(view)
  const b = view.blocks[block]

  if (block === 'bills') {
    const dots = railDots(b.lines.map((l) => ({ dueDay: l.dueDay, paid: l.paid })), view.daysInCycle)
    const { paydayDay } = view.extras
    if (dots.length === 0 && paydayDay == null) return null
    return (
      <Card padding="md" className="flex flex-col gap-1">
        <Title>{blocks.bills.railTitle}</Title>
        <div role="img" aria-label={blocks.bills.railAria} className="relative mx-1.5 mb-1.5 mt-1 h-11">
          <div className="absolute inset-x-0 top-3 h-0.5 rounded-sm bg-[var(--color-brand-border-strong)]" />
          {dots.map((d) => (
            <span key={d.day}>
              <i
                className="absolute top-1.5 size-3.5 -translate-x-1/2 rounded-full border-[3px] border-[var(--color-cat-4)]"
                style={{ insetInlineStart: `${d.left}%`, background: !month || d.paid ? 'var(--color-cat-4)' : 'var(--color-brand-card)' }}
              />
              <span className="absolute top-[26px] -translate-x-1/2 font-mono-numbers text-[0.75rem] font-semibold text-[var(--color-brand-text-muted)]" style={{ insetInlineStart: `${d.left}%` }}>
                {d.day}
              </span>
            </span>
          ))}
          {paydayDay != null ? (
            <span>
              <i
                className="absolute top-1.5 size-3.5 -translate-x-1/2 rounded-full border-[3px] border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]"
                style={{ insetInlineStart: `${railPosition(paydayDay, view.daysInCycle)}%` }}
              />
              <span className="absolute top-[26px] -translate-x-1/2 whitespace-nowrap font-mono-numbers text-[0.75rem] font-semibold text-[var(--color-brand-primary-ink)]" style={{ insetInlineStart: `${railPosition(paydayDay, view.daysInCycle)}%` }}>
                {blocks.bills.payday(paydayDay)}
              </span>
            </span>
          ) : null}
        </div>
      </Card>
    )
  }

  if (block === 'subscriptions') {
    const { next, left } = view.extras.subscriptions
    return (
      <Card padding="md" className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
          {next ? t.extra.nextCharge(next.name, formatDayMonth(next.date)) : t.extra.allCharged}
        </p>
        {month && left.length > 0 ? <p className="text-xs text-[var(--color-brand-text-secondary)]">{t.extra.chargesLeft(left.length)}</p> : null}
      </Card>
    )
  }

  if (block === 'debts') {
    const order = [...view.extras.debts].filter((d) => d.balance > 0).sort((x, y) => x.balance - y.balance)
    if (order.length === 0) return null
    return (
      <Card padding="md" className="flex flex-col gap-2">
        <Title>{t.extra.payoffOrder}</Title>
        <ol className="flex flex-col gap-1.5">
          {order.map((d, i) => (
            <li key={d.id} className="flex items-center gap-2 text-sm">
              <span className="font-mono-numbers w-5 text-[var(--color-brand-text-muted)]">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-[var(--color-brand-text-primary)]">{d.name}</span>
              <span className="font-mono-numbers text-[var(--color-brand-text-secondary)]">{money(d.balance)}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-[var(--color-brand-text-secondary)]">{t.extra.firstDebt(order[0].name)}</p>
      </Card>
    )
  }

  if (block === 'safety') {
    const { monthsHeld, targetMonths } = view.extras.safety
    const gauge = coverGauge(monthsHeld, targetMonths, 0)
    const held = (Math.round(monthsHeld * 10) / 10).toString()
    return (
      <Card padding="md" className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.extra.safetyCovers(held, targetMonths)}</p>
        <div role="img" aria-label={`${held} / ${targetMonths}`} className="relative h-2.5 rounded-full bg-[var(--color-brand-elevated)]">
          <div className="absolute inset-y-0 start-0 rounded-full bg-[var(--color-cat-1)]" style={{ width: `${gauge.held}%` }} />
          {gauge.ticks.filter((tk) => tk.isTarget).map((tk) => (
            <span key={tk.months} className="absolute -bottom-1 -top-1 w-0.5 rounded-sm bg-[var(--color-brand-text-primary)] opacity-60" style={{ insetInlineStart: `${tk.left}%` }} aria-hidden />
          ))}
        </div>
      </Card>
    )
  }

  if (block === 'goals') {
    const goals = view.extras.goals
    if (goals.length === 0) return null
    return (
      <Card padding="md" className="flex flex-col gap-3">
        {goals.map((g) => (
          <div key={g.id} className="flex items-center gap-3">
            <ProgressRing pct={g.percent} size={44} stroke={4} arc="var(--color-cat-2)">
              <span className="font-mono-numbers text-[0.75rem] font-semibold text-[var(--color-brand-text-primary)]">{Math.round(g.percent)}</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{g.name}</p>
              <p className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">
                {money(g.current)}{g.target != null ? ` / ${money(g.target)}` : ''}
              </p>
            </div>
          </div>
        ))}
      </Card>
    )
  }

  if (block === 'grow') {
    return b.lines.some((l) => /zakat|زكاة/i.test(l.line.name)) ? (
      <Card padding="md"><p className="text-sm text-[var(--color-brand-text-secondary)]">{t.extra.zakat}</p></Card>
    ) : null
  }

  if (block === 'everyday' && month && merchants.length > 0 && everydayPace(view)) {
    return (
      <Card padding="md" className="flex flex-col gap-2">
        <Title>{t.extra.whereItWent}</Title>
        {merchants.map((m) => (
          <div key={m.name} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-[var(--color-brand-text-primary)]">{m.name}</span>
            <span className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">{money(m.amount)}</span>
          </div>
        ))}
      </Card>
    )
  }
  return null
}
