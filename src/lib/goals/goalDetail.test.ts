import { describe, it, expect } from 'vitest'
import type { Goal, SavingsTransaction } from '@/lib/store/types'
import { checkpointInfo, coachView, replanPatch } from './goalDetail'
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
