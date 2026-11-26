'use client'

import type { ReactNode } from 'react'
import { Check, Clock, Info, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BAND_FG2, BAND_MIX, HeroBand } from '@/components/features/hero/HeroBand'
import { useCategoryLabel } from '@/hooks/useCategoryLabel'
import { everydayPace, overBudgetLines, plannedTotal, stillToPay, topCategory } from '@/lib/budget/monthSummary'
import { roundedShares } from '@/lib/budget/shares'
import { planSplit } from '@/lib/budget/ledger'
import type { PlanView } from '@/lib/budget/planView.types'
import { useLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { formatWhole } from '@/lib/utils/formatters'
import { useBudgetDraftCopy } from '@/lib/i18n/budgetDraftCopy'
import { useBudgetLtCopy } from '@/lib/i18n/budgetLtCopy'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { monthKeyLabel, percentText, inlineMoney } from './chromeFormat'
import { useOverviewCopy } from './useOverviewCopy'

function Stat({ label, children, color }: { label: string; children: ReactNode; color?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-[var(--color-brand-text-secondary)]">{label}</span>
      <span className="font-mono-numbers truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]" style={color ? { color } : undefined}>
        {children}
      </span>
    </div>
  )
}


/** The cycle's first and last day, from where today sits in it. */
function cycleBounds(view: PlanView, today = new Date()): { start: Date; end: Date } {
  const day = Math.max(1, view.dayOfCycle)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (day - 1))
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + Math.max(1, view.daysInCycle) - 1)
  return { start, end }
}

/**
 * The month hero (Light touch `page-budget`): everyday money left "of" the plan, per day until the cycle ends, the
 * spend bar with today's tick over a start · spent · end scale, and one note line. With `onApply` (the plan is not
 * applied yet) it shows everything the plan sets aside and an "Apply budget" call to action instead. With
 * `onCloseMonth` the month-close entry sits in the corner as the mockup's Close chip.
 */
