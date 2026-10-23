import { describe, expect, it } from 'vitest'
import type { BudgetPlan, BudgetPlanCategory } from '@/lib/store/types'
import type { DebtExtras, GoalExtras } from '@/lib/budget/planView.types'
import { buildPlanView, cycleDayOf, findLineView, isBalanced, type PlanViewInput } from '@/lib/budget/planView'

let n = 0
const line = (name: string, amount: number, extra: Partial<BudgetPlanCategory> = {}): BudgetPlanCategory => ({
  id: `${name}-${++n}`, name, icon: 'wallet', amount, subcategories: [], block: 'everyday', ...extra,
})
const plan = (categories: BudgetPlanCategory[], extra: Partial<BudgetPlan> = {}): BudgetPlan => ({
  id: 'p', name: 'Plan', createdAt: '', categories, ...extra,
})

const emptySubs = { items: [], next: null, charged: 0, total: 0, left: [], yearlySetAside: 0 }
const debt = (id: string, extra: Partial<DebtExtras> = {}): DebtExtras => ({
  id, name: id, kind: 'installment', balance: 1200, paidPercent: 0, minimum: 100,
  installment: null, paidThisCycle: false, ...extra,
})
const goal = (id: string, monthly: number): GoalExtras => ({
  id, name: id, icon: 'target', current: 0, target: 1000, percent: 0, targetDate: null, monthly,
  status: { kind: 'next', icon: 'Flag', tone: 'ink', button: { action: 'addMoney', variant: 'outline' }, params: {} },
})

const input = (p: BudgetPlan, extra: Partial<PlanViewInput> = {}): PlanViewInput => ({
  plan: p,
  mode: 'plan',
  base: 'AED',
  rates: {},
  now: new Date(2026, 9, 19),
  projectedIncome: 10000,
  cycle: { start: new Date(2026, 9, 1), dayOfCycle: 19, daysInCycle: 31 },
  paydayDay: 25,
  spentByLine: {},
  averageByLine: {},
  monthsOverCapByLine: {},
  unassignedSpend: 0,
  subscriptions: { extras: emptySubs, monthly: 0 },
  debts: [],
  goals: [],
  safety: { liquid: 30000, essentialsMonthly: 5000, targetMonths: 3 },
  ...extra,
})

describe('buildPlanView totals', () => {
  const p = plan([
    line('Rent', 4000, { block: 'bills' }),
    line('Netflix', 500, { block: 'subscriptions' }),
    line('Groceries', 2000),
    line('Dining', 1000),
    line('Safety net', 1000, { block: 'safety' }),
    line('Invest', 500, { block: 'grow' }),
  ])
  const v = buildPlanView(input(p))

  it('sums blocks and chapters and keeps page order', () => {
    expect(v.totals).toMatchObject({ bills: 4000, subscriptions: 500, debts: 0, everyday: 3000, safety: 1000, goals: 0, grow: 500 })
    expect(v.chapters.map((c) => c.chapter)).toEqual(['mustPay', 'live', 'secure'])
    expect(v.chapters.map((c) => c.blocks.map((b) => b.block))).toEqual([
      ['bills', 'subscriptions', 'debts'], ['everyday'], ['safety', 'goals', 'grow'],
    ])
    expect(v.chapters.map((c) => c.total)).toEqual([4500, 3000, 1500])
    expect(v.chapters[0].percent).toBeCloseTo(45)
  })

  it('reports income, free and percentages', () => {
    expect(v.income).toBe(10000)
    expect(v.free).toBe(1000)
    expect(v.balanced).toBe(false)
    expect(v.blocks.bills.percent).toBe(40)
    expect(v.flow).toHaveLength(7)
    expect(v.flow[0]).toEqual({ block: 'bills', percent: 40, amount: 4000 })
  })

  it('keeps plan order inside a block and fills line shares', () => {
    expect(v.blocks.everyday.lines.map((l) => l.line.name)).toEqual(['Groceries', 'Dining'])
    expect(v.blocks.everyday.lines[0]).toMatchObject({ amount: 2000, percent: 20, block: 'everyday' })
  })

  it('a plan income override beats projected income', () => {
    const o = buildPlanView(input(plan([line('A', 5000)], { incomeOverride: 5000 })))
    expect(o.income).toBe(5000)
    expect(o.free).toBe(0)
    expect(o.balanced).toBe(true)
  })
})

