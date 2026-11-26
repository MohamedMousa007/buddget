import { describe, expect, it } from 'vitest'
import { heroTiles, heroVerdict, learningProgress, lockedFindings, paceVerdict, type PlanFigures } from './analysis'
import { buildInsightCharts, categorySlices, CHART_MONTHS, cumulative, MAX_SLICES, monthsStory, OTHER_SLICE } from './charts'
import type { InsightSource } from './buildInput'
import { composeRead } from './narrative'
import { heroAnswer, MIN_DAYS, MIN_EXPENSES } from './detectors'
import { monthlyPoints, projectNetWorth } from './netWorthPath'
import type { Insight, InsightInput } from './types'

const input = (over: Partial<InsightInput> = {}): InsightInput => ({
  cycle: { daysElapsed: 19, daysLeft: 12, totalDays: 31 },
  spent: 16253,
  expenseCount: 60,
  dailyRate: 855,
  projectedSpend: 26520,
  usualSpend: 24000,
  leftToSpend: 8247,
  incomeKnown: true,
  topCategory: { name: 'Food', amount: 3680, total: 16253 },
  keptLast: null,
  bnpl: { plans: 0, remaining: 0, monthly: 0, incomeMonthly: 30000 },
  subs: { count: 0, monthly: 0 },
  bills: { count: 0, total: 0 },
  pay: { card: 0, cash: 0, unassigned: 0, other: 0, placedCount: 0 },
  categories: [],
  paydays: { count: 0, purchases: 0, liftPct: null },
  weekday: { weeks: 0, purchases: 0, byDay: [0, 0, 0, 0, 0, 0, 0], overallDaily: 0 },
  unusual: null,
  small: { threshold: 0, count: 0, total: 0 },
  cardCash: { cardAvg: 0, cardN: 0, cashAvg: 0, cashN: 0 },
  priceRise: null,
  debtPlan: { remaining: 0, monthly: 0 },
  netWorthPath: null,
  ...over,
})

const plan = (over: Partial<PlanFigures> = {}): PlanFigures => ({ budget: 24500, projected: 26520, dailyRate: 855, landDaily: 687, status: 'warning', ...over })
const f = (kind: Insight['kind'], params: Insight['params'], pro = false): Insight => ({ kind, area: 'spending', score: 50, pro, params })

describe('heroVerdict', () => {
  it('says how far over the budget the cycle ends, and what a day lands it', () => {
    const i = input()
    const v = heroVerdict(i, heroAnswer(i), plan())
    expect(v).toMatchObject({ kind: 'budget', over: true, delta: 2020, landDaily: 687, daysLeft: 12 })
  })
  it('says under when the projection is below the budget', () => {
    const i = input()
    expect(heroVerdict(i, heroAnswer(i), plan({ projected: 22000 }))).toMatchObject({ kind: 'budget', over: false, delta: 2500 })
  })
  it('never compares with a zero budget: falls back to the usual, then to the projection alone', () => {
    const i = input()
    expect(heroVerdict(i, heroAnswer(i), plan({ budget: 0 }))).toMatchObject({ kind: 'usual', more: true, delta: 2520 })
    const j = input({ usualSpend: null })
    expect(heroVerdict(j, heroAnswer(j), plan({ budget: 0 }))).toMatchObject({ kind: 'projection', projected: 26520 })
  })
  it('drops the daily figure when it would not land the budget (unpaid bills drive the overrun)', () => {
    const i = input()
    const v = heroVerdict(i, heroAnswer(i), plan({ projected: 28000, dailyRate: 600, landDaily: 860 }))
    expect(v).toMatchObject({ kind: 'budget', over: true, landDaily: null })
    const r = composeRead(v, [f('billsBeforePayday', { count: 3, total: 10000, days: 25 })])!
    expect(r.lines.map((l) => l.key)).toEqual(['paceBudget', 'bills'])
    expect(composeRead(v, [])!.lines.map((l) => l.key)).toEqual(['paceBudget'])
  })
  it('makes no projection while learning, and asks for income first', () => {
    const early = input({ cycle: { daysElapsed: 2, daysLeft: 29, totalDays: 31 } })
    expect(heroVerdict(early, heroAnswer(early), plan())).toMatchObject({ kind: 'early', daysMore: MIN_DAYS - 2 })
    const noInc = input({ incomeKnown: false })
    expect(heroVerdict(noInc, heroAnswer(noInc), plan()).kind).toBe('noIncome')
  })
})

