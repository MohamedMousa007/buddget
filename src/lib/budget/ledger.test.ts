import { describe, expect, it } from 'vitest'
import type { BudgetBlock } from '@/lib/store/types'
import type { LineView, PlanView } from '@/lib/budget/planView.types'
import { monthRow, planRow, planSplit, significantChange } from './ledger'

function line(block: BudgetBlock, name: string, amount: number, spent = 0, extra: Partial<LineView> = {}): LineView {
  return {
    line: { id: name, name, block } as LineView['line'], block, amount, percent: 0, spent,
    usedPercent: 0, average: null, liveAmount: null, dueDay: null, paid: false, status: {} as LineView['status'], ...extra,
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
    blocks, totals, dayOfCycle: 14, daysInCycle: 30, income: 10000, free: 0, balanced: true,
    extras: { goals: [], debts: [], paydayDay: 25, safety: { monthsHeld: 0.8, targetMonths: 3 }, debtFreeMonth: null },
    ...extra,
  } as unknown as PlanView
}

describe('monthRow: payable segments', () => {
  const lines = [
    line('bills', 'Rent', 5500, 5500, { paid: true, dueDay: 1 }),
    line('bills', 'Power', 620, 0, { dueDay: 20 }),
    line('bills', 'Internet', 380, 0, { dueDay: 5 }),
  ]
  it('counts paid lines and names the next due day on or after today', () => {
    const r = monthRow(view(lines), 'bills', 10)
    expect(r.status).toEqual({ kind: 'progress', done: 1, total: 3, nextDay: 20 })
    expect(r.right).toEqual({ kind: 'left', amount: 1000, of: 6500 })
  })
  it('falls back to the earliest overdue day when nothing is upcoming', () => {
    expect(monthRow(view(lines), 'bills', 28).status).toMatchObject({ nextDay: 5 })
  })
  it('all paid reads Done', () => {
    const v = view([line('subscriptions', 'Netflix', 180, 180, { paid: true })])
    expect(monthRow(v, 'subscriptions', 10)).toEqual({ status: { kind: 'allPaid', count: 1 }, right: { kind: 'done', of: 180 } })
  })
  it('an empty segment has nothing to say', () => {
    expect(monthRow(view([]), 'debts', 10).status).toEqual({ kind: 'empty' })
  })
})

describe('monthRow: everyday', () => {
  it('names the line that went furthest over, and whether spend is ahead of pace', () => {
    const v = view([line('everyday', 'Groceries', 2400, 1000), line('everyday', 'Dining', 900, 1070), line('everyday', 'Fun', 300, 350)])
    const r = monthRow(v, 'everyday', 14)
    expect(r.status).toMatchObject({ kind: 'overLine', name: 'Dining', over: 170 })
    expect(r.right).toEqual({ kind: 'left', amount: 3600 - 2420, of: 3600 })
  })
  it('over the whole plan reads as over, not a negative left', () => {
    const v = view([line('everyday', 'Groceries', 1000, 1200)])
    expect(monthRow(v, 'everyday', 20).right).toEqual({ kind: 'over', amount: 200, of: 1000 })
  })
})

describe('monthRow: money that moves', () => {
  it('safety shows the payday and the amount still to move', () => {
    const v = view([line('safety', 'Emergency fund', 1850, 0)])
    expect(monthRow(v, 'safety', 10)).toEqual({ status: { kind: 'moves', day: 25 }, right: { kind: 'toMove', amount: 1850 } })
  })
  it('is moved once transfers cover 90% of it', () => {
    const v = view([line('grow', 'Zakat', 790, 750)])
    expect(monthRow(v, 'grow', 28)).toEqual({ status: { kind: 'moved' }, right: { kind: 'moved' } })
  })
})

describe('planRow', () => {
  it('shows a change only at 3% or more', () => {
    expect(significantChange(104, 100)).toBe(4)
    expect(significantChange(102, 100)).toBeNull()
    expect(significantChange(90, 100)).toBe(-10)
    expect(significantChange(100, undefined)).toBeNull()
    expect(significantChange(100, 0)).toBeNull()
  })
  it('carries the last-month change only when an earlier plan exists', () => {
    const lines = [line('bills', 'Rent', 6950)]
    expect(planRow(view(lines), 'bills').change).toBeNull()
    expect(planRow(view(lines, { previousTotals: { bills: 6900 } as PlanView['previousTotals'] }), 'bills').change).toBeNull()
    expect(planRow(view(lines, { previousTotals: { bills: 6000 } as PlanView['previousTotals'] }), 'bills').change).toBe(16)
  })
  it('safety carries months held against the target', () => {
    expect(planRow(view([line('safety', 'Fund', 100)]), 'safety').held).toEqual({ months: 0.8, target: 3 })
  })
})

describe('planSplit', () => {
  it('groups segments into spending, debt and saving against income', () => {
    const v = view([
      line('bills', 'Rent', 4000), line('subscriptions', 'Netflix', 400), line('everyday', 'Food', 2000),
      line('debts', 'Visa', 1000), line('safety', 'Fund', 1500), line('goals', 'Umrah', 600), line('grow', 'Zakat', 500),
    ])
    const s = planSplit(v)
    expect(s.spending).toBe(6400)
    expect(s.debt).toBe(1000)
    expect(s.saving).toBe(2600)
    expect(s.spendingPct).toBeCloseTo(64)
    expect(s.overIncome).toBe(false)
  })
  it('flags a plan that commits more than the income', () => {
    expect(planSplit(view([line('bills', 'Rent', 12000)], { free: -2000, balanced: false })).overIncome).toBe(true)
  })
})