describe('balanced tolerance', () => {
  it('allows the larger of 1 and 0.2% of income', () => {
    expect(isBalanced(1, 100)).toBe(true)
    expect(isBalanced(1.01, 100)).toBe(false)
    expect(isBalanced(20, 10000)).toBe(true)
    expect(isBalanced(-20.5, 10000)).toBe(false)
  })

  it('over-assigned is negative and not balanced', () => {
    const v = buildPlanView(input(plan([line('A', 12000)])))
    expect(v.free).toBe(-2000)
    expect(v.balanced).toBe(false)
  })
})

describe('empty plan', () => {
  const v = buildPlanView(input(plan([]), { projectedIncome: 0 }))
  it('has zeroed blocks, no upgrade offer and no crash on zero income', () => {
    expect(v.needsUpgrade).toBe(false)
    expect(v.free).toBe(0)
    expect(v.balanced).toBe(true)
    expect(Object.values(v.totals).every((t) => t === 0)).toBe(true)
    expect(v.flow.every((f) => f.percent === 0)).toBe(true)
    expect(v.chapters).toHaveLength(3)
  })
})

describe('legacy upgrade flag', () => {
  it('is true only when no line has a block', () => {
    const legacy = (name: string) => line(name, 100, { block: undefined })
    expect(buildPlanView(input(plan([legacy('Food'), legacy('Rent')]))).needsUpgrade).toBe(true)
    expect(buildPlanView(input(plan([legacy('Food'), line('Rent', 1, { block: 'bills' })]))).needsUpgrade).toBe(false)
  })

  it('still places pre-v2 rows (savings rows read as grow, others as everyday)', () => {
    const v = buildPlanView(input(plan([line('Food', 100, { block: undefined }), line('Savings', 50, { block: undefined, isSavings: true })])))
    expect(v.totals.everyday).toBe(100)
    expect(v.totals.grow).toBe(50)
  })
})

describe('plan vs month mode', () => {
  const food = line('Groceries', 1000)
  const p = plan([food])

  it('plan mode ignores spend', () => {
    const v = buildPlanView(input(p, { spentByLine: { [food.id]: 1500 }, unassignedSpend: 80 }))
    const l = v.blocks.everyday.lines[0]
    expect(l.spent).toBe(0)
    expect(l.usedPercent).toBe(0)
    expect(l.status.kind).toBe('ok')
    expect(v.blocks.everyday.spent).toBe(0)
    expect(v.unassignedSpend).toBe(0)
  })

  it('month mode carries spend, used percent and an over status', () => {
    const v = buildPlanView(input(p, {
      mode: 'month', spentByLine: { [food.id]: 1200 }, averageByLine: { [food.id]: 900 },
      monthsOverCapByLine: { [food.id]: 3 }, unassignedSpend: 80,
    }))
    const l = v.blocks.everyday.lines[0]
    expect(l).toMatchObject({ spent: 1200, usedPercent: 120, average: 900 })
    expect(l.status).toMatchObject({ kind: 'over', button: { variant: 'destructive' }, params: { overBy: 200, months: 3 } })
    expect(v.blocks.everyday.spent).toBe(1200)
    expect(v.chapters[1].spent).toBe(1200)
    expect(v.unassignedSpend).toBe(80)
    expect(v.dayOfCycle).toBe(19)
    expect(v.daysInCycle).toBe(31)
  })

  it('a zero line with spend reads as unbudgeted spend', () => {
    const zero = line('Gifts', 0)
    const v = buildPlanView(input(plan([zero]), { mode: 'month', spentByLine: { [zero.id]: 60 } }))
    expect(v.blocks.everyday.lines[0].status.kind).toBe('unbudgetedSpend')
  })
})