export function MonthHero({ view, onApply, onCloseMonth }: { view: PlanView; onApply?: () => void; onCloseMonth?: () => void }) {
  const c = useOverviewCopy().hero
  const d = useBudgetDraftCopy()
  const lt = useBudgetLtCopy()
  const { locale } = useLocale()
  const catLabel = useCategoryLabel()
  const money = (n: number) => inlineMoney(n, view.base)
  const pace = everydayPace(view)
  const tick = view.daysInCycle > 0 ? Math.min(100, (view.dayOfCycle / view.daysInCycle) * 100) : null

  if (onApply) {
    return (
      <HeroBand
        label={lt.draft.label}
        contained
        numbers={
          <>
            <p className="flex min-w-0 items-baseline gap-1.5">
              <span className="font-mono-numbers whitespace-nowrap text-[32px] font-semibold leading-none tracking-[-0.03em]">{formatWhole(plannedTotal(view))}</span>
              <span className={`text-[0.8125rem] ${BAND_FG2}`}>{view.base} {d.planned}</span>
            </p>
            <p className={`shrink-0 text-end text-[0.71875rem] leading-[1.3] ${BAND_FG2}`}>
              <span dir="auto">{c.daysLeft(Math.max(0, view.daysInCycle - view.dayOfCycle))}</span>
            </p>
          </>
        }
        bar={<div aria-hidden className="h-1.5 rounded-full" style={{ background: BAND_MIX }} />}
        note={<span dir="auto">{d.note}</span>}
        extra={
          <Button variant="onBand" size="touch" className="mt-3 w-full font-semibold" onClick={onApply}>
            {d.apply}
          </Button>
        }
      />
    )
  }

  if (view.learning || !pace) {
    const planned = view.blocks.everyday.total
    const daysLeft = Math.max(0, view.daysInCycle - view.dayOfCycle)
    return (
      <Card padding="md" className="flex flex-col gap-2.5">
        {view.learning ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-[var(--color-brand-elevated)] p-3" role="note">
            <Info className="mt-0.5 size-4 shrink-0 text-[var(--color-brand-text-secondary)]" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{c.learningTitle}</p>
              <p className="text-xs text-[var(--color-brand-text-secondary)]">{c.learningBody}</p>
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-3">
          <Stat label={c.leftLabel}>{money(Math.max(0, planned - view.blocks.everyday.spent))}</Stat>
          <Stat label={c.planned}>{money(planned)}</Stat>
          <Stat label={c.daysLeftLabel}>{daysLeft}</Stat>
        </div>
      </Card>
    )
  }

  const top = topCategory(view)
  const overLines = overBudgetLines(view)
  const owed = stillToPay(view)
  const Icon = pace.state === 'ok' ? Check : TriangleAlert
  const fill = Math.max(0, Math.min(100, (pace.spent / pace.planned) * 100))
  const { start, end } = cycleBounds(view)
  const short = (dt: Date) => formatLocalized(dt, 'MMM d', locale)
  const B = 'font-semibold text-[var(--flow-band-fg)]'
  const lead = overLines.length === 1
    ? <><b className={B}>{catLabel(overLines[0].line.name)}</b> {lt.hero.overTail}</>
    : overLines.length > 1
      ? lt.hero.areOver(overLines.length)
      : top ? lt.hero.topIs(catLabel(top.name)) : null
  return (
    <HeroBand
      label={lt.hero.leftIn(formatLocalized(start, 'MMMM', locale))}
      contained
      aside={
        onCloseMonth ? (
          <Button variant="onBand" size="sm" className="h-7 gap-1 rounded-full px-2.5 text-xs font-semibold" onClick={onCloseMonth}>
            <Clock aria-hidden className="size-3.5" />
            {lt.hero.close}
          </Button>
        ) : (
          <Badge tone={pace.state === 'ok' ? 'positive' : pace.state === 'ahead' ? 'warn' : 'negative'} size="md">
            <Icon aria-hidden />
            {c.pace[pace.state]}
          </Badge>
        )
      }
      numbers={
        <>
          <p className="flex min-w-0 items-baseline gap-1.5">
            <span className="font-mono-numbers whitespace-nowrap text-[32px] font-semibold leading-none tracking-[-0.03em]">{formatWhole(pace.left)}</span>
            <span dir="auto" className={`truncate text-[0.8125rem] ${BAND_FG2}`}>{view.base} {lt.hero.of(formatWhole(pace.planned))}</span>
          </p>
          <p className={`shrink-0 text-end text-[0.71875rem] leading-[1.3] ${BAND_FG2}`}>
            <b dir="auto" className="block font-mono-numbers text-[0.9375rem] text-[var(--flow-band-fg)]">{lt.hero.perDay(formatWhole(pace.perDay))}</b>
            <span dir="auto">{lt.hero.until(short(end))}</span>
          </p>
        </>
      }
      bar={
        <>
          <div role="img" aria-label={c.paceLabel} className="relative h-1.5 rounded-full" style={{ background: BAND_MIX }}>
            <div className="h-full rounded-full bg-[var(--flow-band-fg)]" style={{ width: `${fill}%` }} />
            {tick !== null ? <span aria-hidden className="absolute -top-1 h-3.5 w-0.5 rounded bg-[var(--flow-band-fg)]" style={{ insetInlineStart: `${tick}%` }} /> : null}
          </div>
          <div className={`mt-[5px] flex h-[15.75px] items-center justify-between font-mono-numbers text-[0.6875rem] font-semibold ${BAND_FG2}`}>
            <span>{short(start)}</span>
            <span dir="auto">{lt.hero.spent(formatWhole(pace.spent))}</span>
            <span>{short(end)}</span>
          </div>
        </>
      }
      note={
        <span dir="auto" className="flex flex-wrap gap-x-4">
          {lead ? <span>{lead}</span> : null}
          <span>
            {owed.amount > 0
              ? <><b className={`font-mono-numbers ${B}`}>{formatWhole(owed.amount)}</b> {lt.hero.toPayTail}</>
              : lt.hero.allPaid}
          </span>
        </span>
      }
    />
  )
}

const SPLIT_COLOR = {
  spending: 'var(--color-cat-4)',
  debt: 'var(--color-cat-3)',
  saving: 'var(--color-cat-1)',
} as const

/** The three-way split bar with its legend (spending, debt, saving against income). */
export function SplitBar({ view }: { view: PlanView }) {
  const c = useOverviewCopy().hero
  const s = planSplit(view)
  const denom = Math.max(view.income, s.spending + s.debt + s.saving) || 1
  // Rounded together so a balanced plan reads 100%, never 100.3%.
  const pcts = roundedShares([s.spending, s.debt, s.saving], view.income)
  const parts = (['spending', 'debt', 'saving'] as const).map((k, i) => ({ k, amount: s[k], pct: pcts[i] }))
  return (
    <>
      <div role="img" aria-label={c.splitLabel} className="flex h-3 gap-0.5 overflow-hidden rounded-md bg-[var(--color-brand-elevated)]">
        {parts.map((p) => (
          <span key={p.k} className="block h-full rounded" style={{ width: `${(p.amount / denom) * 100}%`, background: SPLIT_COLOR[p.k] }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <span key={p.k} className="inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-text-secondary)]">
            <span className="size-2 rounded-full" style={{ background: SPLIT_COLOR[p.k] }} aria-hidden />
            {c.split[p.k]} <span className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">{percentText(p.pct)}</span>
          </span>
        ))}
      </div>
    </>
  )
}

/** The plan hero: income, saving rate, debt-free date and how the income is split three ways. */
export function PlanHero({ view }: { view: PlanView }) {
  const c = useOverviewCopy().hero
  const { locale } = useLocale()
  // Light touch: the amount, then the grey currency code.
  const money = (n: number) => inlineMoney(n, view.base)
  const s = planSplit(view)
  const parts = (['spending', 'debt', 'saving'] as const).map((k) => ({ k, amount: s[k], pct: s[`${k}Pct` as 'spendingPct'] }))
  const month = view.extras.debtFreeMonth
  return (
    <Card padding="md" className="flex flex-col gap-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-[var(--color-brand-text-secondary)]">{c.income}</span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="font-mono-numbers text-[30px] font-semibold leading-none tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{formatWhole(view.income)}</span>
            <span className="text-[0.8125rem] text-[var(--color-brand-text-muted)]">{view.base}</span>
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-end text-xs text-[var(--color-brand-text-secondary)]">
          <span className="font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.saving(percentText(s.savingPct))}</span>
          {month ? <span>{c.debtFree(monthKeyLabel(month, locale))}</span> : null}
        </div>
      </div>
      {s.overIncome ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-brand-red-text)]" role="alert">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {c.over(money(-view.free))}
        </p>
      ) : null}
      <SplitBar view={view} />
      <div className={cn('grid grid-cols-3 gap-3')}>
        {parts.map((p) => (
          <Stat key={p.k} label={c.split[p.k]}>{money(p.amount)}</Stat>
        ))}
      </div>
    </Card>
  )
}