describe('paceVerdict (chart and read with no income, mockup state-insnoinc)', () => {
  it('still projects against the budget when income is missing, while the hero waits for income', () => {
    const noInc = input({ incomeKnown: false })
    expect(heroVerdict(noInc, heroAnswer(noInc), plan()).kind).toBe('noIncome')
    const v = paceVerdict(noInc, heroAnswer(noInc), plan())
    expect(v).toMatchObject({ kind: 'budget', over: true, delta: 2020, projected: 26520 })
    expect(composeRead(v, [])?.lines[0].key).toBe('paceBudget')
  })
  it('stays early (no projection) when the cycle has too little spending yet', () => {
    const early = input({ incomeKnown: false, cycle: { daysElapsed: 2, daysLeft: 29, totalDays: 31 } })
    expect(paceVerdict(early, heroAnswer(early), plan())).toMatchObject({ kind: 'early', daysMore: MIN_DAYS - 2 })
  })
  it('is the hero verdict whenever income is known', () => {
    const i = input()
    expect(paceVerdict(i, heroAnswer(i), plan())).toEqual(heroVerdict(i, heroAnswer(i), plan()))
  })
})

describe('heroTiles', () => {
  const found = [
    f('categoryShift', { name: 'Food', pct: 18, up: 1 }),
    f('billsBeforePayday', { count: 3, total: 3400, days: 6 }),
    f('unusualPurchase', { description: 'IKEA', category: 'Shopping', amount: 3400, typical: 1100 }, true),
    f('weekdayPattern', { day: 4, avg: 1240 }, true),
  ]
  it('maps the four findings in order', () => {
    expect(heroTiles(found, true).map((t) => [t.key, t.insight?.kind, t.locked])).toEqual([
      ['mainReason', 'categoryShift', false],
      ['beforePayday', 'billsBeforePayday', false],
      ['unusualBuy', 'unusualPurchase', false],
      ['bigDay', 'weekdayPattern', false],
    ])
  })
  it('locks only Pro findings that exist, for Free', () => {
    const tiles = heroTiles(found, false)
    expect(tiles.filter((t) => t.locked).map((t) => t.key)).toEqual(['unusualBuy', 'bigDay'])
    const quiet = heroTiles(found.slice(0, 2), false)
    expect(quiet.find((t) => t.key === 'bigDay')).toEqual({ key: 'bigDay', insight: null, locked: false })
  })
  it('falls back to the top category for the main reason', () => {
    expect(heroTiles([f('topCategory', { name: 'Rent', amount: 7000, share: 43 })], true)[0].insight?.kind).toBe('topCategory')
  })
  it('counts locked findings from the same rule', () => {
    expect(lockedFindings(found, false)).toHaveLength(2)
    expect(lockedFindings(found, true)).toHaveLength(0)
  })
})

describe('learningProgress', () => {
  it('reports days and purchases against the minimums, the slower one sets the bar', () => {
    const p = learningProgress(input({ cycle: { daysElapsed: 2, daysLeft: 29, totalDays: 31 }, expenseCount: 4 }))
    expect(p).toEqual({ days: 2, daysNeeded: MIN_DAYS, purchases: 4, purchasesNeeded: MIN_EXPENSES, pct: 40, daysMore: MIN_DAYS - 2 })
  })
  it('caps at the minimums', () => {
    expect(learningProgress(input()).pct).toBe(100)
  })
})

