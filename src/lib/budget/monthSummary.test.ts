import { describe, expect, it } from 'vitest'
import type { BudgetBlock } from '@/lib/store/types'
import type { LineView, PlanView } from '@/lib/budget/planView.types'
import { everydayPace, overBudgetLines, stillToPay, topCategory } from './monthSummary'

function line(block: BudgetBlock, name: string, amount: number, spent = 0, extra: Partial<LineView> = {}): LineView {
  return {
    line: { id: name, name, block } as LineView['line'],
    block,
    amount,
    percent: 0,
    spent,
    usedPercent: amount > 0 ? (spent / amount) * 100 : 0,
    average: null,
    liveAmount: null,
    dueDay: null,
    paid: false,
    status: {} as LineView['status'],
    ...extra,
  }
}

function view(lines: LineView[], dayOfCycle = 14, daysInCycle = 30): PlanView {
  const blocks = {} as PlanView['blocks']
  for (const b of ['bills', 'subscriptions', 'debts', 'everyday', 'safety', 'goals', 'grow'] as BudgetBlock[]) {
    const ls = lines.filter((l) => l.block === b)
    blocks[b] = { block: b, total: ls.reduce((s, l) => s + l.amount, 0), percent: 0, spent: ls.reduce((s, l) => s + l.spent, 0), lines: ls }
  }
  return { blocks, dayOfCycle, daysInCycle } as PlanView
}

describe('everydayPace', () => {
  const lines = (spent: number) => [line('everyday', 'Groceries', 3000, spent)]

  it('is null when the plan has no everyday money', () => {
    expect(everydayPace(view([line('bills', 'Rent', 5000)]))).toBeNull()
  })

  it('on pace: left, per-day allowance and days left', () => {
    const p = everydayPace(view(lines(1300), 14, 30))!
    expect(p.left).toBe(1700)
    expect(p.daysLeft).toBe(16)
    expect(p.perDay).toBeCloseTo(106.25)
    expect(p.state).toBe('ok')
  })

  it('ahead of pace when spend is over 5% above the expected line', () => {
    const p = everydayPace(view(lines(1900), 14, 30))!
    expect(p.expected).toBeCloseTo(1400)
    expect(p.aheadBy).toBeCloseTo(500)
    expect(p.state).toBe('ahead')
  })

  it('over once the plan is exceeded, with no negative per-day', () => {
    const p = everydayPace(view(lines(3200), 24, 30))!
    expect(p.state).toBe('over')
    expect(p.left).toBe(-200)
    expect(p.perDay).toBe(0)
  })

  it('never calls the first days "ahead": one big shop on day 2 is not a trend', () => {
    expect(everydayPace(view(lines(900), 2, 30))!.state).toBe('ok')
  })

  it('last day: no division by zero', () => {
    const p = everydayPace(view(lines(1000), 30, 30))!
    expect(p.daysLeft).toBe(0)
    expect(p.perDay).toBe(0)
  })
})

describe('topCategory', () => {
  it('is the everyday line with the most spend', () => {
    const v = view([line('everyday', 'Groceries', 3000, 1450), line('everyday', 'Dining', 900, 1070)])
    expect(topCategory(v)).toEqual({ name: 'Groceries', spent: 1450 })
  })

  it('is null when nothing has been spent', () => {
    expect(topCategory(view([line('everyday', 'Groceries', 3000, 0)]))).toBeNull()
  })
})

describe('overBudgetLines', () => {
  it('lists lines spent past their cap', () => {
    const v = view([line('everyday', 'Groceries', 3000, 1450), line('everyday', 'Dining', 900, 1070), line('everyday', 'Fun', 0, 40)])
    expect(overBudgetLines(v).map((l) => l.line.name)).toEqual(['Dining'])
  })
})

describe('stillToPay', () => {
  it('sums unpaid lines in bills, subscriptions and debts only', () => {
    const v = view([
      line('bills', 'Rent', 5500, 5500, { paid: true, dueDay: 1 }),
      line('bills', 'Internet', 380, 0, { dueDay: 20 }),
      line('subscriptions', 'Netflix', 180, 180, { paid: true }),
      line('debts', 'Visa', 700, 0, { dueDay: 25 }),
      line('safety', 'Emergency fund', 1850, 0, { dueDay: 25 }),
      line('goals', 'Umrah', 1200, 0),
    ])
    expect(stillToPay(v)).toEqual({ amount: 1080, count: 2, lastDueDay: 25 })
  })

  it('counts only the unpaid remainder of a part-paid line', () => {
    const v = view([line('debts', 'Car loan', 1400, 400, { dueDay: 5 })])
    expect(stillToPay(v).amount).toBe(1000)
  })

  it('does not double-count a card: purchases sit in everyday, only the scheduled card payment is owed', () => {
    const v = view([
      line('everyday', 'Groceries', 3000, 1800),
      line('debts', 'Visa payment', 700, 0, { dueDay: 25 }),
    ])
    expect(stillToPay(v)).toEqual({ amount: 700, count: 1, lastDueDay: 25 })
  })

  it('zero and no due day when everything is paid', () => {
    const v = view([line('bills', 'Rent', 5500, 5500, { paid: true, dueDay: 1 })])
    expect(stillToPay(v)).toEqual({ amount: 0, count: 0, lastDueDay: null })
  })
})
