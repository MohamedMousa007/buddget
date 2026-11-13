import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BudgetBlock } from '@/lib/store/types'
import type { LineView, PlanView } from '@/lib/budget/planView.types'
import { budgetOverviewCopyAr, budgetOverviewCopyEn } from '@/lib/i18n/budgetPage/overviewCopy'
import { LedgerRow, ledgerRowText } from './LedgerRow'

function line(block: BudgetBlock, name: string, amount: number, spent = 0, extra: Partial<LineView> = {}, confidence?: 'estimated' | 'high'): LineView {
  return {
    line: { id: name, name, block, confidence } as LineView['line'], block, amount, percent: 0, spent, usedPercent: 0,
    average: null, liveAmount: null, dueDay: null, paid: false, status: {} as LineView['status'], ...extra,
  }
}
function view(lines: LineView[], extra: Partial<PlanView> = {}): PlanView {
  const blocks = {} as PlanView['blocks']
  const totals = {} as PlanView['totals']
  for (const b of ['bills', 'subscriptions', 'debts', 'everyday', 'safety', 'goals', 'grow'] as BudgetBlock[]) {
    const ls = lines.filter((l) => l.block === b)
    const total = ls.reduce((s, l) => s + l.amount, 0)
    totals[b] = total
    blocks[b] = { block: b, total, percent: total / 100, spent: ls.reduce((s, l) => s + l.spent, 0), lines: ls }
  }
  return {
    blocks, totals, base: 'USD', mode: 'month', dayOfCycle: 14, daysInCycle: 30, income: 10000, free: 0, balanced: true,
    extras: { goals: [], debts: [], paydayDay: 25, safety: { monthsHeld: 0.8, targetMonths: 3 }, debtFreeMonth: null }, ...extra,
  } as unknown as PlanView
}
const month = (k: string) => k
const en = budgetOverviewCopyEn

describe('ledgerRowText: month', () => {
  const v = view([
    line('bills', 'Rent', 5500, 5500, { paid: true, dueDay: 1 }),
    line('bills', 'Power', 620, 0, { dueDay: 20 }),
    line('everyday', 'Dining', 900, 1070),
  ])
  it('bills: progress in words with the next due day, left and planned on the right', () => {
    const t = ledgerRowText(v, 'bills', 10, en, month)
    expect(t.status).toBe('1 of 2 done · next on the 20th')
    expect(t.amount).toContain('left')
    expect(t.sub).toMatch(/^of /)
  })
  it('everyday: the over line, with ahead of pace', () => {
    expect(ledgerRowText(v, 'everyday', 10, en, month).status).toMatch(/^Dining .* over · ahead$/)
  })
  it('an empty segment says so', () => {
    expect(ledgerRowText(v, 'debts', 10, en, month).status).toBe('Nothing planned')
  })
})

describe('ledgerRowText: plan', () => {
  const lines = [line('debts', 'Visa', 2100, 0, {}, 'estimated'), line('debts', 'Car', 100, 0, {}, 'high'), line('bills', 'Rent', 4000)]
  it('count and share of income; no estimate language outside review', () => {
    const t = ledgerRowText(view(lines, { mode: 'plan' }), 'debts', 10, en, month)
    expect(t.status).toBe('2 debts · 22% of income')
    expect(t.sub).toBe('')
  })
  it('review flags estimates in the status line only there', () => {
    const t = ledgerRowText(view(lines, { mode: 'plan' }), 'debts', 10, en, month, true)
    expect(t.status).toBe('2 debts · 1 estimated')
    expect(t.tone).toBe('warn')
  })
  it('vs last month only when the change is 3% or more', () => {
    const big = view(lines, { mode: 'plan', previousTotals: { bills: 3000 } as PlanView['previousTotals'] })
    expect(ledgerRowText(big, 'bills', 10, en, month).sub).toBe('▲ 33% vs last month')
    const small = view(lines, { mode: 'plan', previousTotals: { bills: 3990 } as PlanView['previousTotals'] })
    expect(ledgerRowText(small, 'bills', 10, en, month).sub).toBe('')
  })
  it('Arabic copy renders with no English left in the fixed words', () => {
    const t = ledgerRowText(view(lines, { mode: 'plan' }), 'bills', 10, budgetOverviewCopyAr, month)
    expect(t.status).not.toMatch(/[A-Za-z]{3,}/)
  })
})

describe('LedgerRow', () => {
  it('is a 44px+ button named by the segment, with a flag only in review', () => {
    const v = view([line('debts', 'Visa', 2100, 0, {}, 'estimated')], { mode: 'plan' })
    const plain = renderToStaticMarkup(h(LedgerRow, { view: v, block: 'debts', today: 10, onOpen: () => {} }))
    expect(plain).toContain('aria-label="Open Debts"')
    expect(plain).toContain('min-h-[52px]')
    expect(plain).not.toContain('lucide-flag')
    const review = renderToStaticMarkup(h(LedgerRow, { view: v, block: 'debts', today: 10, review: true, onOpen: () => {} }))
    expect(review).toContain('lucide-flag')
  })
})
