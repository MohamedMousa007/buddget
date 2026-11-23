import { describe, expect, it } from 'vitest'
import { billsInsight, bnplInsight, heroAnswer, keptInsight, MIN_DAYS, MIN_EXPENSES, MIN_PLACED_PURCHASES, paceInsight, payMixInsight, subsInsight, topCategoryInsight } from './detectors'
import { computeInsights, FREE_INSIGHTS, rankInsights } from './rank'
import type { Insight, InsightInput } from './types'

const base = (over: Partial<InsightInput> = {}): InsightInput => ({
  cycle: { daysElapsed: 17, daysLeft: 9, totalDays: 26 },
  spent: 18450,
  expenseCount: 60,
  dailyRate: 1085,
  projectedSpend: 28210,
  usualSpend: 27000,
  leftToSpend: 3690,
  topCategory: { name: 'Food', amount: 4100, total: 20000 },
  keptLast: { received: 32000, spent: 30000 },
  bnpl: { plans: 4, remaining: 9600, monthly: 1450, incomeMonthly: 29000 },
  subs: { count: 6, monthly: 890 },
  bills: { count: 3, total: 2400 },
  pay: { card: 620, cash: 210, unassigned: 100, other: 70, placedCount: 40 },
  ...over,
})

describe('heroAnswer', () => {
  it('splits what is left across the days to payday', () => {
    const h = heroAnswer(base())
    expect(h.perDay).toBeCloseTo(410)
    expect(h.state).toBe('tight')
    expect(h.runOutInDays).toBe(3)
  })
  it('is fine when the money lasts to payday', () => {
    const h = heroAnswer(base({ leftToSpend: 12000 }))
    expect(h.state).toBe('ok')
    expect(h.runOutInDays).toBeNull()
  })
  it('says nothing sure with too little data', () => {
    expect(heroAnswer(base({ cycle: { daysElapsed: 2, daysLeft: 24, totalDays: 26 } })).state).toBe('learning')
    expect(heroAnswer(base({ expenseCount: MIN_EXPENSES - 1 })).state).toBe('learning')
    expect(heroAnswer(base({ cycle: { daysElapsed: 2, daysLeft: 24, totalDays: 26 } })).daysMore).toBe(MIN_DAYS - 2)
  })
  it('has no per-day amount when nothing is left', () => {
    const h = heroAnswer(base({ leftToSpend: -50 }))
    expect(h.perDay).toBe(0)
    expect(h.runOutInDays).toBe(0)
  })
  it('has no per-day amount on the last day', () => {
    expect(heroAnswer(base({ cycle: { daysElapsed: 26, daysLeft: 0, totalDays: 26 } })).perDay).toBe(0)
  })
})

describe('paceInsight', () => {
  it('compares the projection with the usual cycle', () => {
    const i = paceInsight(base())
    expect(i?.params).toEqual({ delta: 1210, more: 1 })
  })
  it('reports less than usual too', () => {
    expect(paceInsight(base({ projectedSpend: 20000 }))?.params.more).toBe(0)
  })
  it('stays silent within 5% of usual, without 3 closed cycles, or on thin data', () => {
    expect(paceInsight(base({ projectedSpend: 27500 }))).toBeNull()
    expect(paceInsight(base({ usualSpend: null }))).toBeNull()
    expect(paceInsight(base({ expenseCount: 3 }))).toBeNull()
  })
})

describe('topCategoryInsight', () => {
  it('gives the share of counted spend', () => {
    expect(topCategoryInsight(base())?.params).toEqual({ name: 'Food', amount: 4100, share: 21 })
  })
  it('stays silent with no category or thin data', () => {
    expect(topCategoryInsight(base({ topCategory: null }))).toBeNull()
    expect(topCategoryInsight(base({ cycle: { daysElapsed: 3, daysLeft: 23, totalDays: 26 } }))).toBeNull()
  })
})

describe('keptInsight', () => {
  it('uses money received, positive and negative', () => {
    expect(keptInsight(base())?.params).toEqual({ kept: 2000, positive: 1, share: 6 })
    expect(keptInsight(base({ keptLast: { received: 20000, spent: 21000 } }))?.params).toEqual({ kept: 1000, positive: 0, share: 5 })
  })
  it('stays silent with no income received', () => {
    expect(keptInsight(base({ keptLast: { received: 0, spent: 100 } }))).toBeNull()
    expect(keptInsight(base({ keptLast: null }))).toBeNull()
  })
})

describe('bnpl, subscriptions, bills', () => {
  it('needs 2 plans, 2 subscriptions, 1 bill', () => {
    expect(bnplInsight(base())?.params).toEqual({ plans: 4, remaining: 9600, monthly: 1450, share: 5 })
    expect(bnplInsight(base({ bnpl: { plans: 1, remaining: 500, monthly: 100, incomeMonthly: 0 } }))).toBeNull()
    expect(subsInsight(base({ subs: { count: 1, monthly: 100 } }))).toBeNull()
    expect(billsInsight(base({ bills: { count: 0, total: 0 } }))).toBeNull()
    expect(billsInsight(base())?.params).toEqual({ count: 3, total: 2400, days: 9 })
  })
  it('leaves the income share out when income is unknown', () => {
    expect(bnplInsight(base({ bnpl: { plans: 2, remaining: 900, monthly: 300, incomeMonthly: 0 } }))?.params.share).toBe(0)
  })
})

describe('payMixInsight', () => {
  it('counts unassigned bank texts apart from cash', () => {
    expect(payMixInsight(base())?.params).toEqual({ card: 62, cash: 21, unassigned: 10 })
  })
  it('needs enough placed purchases', () => {
    expect(payMixInsight(base({ pay: { card: 100, cash: 100, unassigned: 0, other: 0, placedCount: MIN_PLACED_PURCHASES - 1 } }))).toBeNull()
  })
})

describe('ranking', () => {
  const mk = (kind: Insight['kind'], area: Insight['area'], score: number): Insight => ({ kind, area, score, params: {} })
  it('puts the first three from different areas', () => {
    const out = rankInsights([mk('pace', 'spending', 95), mk('topCategory', 'spending', 90), mk('bnplBurden', 'debts', 80), mk('kept', 'income', 70)])
    expect(out.slice(0, FREE_INSIGHTS).map((x) => x.kind)).toEqual(['pace', 'bnplBurden', 'kept'])
    expect(out).toHaveLength(4)
  })
  it('keeps every finding and orders the rest by score', () => {
    const out = computeInsights(base())
    expect(out).toHaveLength(7)
    expect(out.slice(FREE_INSIGHTS).every((x, i, a) => i === 0 || a[i - 1].score >= x.score)).toBe(true)
  })
  it('is empty when no detector has enough data', () => {
    const thin = base({ expenseCount: 0, usualSpend: null, keptLast: null, topCategory: null, bnpl: { plans: 0, remaining: 0, monthly: 0, incomeMonthly: 0 }, subs: { count: 0, monthly: 0 }, bills: { count: 0, total: 0 }, pay: { card: 0, cash: 0, unassigned: 0, other: 0, placedCount: 0 } })
    expect(computeInsights(thin)).toEqual([])
  })
})