describe('linked lines and drift', () => {
  it('subscriptions drift against the live monthly total', () => {
    const s = line('Subscriptions', 200, { block: 'subscriptions', linkType: 'subscriptions' })
    const v = buildPlanView(input(plan([s]), { subscriptions: { extras: emptySubs, monthly: 260 } }))
    const l = v.blocks.subscriptions.lines[0]
    expect(l.liveAmount).toBe(260)
    expect(l.status).toMatchObject({ kind: 'drifted', params: { delta: 60 } })
  })

  it('no drift inside the tolerance', () => {
    const s = line('Subscriptions', 200, { block: 'subscriptions', linkType: 'subscriptions' })
    const v = buildPlanView(input(plan([s]), { subscriptions: { extras: emptySubs, monthly: 200.4 } }))
    expect(v.blocks.subscriptions.lines[0].status.kind).toBe('ok')
  })

  it('a debt line reads only its own debts; an unlinked one takes what no line names', () => {
    const a = line('Card', 100, { block: 'debts', linkType: 'debts', linkIds: ['d1'] })
    const rest = line('Other debts', 150, { block: 'debts', linkType: 'debts', linkIds: [] })
    const v = buildPlanView(input(plan([a, rest]), { debts: [debt('d1', { minimum: 100 }), debt('d2', { minimum: 70 }), debt('d3', { minimum: 80 })] }))
    expect(v.blocks.debts.lines.map((l) => l.liveAmount)).toEqual([100, 150])
    expect(v.blocks.debts.lines.map((l) => l.status.kind)).toEqual(['ok', 'ok'])
  })

  it('goal lines follow the goal draw', () => {
    const g = line('House', 500, { block: 'goals', linkType: 'goal', linkIds: ['g1'] })
    const v = buildPlanView(input(plan([g]), { goals: [goal('g1', 400)] }))
    expect(v.blocks.goals.lines[0]).toMatchObject({ liveAmount: 400 })
    expect(v.blocks.goals.lines[0].status).toMatchObject({ kind: 'drifted', params: { delta: -100 } })
  })

  it('unlinked and emergency lines have no live value', () => {
    const v = buildPlanView(input(plan([line('Fun', 100), line('Safety', 500, { block: 'safety', linkType: 'emergency' })])))
    expect(v.blocks.everyday.lines[0].liveAmount).toBeNull()
    expect(v.blocks.safety.lines[0].liveAmount).toBeNull()
  })
})

describe('paid flag and due days', () => {
  it('bills are paid from 90% of the plan in month mode only', () => {
    const rent = line('Rent', 1000, { block: 'bills', dueDay: 5 })
    const paid = buildPlanView(input(plan([rent]), { mode: 'month', spentByLine: { [rent.id]: 900 } }))
    expect(paid.blocks.bills.lines[0]).toMatchObject({ paid: true, dueDay: 5 })
    const short = buildPlanView(input(plan([rent]), { mode: 'month', spentByLine: { [rent.id]: 899 } }))
    expect(short.blocks.bills.lines[0].paid).toBe(false)
    expect(buildPlanView(input(plan([rent]), { spentByLine: { [rent.id]: 1000 } })).blocks.bills.lines[0].paid).toBe(false)
  })

  it('an unpaid bill due within a week is dueSoon', () => {
    const rent = line('Rent', 1000, { block: 'bills', dueDay: 22 })
    const v = buildPlanView(input(plan([rent]), { mode: 'month' }))
    expect(v.blocks.bills.lines[0].status).toMatchObject({ kind: 'dueSoon', params: { daysLeft: 3 } })
  })

  it('a debt paid this cycle counts as paid whatever the ledger says', () => {
    const d = line('Card', 100, { block: 'debts', linkType: 'debts', linkIds: ['d1'] })
    const v = buildPlanView(input(plan([d]), { mode: 'month', debts: [debt('d1', { paidThisCycle: true })] }))
    expect(v.blocks.debts.lines[0].paid).toBe(true)
    expect(v.blocks.debts.lines[0].status.kind).toBe('paid')
  })

  it('everyday lines are never "paid"', () => {
    const f = line('Fun', 100)
    expect(buildPlanView(input(plan([f]), { mode: 'month', spentByLine: { [f.id]: 100 } })).blocks.everyday.lines[0].paid).toBe(false)
  })
})

