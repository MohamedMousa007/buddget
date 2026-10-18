import { describe, it, expect } from 'vitest'
import type { Goal, SavingsTransaction } from '@/lib/store/types'
import { checkpointInfo, coachView, goalInsight, goalMonthlyRate, normalizeRuns, replanPatch } from './goalDetail'
import { getGoalStatus, periodStartMonth } from './goalStatus'

const now = new Date(2026, 9, 18)
const goal = (o: Partial<Goal> = {}): Goal => ({
  id: 'g', name: 'Trip', emoji: '', category: 'vacation', targetAmount: 1000, currency: 'EGP',
  manualCurrentAmount: 0, targetDate: '2027-10-01', linkedSavingsAccountIds: ['p'], linkedDebtIds: [],
  monthlySpendingLimit: null, priority: 0, status: 'active', monthlyContribution: null,
  fundingMode: 'share', sharePct: 50, frequency: 'monthly', planStart: null, notes: null,
  createdAt: '2026-01-01', achievedAt: null, ...o,
})
const tx = (date: string, amount: number, type: 'deposit' | 'withdrawal' = 'deposit'): SavingsTransaction =>
  ({ id: date, accountId: 'p', type, amount, currency: 'EGP', date })

describe('checkpointInfo', () => {
  it('dates reached checkpoints from the ledger and projects the rest', () => {
    const c = checkpointInfo({
      goal: goal(), current: 300, now, monthlyRate: 100, toGoal: (n) => n,
      txs: [tx('2026-05-01', 200), tx('2026-06-01', 100), tx('2026-06-15', 50, 'withdrawal'), tx('2026-07-01', 50)],
    })
    expect(c.nodes[0]).toMatchObject({ pct: 25, reached: true, date: '2026-06-01' })
    expect(c.nodes[1]).toMatchObject({ pct: 50, reached: false, projected: true, date: '2026-12-01' })
    expect(c.next?.pct).toBe(50)
    expect(c.monthsToNext).toBe(2)
  })
  it('no rate means no projection', () => {
    const c = checkpointInfo({ goal: goal(), current: 0, txs: [], toGoal: (n) => n, monthlyRate: null, now })
    expect(c.nodes.every((n) => n.date === null)).toBe(true)
    expect(c.monthsToNext).toBeNull()
  })
})

describe('coachView and replan', () => {
  const runs = [
    { period: '2026-07', planned: 100, amount: 0 },
    { period: '2026-08', planned: 100, amount: 0 },
    { period: '2026-09', planned: 100, amount: 0 },
  ]
  it('reports the shortfall and both options', () => {
    const c = coachView({ goal: goal(), current: 0, runs, usualKeep: 50, periodSavings: 200, now })!
    expect(c.behindCount).toBe(3)
    expect(c.shortfall).toBe(300)
    expect(c.since).toBe('2026-07')
    expect(c.options.moveDate?.targetDate).toBe('2028-06-01')
    expect(c.options.keepDate.perPeriod).toBeCloseTo(1000 / 12)
  })
  it('manual goals and on-track goals have no coach card', () => {
    expect(coachView({ goal: goal({ fundingMode: 'manual' }), current: 0, runs, usualKeep: 50, periodSavings: 200, now })).toBeNull()
    expect(coachView({ goal: goal(), current: 0, runs: [{ period: '2026-09', planned: 100, amount: 100 }], usualKeep: 50, periodSavings: 200, now })).toBeNull()
  })
  it('replanning clears behind by restarting the plan', () => {
    const g = goal()
    const c = coachView({ goal: g, current: 0, runs, usualKeep: 50, periodSavings: 200, now })!
    const patch = replanPatch(g, 'move', c.options, '2026-10-18')!
    expect(patch.planStart).toBe('2026-10-18')
    const after = { ...g, ...patch }
    expect(getGoalStatus({ goal: after, current: 0, runs, now }).kind).not.toBe('behind')
    expect(coachView({ goal: after, current: 0, runs, usualKeep: 50, periodSavings: 200, now })).toBeNull()
  })
  it('keep-the-date raises the share, or switches a fixed plan', () => {
    const c = coachView({ goal: goal(), current: 0, runs, usualKeep: 50, periodSavings: 200, now })!
    expect(replanPatch(goal(), 'keep', c.options, 'd')).toMatchObject({ sharePct: 45 })
    expect(replanPatch(goal({ fundingMode: 'fixed' }), 'keep', c.options, 'd')).toMatchObject({ fundingMode: 'fixed', monthlyContribution: 84 })
  })
})

