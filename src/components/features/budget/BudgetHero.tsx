'use client'

import type { ReactNode } from 'react'
import { Check, Info, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { BAND_FG2, BAND_MIX, HeroBand } from '@/components/features/hero/HeroBand'
import { useCategoryLabel } from '@/hooks/useCategoryLabel'
import { everydayPace, overBudgetLines, stillToPay, topCategory } from '@/lib/budget/monthSummary'
import { planSplit } from '@/lib/budget/ledger'
import type { PlanView } from '@/lib/budget/planView.types'
import { useLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/formatters'
import { monthKeyLabel, percentText } from './chromeFormat'
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


/** The month hero: everyday money left, the pace against an even line, and three facts. */
export function MonthHero({ view }: { view: PlanView }) {
  const c = useOverviewCopy().hero
  const catLabel = useCategoryLabel()
  const money = (n: number) => formatCurrency(n, view.base, false)
  const pace = everydayPace(view)
  const tick = view.daysInCycle > 0 ? Math.min(100, (view.dayOfCycle / view.daysInCycle) * 100) : null

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
  const over = overBudgetLines(view).length
  const owed = stillToPay(view)
  const Icon = pace.state === 'ok' ? Check : TriangleAlert
  const fill = Math.max(0, Math.min(100, (pace.spent / pace.planned) * 100))
  // Light touch `page-budget`: the rounded teal band; the three facts collapse into one line under the bar.
  return (
    <HeroBand
      label={c.leftLabel}
      contained
      aside={
        <Badge tone={pace.state === 'ok' ? 'positive' : pace.state === 'ahead' ? 'warn' : 'negative'} size="md">
          <Icon aria-hidden />
          {c.pace[pace.state]}
        </Badge>
      }
      numbers={
        <>
          <p className="flex min-w-0 items-baseline gap-1.5">
            <span className="font-mono-numbers whitespace-nowrap text-[32px] font-semibold leading-none tracking-[-0.03em]">{money(pace.left)}</span>
          </p>
          <p className={`shrink-0 text-end text-[0.71875rem] leading-[1.3] ${BAND_FG2}`}>
            <b dir="auto" className="block font-mono-numbers text-[0.9375rem] text-[var(--flow-band-fg)]">{c.perDay(money(pace.perDay))}</b>
            <span dir="auto">{c.daysLeft(pace.daysLeft)}</span>
          </p>
        </>
      }
      bar={
        <div role="img" aria-label={c.paceLabel} className="relative h-1.5 rounded-full" style={{ background: BAND_MIX }}>
          <div className="h-full rounded-full bg-[var(--flow-band-fg)]" style={{ width: `${fill}%` }} />
          {tick !== null ? <span aria-hidden className="absolute -top-1 h-3.5 w-0.5 rounded bg-[var(--flow-band-fg)]" style={{ insetInlineStart: `${tick}%` }} /> : null}
        </div>
      }
      note={
        <span dir="auto">
          {top ? <>{c.topCategory} <b className="font-semibold text-[var(--flow-band-fg)]">{catLabel(top.name)}</b></> : null}
          {over > 0 ? <> · {c.overBudget} <b className="font-semibold text-[var(--flow-band-fg)]">{c.overCount(over)}</b></> : null}
          {' · '}{c.stillToPay} <b className="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">{owed.amount > 0 ? money(owed.amount) : c.allPaid}</b>
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
  const parts = (['spending', 'debt', 'saving'] as const).map((k) => ({ k, amount: s[k], pct: s[`${k}Pct` as 'spendingPct'] }))
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
  const money = (n: number) => formatCurrency(n, view.base, false)
  const s = planSplit(view)
  const parts = (['spending', 'debt', 'saving'] as const).map((k) => ({ k, amount: s[k], pct: s[`${k}Pct` as 'spendingPct'] }))
  const month = view.extras.debtFreeMonth
  return (
    <Card padding="md" className="flex flex-col gap-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-[var(--color-brand-text-secondary)]">{c.income}</span>
          <span className="font-mono-numbers whitespace-nowrap text-[30px] font-semibold leading-none tracking-[-0.02em] text-[var(--color-brand-text-primary)]">
            {money(view.income)}
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
