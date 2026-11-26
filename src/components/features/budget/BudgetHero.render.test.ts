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

  it('Light touch hero: left to spend in the month, "of" the plan, per day until the end, a spent scale and one note line', () => {
    const html = renderToStaticMarkup(h(MonthHero, { view: view(lines) }))
    expect(html).toMatch(/Left to spend · [A-Z][a-z]+/)
    expect(html).toContain('of 3,300')
    expect(html).toContain('/day')
    expect(html).toContain('until ')
    expect(html).toContain('spent 2,070')
    expect(html).toContain('Dining</b> is over')
    expect(html).toContain('still to pay')
    expect(html).toContain('Ahead of pace')
    expect(html).not.toMatch(/forecast/i)
  })
  it('with a month to close, the corner holds the Close chip instead of the pace pill', () => {
    const html = renderToStaticMarkup(h(MonthHero, { view: view(lines), onCloseMonth: () => undefined }))
    expect(html).toContain('Close')
    expect(html).not.toContain('of pace')
  })
  it('a plan not applied yet shows everything it plans, not only everyday (QA W5: 0 planned with a 173,500 row)', () => {
    const html = renderToStaticMarkup(h(MonthHero, { view: view([line('bills', 'Rent', 173500)]), onApply: () => undefined }))
    expect(html).toContain('173,500')
    expect(html).toContain('planned')
    expect(html).toContain('Apply budget')
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
  it('the split percentages of a balanced plan add up to 100, not 100.3 (QA W4)', () => {
    const v = view([line('bills', 'Rent', 1015), line('debts', 'Visa', 1015), line('safety', 'Fund', 7970)], { mode: 'plan', income: 10000 })
    const pcts = [...renderToStaticMarkup(h(PlanHero, { view: v })).matchAll(/>(\d+(?:\.\d)?)%</g)].map((m) => Number(m[1]))
    expect(pcts.slice(-3).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5)
  })
  it('turns red when the plan exceeds income', () => {
    const html = renderToStaticMarkup(h(PlanHero, { view: view(lines, { mode: 'plan', free: -500, balanced: false }) }))
    expect(html).toContain('Over income by')
    expect(html).toContain('role="alert"')
  })
})