describe('composeRead', () => {
  const i = input()
  const over = heroVerdict(i, heroAnswer(i), plan())
  it('reads pace, driver and action in that order, with two questions', () => {
    const r = composeRead(over, [f('categoryShift', { name: 'Food', pct: 18, up: 1 }), f('topCategory', { name: 'Rent', amount: 7000, share: 43 })])!
    expect(r.lines.map((l) => l.key)).toEqual(['paceBudget', 'driverShift', 'actionLand'])
    expect(r.lines[0]).toMatchObject({ dailyRate: 855, over: true, delta: 2020, far: false })
    expect(r.questions).toEqual([{ key: 'whyCategory', name: 'Food' }, { key: 'makePlan' }])
  })
  it('is deterministic: same input, same read', () => {
    const list = [f('topCategory', { name: 'Rent', amount: 7000, share: 43 })]
    expect(composeRead(over, list)).toEqual(composeRead(over, list))
  })
  it('says keep going when under budget', () => {
    const under = heroVerdict(i, heroAnswer(i), plan({ projected: 22000, status: 'on_track' }))
    const r = composeRead(under, [f('topCategory', { name: 'Rent', amount: 7000, share: 43 })])!
    expect(r.lines.map((l) => l.key)).toEqual(['paceBudget', 'driverTop', 'actionKeep'])
    expect(r.questions.map((q) => q.key)).toEqual(['whereCut', 'makePlan'])
  })
  it('says nothing is left when over with no daily room', () => {
    const v = heroVerdict(i, heroAnswer(i), plan({ landDaily: 0, status: 'over' }))
    const r = composeRead(v, [])!
    expect(r.lines.map((l) => l.key)).toEqual(['paceBudget', 'actionNothingLeft'])
    expect(r.lines[0]).toMatchObject({ far: true })
  })
  it('falls back to bills with no budget, and stays silent without income', () => {
    const v = heroVerdict(i, heroAnswer(i), plan({ budget: 0 }))
    const r = composeRead(v, [f('billsBeforePayday', { count: 2, total: 900, days: 12 })])!
    expect(r.lines.map((l) => l.key)).toEqual(['paceUsual', 'bills'])
    expect(r.questions.map((q) => q.key)).toEqual(['billsOk', 'makePlan'])
    expect(composeRead({ kind: 'noIncome' }, [])).toBeNull()
  })
  it('names an unusual buy before the top category', () => {
    const r = composeRead(over, [f('topCategory', { name: 'Rent', amount: 7000, share: 43 }), f('unusualPurchase', { description: 'IKEA', category: 'Shopping', amount: 3400, typical: 1100 }, true)])!
    expect(r.lines[1]).toEqual({ key: 'driverUnusual', description: 'IKEA', amount: 3400 })
  })
})

describe('chart derivations', () => {
  it('cumulative starts at zero and adds each day', () => {
    expect(cumulative([100, 0, 50])).toEqual([0, 100, 100, 150])
    expect(cumulative([])).toEqual([0])
  })
  it('categorySlices: shares, deltas, and one "Other" for the tail', () => {
    const cats = Array.from({ length: 8 }, (_, k) => ({ name: `C${k}`, amount: 100 - k * 10, last: k === 0 ? 50 : 0 }))
    const s = categorySlices(cats)
    expect(s).toHaveLength(MAX_SLICES)
    expect(s[0]).toEqual({ name: 'C0', amount: 100, share: 19, delta: 100 })
    expect(s[1].delta).toBeNull()
    expect(s.at(-1)!.name).toBe(OTHER_SLICE)
    expect(s.at(-1)!.amount).toBe(120)
    expect(categorySlices([])).toEqual([])
  })
  it('categorySlices: the Other category joins the folded tail, so Other is listed once', () => {
    const cats = [...Array.from({ length: 7 }, (_, k) => ({ name: `C${k}`, amount: 100 - k * 10, last: 0 })), { name: 'Other', amount: 90, last: 0 }]
      .sort((a, b) => b.amount - a.amount)
    const s = categorySlices(cats)
    expect(s).toHaveLength(MAX_SLICES)
    expect(s.filter((x) => x.name === 'Other' || x.name === OTHER_SLICE)).toHaveLength(1)
    expect(s.at(-1)).toMatchObject({ name: OTHER_SLICE, amount: 50 + 40 + 90 })
    expect(s.slice(0, -1).map((x) => x.name)).toEqual(['C0', 'C1', 'C2', 'C3', 'C4'])
    // With no folding, Other keeps its own row.
    expect(categorySlices([{ name: 'Food', amount: 50, last: 0 }, { name: 'Other', amount: 20, last: 0 }]).map((x) => x.name)).toEqual(['Food', 'Other'])
  })
  it('monthsStory: the last cycle over budget and whether it held since', () => {
    const m = (spent: number, received = 0) => ({ spent, received })
    expect(monthsStory([m(21900), m(23100), m(26800), m(22400), m(23880), m(16000)], 24500).story).toEqual({ kind: 'overThenUnder', index: 2, by: 2300 })
    expect(monthsStory([m(21900), m(26000), m(9000)], 24500).story).toEqual({ kind: 'lastOver', index: 1, by: 1500 })
    expect(monthsStory([m(0), m(21000), m(9000)], 24500).story).toEqual({ kind: 'allUnder', count: 1 })
    expect(monthsStory([m(20000), m(9000)], 0).story).toBeNull()
  })
  it('monthsStory: mean share kept over closed cycles with income', () => {
    expect(monthsStory([{ spent: 80, received: 100 }, { spent: 90, received: 100 }, { spent: 10, received: 0 }], 0).keptPct).toBe(15)
  })
})