describe('periodStartMonth', () => {
  it('maps quarters to their first month', () => {
    expect(periodStartMonth('2026-Q4')).toBe('2026-10')
    expect(periodStartMonth('2026-07')).toBe('2026-07')
  })
})

describe('normalizeRuns', () => {
  const runs = [{ period: '2026-08', planned: 100, amount: 0 }, { period: '2026-Q3', planned: 300, amount: 0 }]
  const txs: SavingsTransaction[] = [
    { id: '1', accountId: 'p', type: 'deposit', amount: 40, currency: 'EGP', date: '2026-08-10' },
    { id: '2', accountId: 'p', type: 'deposit', amount: 99, currency: 'EGP', date: '2026-08-11', source: 'carry' },
    { id: '3', accountId: 'p', type: 'deposit', amount: 99, currency: 'EGP', date: '2026-08-12', source: 'goal_opening' },
    { id: '4', accountId: 'x', type: 'deposit', amount: 99, currency: 'EGP', date: '2026-08-12' },
    { id: '5', accountId: 'p', type: 'deposit', amount: 10, currency: 'EGP', date: '2026-09-30' },
  ]
  it('counts hand-added deposits in their cycle and converts currency', () => {
    const out = normalizeRuns({ goal: goal(), runs, txs, baseToGoal: (n) => n * 2, toGoal: (a) => a })
    expect(out[0]).toEqual({ period: '2026-08', planned: 200, amount: 40 })
    expect(out[1]).toEqual({ period: '2026-Q3', planned: 600, amount: 50 })
  })
  it('so a self-funded goal is not behind', () => {
    const paid = normalizeRuns({ goal: goal(), runs: [{ period: '2026-07', planned: 100, amount: 0 }, { period: '2026-08', planned: 100, amount: 0 }], txs: [
      { id: 'a', accountId: 'p', type: 'deposit', amount: 100, currency: 'EGP', date: '2026-07-05' },
      { id: 'b', accountId: 'p', type: 'deposit', amount: 100, currency: 'EGP', date: '2026-08-05' },
    ], baseToGoal: (n) => n, toGoal: (a) => a })
    expect(getGoalStatus({ goal: goal(), current: 200, runs: paid, now }).kind).not.toBe('behind')
  })
})

describe('goalInsight', () => {
  const year = new Date(2026, 9, 18)
  it('counts milestones reached this year and finds the nearest next checkpoint', () => {
    const g = goal({ fundingMode: 'fixed', monthlyContribution: 100 })
    const txs = [tx('2026-03-01', 300), tx('2025-12-01', 100)]
    const i = goalInsight({ goals: [g], currentFor: () => 400, ledgerFor: (x) => ({ goal: x, txs }), toGoal: () => (n) => n, rateFor: (x) => goalMonthlyRate(x, null), now: year })
    expect(i.milestones).toBe(1)
    expect(i.next).toMatchObject({ name: 'Trip', pct: 50 })
    expect(i.next!.days).toBe(30)
  })
  it('is empty with no history and no pace', () => {
    const i = goalInsight({ goals: [goal({ fundingMode: 'manual' })], currentFor: () => 0, ledgerFor: (x) => ({ goal: x, txs: [] }), toGoal: () => (n) => n, rateFor: () => null, now: year })
    expect(i).toEqual({ milestones: 0, next: null })
  })
  it('ignores limit goals', () => {
    const i = goalInsight({ goals: [goal({ category: 'spending_control' })], currentFor: () => 500, ledgerFor: (x) => ({ goal: x, txs: [] }), toGoal: () => (n) => n, rateFor: () => 100, now: year })
    expect(i).toEqual({ milestones: 0, next: null })
  })
})
