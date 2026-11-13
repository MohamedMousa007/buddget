import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BudgetBlock } from '@/lib/store/types'
import type { LineView, PlanView } from '@/lib/budget/planView.types'
import { MonthHero, PlanHero } from './BudgetHero'

function line(block: BudgetBlock, name: string, amount: number, spent = 0, extra: Partial<LineView> = {}): LineView {
  return {
    line: { id: name, name, block } as LineView['line'], block, amount, percent: 0, spent, usedPercent: 0,
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
    blocks[b] = { block: b, total, percent: 0, spent: ls.reduce((s, l) => s + l.spent, 0), lines: ls }
  }
  return {
    blocks, totals, base: 'USD', mode: 'month', dayOfCycle: 14, daysInCycle: 30, income: 10000, free: 0, balanced: true, learning: false,
    extras: { goals: [], debts: [], paydayDay: 25, safety: { monthsHeld: 0, targetMonths: 3 }, debtFreeMonth: null },
    ...extra,
  } as unknown as PlanView
}

describe('MonthHero', () => {
  const lines = [line('everyday', 'Groceries', 2400, 1000), line('everyday', 'Dining', 900, 1070), line('debts', 'Visa', 700, 0, { dueDay: 25 })]

  it('shows the everyday label, per-day allowance, a status without a number, and the three facts', () => {
    const html = renderToStaticMarkup(h(MonthHero, { view: view(lines) }))
    expect(html).toContain('Left to spend · Everyday')
    expect(html).toContain('a day')
    expect(html).toContain('16 days left')
    expect(html).toContain('Top category')
    expect(html).toContain('Over budget')
    expect(html).toContain('1 category')
    expect(html).toContain('Still to pay')
    expect(html).not.toMatch(/forecast/i)
    expect(html).not.toContain('Day 14 of 30')
  })
  it('Still to pay reads All paid at zero', () => {
    const v = view([line('everyday', 'Groceries', 2400, 100), line('debts', 'Visa', 700, 700, { paid: true })])
    expect(renderToStaticMarkup(h(MonthHero, { view: v }))).toContain('All paid')
  })
  it('a new plan gets the learning state and no pace pill', () => {
    const html = renderToStaticMarkup(h(MonthHero, { view: view(lines, { learning: true }) }))
    expect(html).toContain('still learning')
    expect(html).not.toContain('Ahead of pace')
    expect(html).not.toContain('On pace')
  })
})

describe('PlanHero', () => {
  const lines = [
    line('bills', 'Rent', 4000), line('everyday', 'Food', 2000), line('debts', 'Visa', 1000), line('safety', 'Fund', 1500),
  ]
  it('shows income, saving rate, debt-free date and the three-way split', () => {
    const html = renderToStaticMarkup(h(PlanHero, { view: view(lines, { mode: 'plan', extras: { ...view([]).extras, debtFreeMonth: '2027-09' } }) }))
    expect(html).toContain('Monthly income')
    expect(html).toContain('Saving 15%')
    expect(html).toContain('Debt-free')
    expect(html).toContain('Spending')
    expect(html).toContain('Debt')
  })
  it('turns red when the plan exceeds income', () => {
    const html = renderToStaticMarkup(h(PlanHero, { view: view(lines, { mode: 'plan', free: -500, balanced: false }) }))
    expect(html).toContain('Over income by')
    expect(html).toContain('role="alert"')
  })
})