describe('net worth sparkline values', () => {
  it('keeps the last monthly values, oldest first', () => {
    const rows = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((m, k) => ({ day: `${m}-28`, net_worth: 100 + k }))
    expect(projectNetWorth(monthlyPoints(rows))!.values).toEqual([101, 102, 103, 104, 105, 106])
  })
})

describe('buildInsightCharts', () => {
  // A 25th-start cycle: 17 Nov sits in the cycle that began 25 Oct (key 2026-10), day 24 of it.
  const NOW = new Date('2026-11-17T12:00:00')
  const exp = (id: string, date: string, category: string, amount: number, extra: Record<string, unknown> = {}) =>
    ({ id, date, description: id, category, amount, currency: 'EGP', amountInBaseCurrency: amount, ...extra })
  const src = {
    expenses: [
      exp('a', '2026-10-25', 'Food', 100),
      exp('b', '2026-10-27', 'Food', 50),
      exp('c', '2026-10-27', 'Transport', 30),
      exp('d', '2026-11-17', 'Food', 20),
      exp('debt', '2026-11-01', 'Utilities', 500, { isDebtPayment: true }),
      // Last cycle (25 Sep – 24 Oct): only its first 24 days count against this one.
      exp('l1', '2026-09-25', 'Food', 80),
      exp('l2', '2026-10-24', 'Food', 999),
      exp('old', '2026-06-01', 'Food', 40),
    ],
    incomeSources: [], incomeEvents: [], paymentMethods: [], subscriptions: [], debts: [], debtPayments: [],
    settings: { baseCurrency: 'EGP', monthStartDay: 25 },
    exchangeRates: {}, goldPricePerGram: 0, goldPriceAvailable: false,
  } as unknown as InsightSource
  const charts = buildInsightCharts(src, NOW)

  it('indexes each day of the running cycle from its own start day', () => {
    expect(charts.daily).toHaveLength(24)
    expect(charts.daily[0]).toBe(100)
    expect(charts.daily[2]).toBe(80)
    expect(charts.daily[23]).toBe(20)
    expect(charts.daily[7]).toBe(500)
  })
  it('compares categories with the same days of the last cycle, without debt repayments', () => {
    expect(charts.categories.map((c) => c.name)).toEqual(['Food', 'Transport'])
    expect(charts.categories[0]).toEqual({ name: 'Food', amount: 170, last: 80 })
    expect(charts.categories[1]).toEqual({ name: 'Transport', amount: 30, last: 0 })
  })
  it('lists 12 cycles, oldest first, ending with the running one', () => {
    expect(charts.months).toHaveLength(CHART_MONTHS)
    expect(charts.months.at(-1)!.key).toBe('2026-10')
    expect(charts.months.at(-2)).toMatchObject({ key: '2026-09', spent: 80 + 999 })
    expect(charts.months[0].key).toBe('2025-11')
    expect(charts.months.find((m) => m.key === '2026-05')!.spent).toBe(40)
  })
})
