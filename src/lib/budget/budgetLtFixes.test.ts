import { describe, expect, it } from 'vitest'
import type { BudgetBlock, BudgetPlanCategory, Expense } from '@/lib/store/types'
import type { LineView, PlanView } from '@/lib/budget/planView.types'
import { bufferAfterChange } from './bufferAbsorb'
import { roundedShares } from './shares'
import { nextDueDate } from './nextDue'
import { lineHistory } from './lineHistory'
import { lineToneCategory } from './lineTone'
import { plannedTotal } from './monthSummary'

const BLOCKS: BudgetBlock[] = ['bills', 'subscriptions', 'debts', 'everyday', 'safety', 'goals', 'grow']
function lv(block: BudgetBlock, name: string, amount: number): LineView {
  return { line: { id: name, name, block, amount, subcategories: [], icon: 'wallet' } as unknown as BudgetPlanCategory, block, amount, percent: 0, spent: 0, usedPercent: 0, average: null, liveAmount: null, dueDay: null, paid: false, status: {} as LineView['status'] }
}
function view(lines: LineView[], income: number): PlanView {
  const blocks = {} as PlanView['blocks']
  const totals = {} as PlanView['totals']
  for (const b of BLOCKS) {
    const ls = lines.filter((l) => l.block === b)
    totals[b] = ls.reduce((s, l) => s + l.amount, 0)
    blocks[b] = { block: b, total: totals[b], percent: 0, spent: 0, lines: ls }
  }
  const planned = Object.values(totals).reduce((s, x) => s + x, 0)
  return { blocks, totals, base: 'EGP', income, free: income - planned } as unknown as PlanView
}

describe('budget review: the Buffer is income minus the rest (QA W4)', () => {
  const balanced = view([lv('bills', 'Rent', 7000), lv('grow', 'Buffer', 3000)], 10000)
  it('a new 500 line comes out of the Buffer, so the plan is not over income', () => {
    expect(bufferAfterChange(balanced, 500, {})).toEqual({ lineId: 'Buffer', amount: 2500 })
  })
  it('free money is used first; only the rest leaves the Buffer', () => {
    const loose = view([lv('bills', 'Rent', 7000), lv('grow', 'Buffer', 2800)], 10000)
    expect(bufferAfterChange(loose, 500, {})).toEqual({ lineId: 'Buffer', amount: 2500 })
    expect(bufferAfterChange(loose, 150, {})).toBeNull()
  })
  it('the Buffer never goes below zero, and editing the Buffer itself or lowering a line leaves it alone', () => {
    expect(bufferAfterChange(balanced, 5000, {})).toEqual({ lineId: 'Buffer', amount: 0 })
    expect(bufferAfterChange(balanced, 500, {}, 'Buffer')).toBeNull()
    expect(bufferAfterChange(balanced, -500, {})).toBeNull()
  })
  it('no Buffer line: nothing to shrink', () => {
    expect(bufferAfterChange(view([lv('bills', 'Rent', 10000)], 10000), 500, {})).toBeNull()
  })
})

describe('roundedShares', () => {
  it('three parts of a balanced plan add up to exactly 100', () => {
    const s = roundedShares([33333, 33333, 33334], 100000)
    expect(Math.round(s.reduce((a, b) => a + b, 0) * 10) / 10).toBe(100)
  })
  it('parts that each round up do not reach 100.3', () => {
    const s = roundedShares([1015, 1015, 7970], 10000)
    expect(Math.round(s.reduce((a, b) => a + b, 0) * 10) / 10).toBe(100)
  })
  it('no income: all zero', () => {
    expect(roundedShares([1, 2], 0)).toEqual([0, 0])
  })
})

describe('nextDueDate (QA W4: Due day 5th showed Next due —)', () => {
  const today = new Date(2026, 10, 26, 10, 0)
  it('a due day already passed this month falls due next month', () => {
    expect(nextDueDate([{ dueDay: 5, paid: false, amount: 450 }], today)).toEqual(new Date(2026, 11, 5))
  })
  it('a paid line falls due next month; an unpaid one still ahead this month wins', () => {
    expect(nextDueDate([{ dueDay: 5, paid: true, amount: 450 }], new Date(2026, 10, 2))).toEqual(new Date(2026, 11, 5))
    expect(nextDueDate([{ dueDay: 5, paid: true, amount: 450 }, { dueDay: 28, paid: false, amount: 100 }], today)).toEqual(new Date(2026, 10, 28))
  })
  it('today counts; the 31st clamps to a short month; no due day is null', () => {
    expect(nextDueDate([{ dueDay: 26, paid: false, amount: 1 }], today)).toEqual(new Date(2026, 10, 26))
    expect(nextDueDate([{ dueDay: 31, paid: false, amount: 1 }], today)).toEqual(new Date(2026, 10, 30))
    expect(nextDueDate([{ dueDay: null, paid: false, amount: 1 }], today)).toBeNull()
  })
})

describe('lineHistory (s_line "Sized from your last 3 bills")', () => {
  const ex = (date: string, amount: number, category = 'Utilities') => ({ id: date + amount, date, amount, currency: 'EGP', category, description: '', isRecurring: false, paymentMethodId: 'x', createdAt: date }) as unknown as Expense
  const expenses = [ex('2026-08-10', 430), ex('2026-09-10', 450), ex('2026-10-10', 455), ex('2026-10-12', 999, 'Food'), ex('2026-11-03', 470)]
  it('reads the last three complete months of the line\'s categories, oldest first', () => {
    expect(lineHistory({ name: 'Internet', expenseCategories: ['Utilities'] }, expenses, '2026-11', 1, 'EGP', {})).toEqual({ months: [430, 450, 455], steady: true })
  })
  it('falls back to the line name; null with no spend', () => {
    expect(lineHistory({ name: 'Food' }, expenses, '2026-11', 1, 'EGP', {})).toEqual({ months: [999], steady: false })
    expect(lineHistory({ name: 'Gym', expenseCategories: [] }, expenses, '2026-11', 1, 'EGP', {})).toBeNull()
  })
})

describe('lineToneCategory', () => {
  it('uses the name, a bill alias, then the line\'s categories', () => {
    expect(lineToneCategory({ name: 'Rent' })).toBe('Rent')
    expect(lineToneCategory({ name: 'Internet' })).toBe('Utilities')
    expect(lineToneCategory({ name: 'Nanny', expenseCategories: ['Other', 'Education'] })).toBe('Education')
    expect(lineToneCategory({ name: 'Nanny' })).toBeNull()
  })
})

describe('plannedTotal (QA W5: draft hero said 0 planned with a 173,500 row)', () => {
  it('sums every block, not only everyday', () => {
    expect(plannedTotal(view([lv('bills', 'Rent', 173500)], 0))).toBe(173500)
    expect(plannedTotal(view([lv('bills', 'Rent', 100), lv('everyday', 'Food', 50), lv('grow', 'Buffer', 25)], 0))).toBe(175)
  })
})