describe('cycleDayOf', () => {
  it('is the calendar day for a cycle starting on the 1st', () => {
    expect(cycleDayOf(new Date(2026, 9, 1), 31, 5)).toBe(5)
    expect(cycleDayOf(new Date(2026, 9, 1), 31, 31)).toBe(31)
  })

  it('counts from the cycle start for a mid-month cycle', () => {
    expect(cycleDayOf(new Date(2026, 9, 25), 30, 28)).toBe(4)
    expect(cycleDayOf(new Date(2026, 9, 25), 30, 5)).toBe(12)
  })

  it('clamps the 31st to a short month', () => {
    expect(cycleDayOf(new Date(2026, 1, 1), 28, 31)).toBe(28)
  })
})

describe('extras', () => {
  it('projects the safety net and the debt-free month', () => {
    const v = buildPlanView(input(
      plan([line('Safety', 1000, { block: 'safety' }), line('Card', 100, { block: 'debts' }), line('Extra', 100, { block: 'debts' })]),
      { debts: [debt('d1', { balance: 400, minimum: 100 })], paydayDay: 1 }
    ))
    expect(v.extras.safety).toMatchObject({ monthsHeld: 6, targetMonths: 3, liquid: 30000, essentialsMonthly: 5000 })
    expect(v.extras.safety.reachedMonth).toBe('2026-10')
    expect(v.extras.paydayDay).toBe(1)
    // 100 minimum + 100 extra against 400: cleared in the second month counting this one as the first.
    expect(v.extras.debtFreeMonth).toBe('2026-11')
  })

  it('reached month needs a contribution', () => {
    const none = buildPlanView(input(plan([]), { safety: { liquid: 1000, essentialsMonthly: 5000, targetMonths: 3 } }))
    expect(none.extras.safety.reachedMonth).toBeNull()
    const funded = buildPlanView(input(plan([line('Safety', 2000, { block: 'safety' })]), { safety: { liquid: 1000, essentialsMonthly: 5000, targetMonths: 3 } }))
    expect(funded.extras.safety.reachedMonth).toBe('2027-05')
    expect(funded.extras.safety.monthsHeld).toBeCloseTo(0.2)
  })

  it('debt-free month is null without debts', () => {
    expect(buildPlanView(input(plan([]))).extras.debtFreeMonth).toBeNull()
  })
})

describe('insights', () => {
  it('flags free money and an unassigned spend', () => {
    const v = buildPlanView(input(plan([line('Fun', 1000)]), { mode: 'month', unassignedSpend: 300 }))
    expect(v.insights.map((x) => x.kind)).toEqual(expect.arrayContaining(['freeToAssign', 'unassignedSpend']))
  })

  it('flags a housing share above 35% of income', () => {
    const v = buildPlanView(input(plan([line('Rent', 5000, { block: 'bills' })])))
    expect(v.insights.find((x) => x.kind === 'housingShare')?.params.percent).toBe(50)
  })

  it('reads repeated overspend from the history', () => {
    const f = line('Dining', 500)
    const v = buildPlanView(input(plan([f]), { monthsOverCapByLine: { [f.id]: 4 }, averageByLine: { [f.id]: 800 } }))
    expect(v.insights.find((x) => x.kind === 'lineOverCap')).toMatchObject({ lineId: f.id, action: 'raise' })
  })
})

describe('findLineView', () => {
  it('finds a line in any block, not just the first', () => {
    const rent = line('Rent', 4000, { block: 'bills' })
    const fun = line('Fun', 300, { block: 'everyday' })
    const buffer = line('Buffer', 500, { block: 'grow' })
    const view = buildPlanView(input(plan([rent, fun, buffer])))
    expect(findLineView(view, fun.id)?.line.name).toBe('Fun')
    expect(findLineView(view, buffer.id)?.line.name).toBe('Buffer')
    expect(findLineView(view, 'nope')).toBeNull()
  })
})
