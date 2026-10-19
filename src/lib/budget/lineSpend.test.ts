import { describe, expect, it } from 'vitest'
import type { BudgetPlan, BudgetPlanCategory, Expense } from '@/lib/store/types'
import { lineHistory, shiftMonth, spendByLine } from '@/lib/budget/lineSpend'

const line = (id: string, name: string, amount: number, extra: Partial<BudgetPlanCategory> = {}): BudgetPlanCategory => ({
  id, name, icon: 'wallet', amount, subcategories: [], block: 'everyday', ...extra,
})
const plan = (categories: BudgetPlanCategory[]): BudgetPlan => ({ id: 'p', name: 'P', createdAt: '', categories })
const run = (p: BudgetPlan, spendingByEnum: Record<string, number>, debtPaid: Record<string, number> = {}) =>
  spendByLine({ plan: p, spendingByEnum, debtPaid })

describe('spendByLine', () => {
  it('matches unflagged lines by name and folds legacy aliases like the dashboard', () => {
    const r = run(plan([line('f', 'Food', 1000), line('t', 'Transport', 500)]), { Food: 300, Groceries: 200, Fuel: 50, Transport: 100 })
    expect(r.byLine).toEqual({ f: 500, t: 150 })
    expect(r.unassigned).toBe(0)
  })

  it('a line with expense categories owns exactly those, case-insensitively', () => {
    const r = run(plan([line('r', 'Home', 4000, { expenseCategories: ['rent', 'Utilities'] })]), { Rent: 3000, Utilities: 400, Food: 10 })
    expect(r.byLine.r).toBe(3400)
    expect(r.unassigned).toBe(10)
  })

  it('the first line in plan order wins a shared category', () => {
    const r = run(plan([line('a', 'A', 1, { expenseCategories: ['Debt'] }), line('b', 'B', 1, { expenseCategories: ['Debt'] })]), { Debt: 80 })
    expect(r.byLine).toEqual({ a: 80, b: 0 })
  })

  it('an explicit claim takes the category out of name matching', () => {
    const r = run(plan([line('g', 'Groceries', 1, { expenseCategories: ['Groceries'] }), line('f', 'Food', 1)]), { Groceries: 200, Food: 50 })
    expect(r.byLine).toEqual({ g: 200, f: 50 })
  })

  it('reports uncovered spend and folds it into the Other line', () => {
    const r = run(plan([line('f', 'Food', 1), line('o', 'Other', 1)]), { Food: 10, Shopping: 70, Debt: 30 })
    expect(r.unassigned).toBe(100)
    expect(r.byLine).toEqual({ f: 10, o: 100 })
  })

  it('without an Other line the unassigned spend stays unassigned', () => {
    const r = run(plan([line('f', 'Food', 1)]), { Shopping: 70 })
    expect(r).toEqual({ byLine: { f: 0 }, unassigned: 70 })
  })

  it('a debt line linked to debts reads their payments, not the ledger', () => {
    const d = line('d', 'Tabby', 300, { block: 'debts', linkType: 'debts', linkIds: ['x', 'y'] })
    const extra = line('e', 'Extra', 100, { block: 'debts', expenseCategories: ['Debt'] })
    const r = run(plan([d, extra]), { Debt: 40 }, { x: 300, y: 50, z: 999 })
    expect(r.byLine).toEqual({ d: 350, e: 40 })
  })

  it('skips savings movement lines', () => {
    const r = run(plan([line('s', 'Safety', 1, { block: 'safety' }), line('g', 'Goal', 1, { block: 'goals' })]), { Savings: 5 })
    expect(r.byLine).toEqual({})
  })
})

describe('shiftMonth', () => {
  it('crosses year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-11', 2)).toBe('2027-01')
  })
})

describe('lineHistory', () => {
  const exp = (date: string, category: string, amount: number): Expense =>
    ({ id: date + category, date, description: '', category, amount, currency: 'AED', amountInBaseCurrency: amount, paymentMethodId: 'pm', isRecurring: false, createdAt: '', updatedAt: '' }) as Expense
  const base = { monthKey: '2026-10', monthStartDay: 1, base: 'AED' as const, rates: {}, debtPaidForMonth: () => ({}) }
  const dining = line('d', 'Food', 500)

  it('averages the last three active cycles and counts consecutive overspend', () => {
    const expenses = [exp('2026-09-02', 'Food', 700), exp('2026-08-02', 'Food', 600), exp('2026-07-02', 'Food', 200), exp('2026-10-02', 'Food', 9999)]
    const h = lineHistory({ ...base, plan: plan([dining]), expenses })
    expect(h.average.d).toBe(500)
    expect(h.monthsOverCap.d).toBe(2)
  })

  it('divides by the cycles that have any activity, not by three', () => {
    const h = lineHistory({ ...base, plan: plan([dining]), expenses: [exp('2026-09-02', 'Food', 300)] })
    expect(h.average.d).toBe(300)
  })

  it('has no average without history or spend on the line', () => {
    expect(lineHistory({ ...base, plan: plan([dining]), expenses: [] })).toEqual({ average: { d: null }, monthsOverCap: { d: 0 } })
    expect(lineHistory({ ...base, plan: plan([dining]), expenses: [exp('2026-09-02', 'Health', 5)] }).average.d).toBeNull()
  })

  it('a zero cap is never "over"', () => {
    const h = lineHistory({ ...base, plan: plan([line('z', 'Food', 0)]), expenses: [exp('2026-09-02', 'Food', 50)] })
    expect(h.monthsOverCap.z).toBe(0)
  })

  it('uses the payments of each past cycle for debt lines', () => {
    const d = line('t', 'Tabby', 100, { block: 'debts', linkType: 'debts', linkIds: ['x'] })
    const h = lineHistory({ ...base, plan: plan([d]), expenses: [exp('2026-09-02', 'Food', 1)], debtPaidForMonth: (k): Record<string, number> => (k === '2026-09' ? { x: 150 } : {}) })
    expect(h.monthsOverCap.t).toBe(1)
  })
})
