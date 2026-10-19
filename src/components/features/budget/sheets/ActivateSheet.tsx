'use client'

import { ArrowRight, CalendarDays } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/formatters'
import type { PlanSummary } from '@/lib/budget/planSummary'
import type { BudgetPlan, Currency } from '@/lib/store/types'
import { percentText } from '../chromeFormat'
import { useBudgetDeckCopy } from '../useDeckCopy'

export interface ActivateSheetProps {
  open: boolean
  plan: BudgetPlan | null
  current: BudgetPlan | null
  next: PlanSummary | null
  now: PlanSummary | null
  base: Currency
  /** Month the plan takes over from, already formatted ("October"). */
  monthLabel: string
  onConfirm: () => void
  onClose: () => void
}

type Tone = 'good' | 'neutral' | 'warn'

/** Confirm a switch: current versus new on three numbers, and what it means for past months. */
export function ActivateSheet({ open, plan, current, next, now, base, monthLabel, onConfirm, onClose }: ActivateSheetProps) {
  const c = useBudgetDeckCopy().activate
  const money = (n: number) => formatCurrency(n, base, false)

  const rows =
    next && now
      ? [
          {
            label: c.rows.savingsRate,
            from: percentText(now.savingsRate),
            to: percentText(next.savingsRate),
            note: delta(next.savingsRate - now.savingsRate, 0.5, (n) => c.pointsMore(String(Math.round(n))), (n) => c.pointsLess(String(Math.round(n)))),
            tone: tone(next.savingsRate - now.savingsRate, true),
          },
          {
            label: c.rows.everyday,
            from: money(now.everyday),
            to: money(next.everyday),
            note: delta(next.everyday - now.everyday, 1, (n) => c.moreToSpend(money(n)), (n) => c.lessToSpend(money(n))),
            tone: 'neutral' as Tone,
          },
          {
            label: c.rows.extraPayoff,
            from: money(now.extraPayoff),
            to: money(next.extraPayoff),
            note: delta(next.extraPayoff - now.extraPayoff, 1, (n) => c.more(money(n)), (n) => c.less(money(n))),
            tone: tone(next.extraPayoff - now.extraPayoff, true),
          },
        ]
      : []

  function delta(diff: number, min: number, up: (n: number) => string, down: (n: number) => string) {
    return Math.abs(diff) < min ? c.same : diff > 0 ? up(diff) : down(-diff)
  }
  function tone(diff: number, positiveIsGood: boolean): Tone {
    if (Math.abs(diff) < 0.5) return 'neutral'
    return diff > 0 === positiveIsGood ? 'good' : 'warn'
  }
  const toneClass: Record<Tone, string> = {
    good: 'text-[var(--color-brand-green)]',
    warn: 'text-[var(--color-brand-amber)]',
    neutral: 'text-[var(--color-brand-text-secondary)]',
  }

  return (
    <ModalShell open={open && !!plan} onBackdropClick={onClose} padContent>
      {plan ? (
        <div className="flex flex-col gap-4">
          <ModalSheetHeader title={c.title(plan.name)} onClose={onClose} />
          <Card variant="elevated" padding="none" divide className="overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
              <span className="truncate">{current ? c.activeNow : ''}</span>
              <span />
              <span className="truncate text-end">{plan.name}</span>
            </div>
            {rows.map((r) => (
              <div key={r.label} className="px-4 py-3">
                <p className="text-xs text-[var(--color-brand-text-secondary)]">{r.label}</p>
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <span className="font-mono-numbers text-lg font-semibold text-[var(--color-brand-text-primary)]">{r.from}</span>
                  <ArrowRight className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />
                  <span className={`text-end font-mono-numbers text-lg font-semibold ${toneClass[r.tone]}`}>{r.to}</span>
                </div>
                <p className={`mt-0.5 text-end text-xs ${toneClass[r.tone]}`}>{r.note}</p>
              </div>
            ))}
          </Card>
          <div className="flex gap-3 rounded-2xl bg-[var(--color-brand-primary-soft)] p-3.5">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-[var(--color-brand-primary-ink)]" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{c.noteTitle}</p>
              <p className="text-sm text-[var(--color-brand-text-secondary)]">{c.noteBody(monthLabel)}</p>
            </div>
          </div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">{c.hint}</p>
          <div className="sheet-cta flex flex-col gap-2">
            <Button size="cta-block" onClick={() => { onConfirm(); onClose() }}>{c.confirm}</Button>
            <Button size="cta-block" variant="outline" onClick={onClose}>{c.cancel}</Button>
          </div>
        </div>
      ) : null}
    </ModalShell>
  )
}
