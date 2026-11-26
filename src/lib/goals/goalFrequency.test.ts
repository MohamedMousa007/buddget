import { describe, expect, it } from 'vitest'
import type { Goal, SavingsTransaction } from '@/lib/store/types'
import { computePace, periodMonths, periodsUntil, projectedFinish } from './goalPlan'
import { cycleRuns, getGoalStatus, periodKey, periodSpan, periodStartMonth, type AllocationRun } from './goalStatus'
import { coachView, goalMonthlyRate, normalizeRuns } from './goalDetail'
import { evaluateGoalAlerts, renderGoalAlert } from '@/lib/notifications/evaluateGoalAlerts'
import { getServerDictionary } from '@/lib/i18n/getServerDictionary'

const goal = (o: Partial<Goal> = {}): Goal => ({
  id: 'g', name: 'Trip', emoji: '', category: 'vacation', targetAmount: 12000, currency: 'EGP',
  manualCurrentAmount: 0, targetDate: '2029-12-01', linkedSavingsAccountIds: ['p'], linkedDebtIds: [],
  monthlySpendingLimit: null, priority: 0, status: 'active', monthlyContribution: 2400,
  fundingMode: 'fixed', sharePct: null, frequency: 'yearly', planStart: null, notes: null,
  createdAt: '2024-01-01', achievedAt: null, ...o,
})
const months = (from: string, n: number, planned: number, amount: number): AllocationRun[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1 + i, 1)
    return { period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, planned, amount }
  })

describe('yearly frequency: plan step', () => {
  it('a year is 12 months', () => {
    expect(periodMonths('monthly')).toBe(1)
    expect(periodMonths('quarterly')).toBe(3)
    expect(periodMonths('yearly')).toBe(12)
  })
  it('counts whole years to the target date and compares against 12x the usual keep', () => {
    const now = new Date(2026, 9, 18)
    expect(periodsUntil(now, '2028-10-01', 'yearly')).toBe(2)
    const p = computePace({ target: 24000, saved: 0, targetDate: '2028-10-01', frequency: 'yearly', usualKeep: 1000, now })
    expect(p.periods).toBe(2)
    expect(p.asked).toBe(12000)
    expect(p.ratio).toBe(1)
  })
  it('projects a finish a whole number of years out', () => {
    expect(projectedFinish(5000, 2400, 'yearly', new Date(2026, 9, 18))).toBe('2029-10-01')
  })
})

describe('yearly frequency: period keys', () => {
  it('maps months to YYYY and back', () => {
    expect(periodKey('2026-10', 'yearly')).toBe('2026')
    expect(periodKey('2026-10', 'quarterly')).toBe('2026-Q4')
    expect(periodKey('2026-10', 'monthly')).toBe('2026-10')
    expect(periodStartMonth('2026')).toBe('2026-01')
    expect(periodSpan('2026')).toBe(12)
    expect(periodSpan('2026-Q2')).toBe(3)
    expect(periodSpan('2026-05')).toBe(1)
  })
})

describe('on-track is checked on due dates only', () => {
  it('monthly runs of a yearly goal are summed per year, and the running year is left out', () => {
    const runs = [...months('2025-01', 12, 200, 0), ...months('2026-01', 9, 200, 200)]
    const out = cycleRuns('yearly', runs, new Date(2026, 9, 18))
    expect(out).toEqual([{ period: '2025', planned: 2400, amount: 0 }])
  })
  it('a year counts once its last month has closed', () => {
    const out = cycleRuns('yearly', months('2025-01', 12, 200, 200), new Date(2026, 0, 3))
    expect(out).toEqual([{ period: '2025', planned: 2400, amount: 2400 }])
  })
  it('monthly goals keep their runs as they are', () => {
    const runs = months('2026-01', 3, 100, 0)
    expect(cycleRuns('monthly', runs, new Date(2026, 9, 18))).toBe(runs)
  })
  it('a yearly goal missing months inside the running year is not behind', () => {
    // Two closed years paid in full, and nothing paid so far this year: the months between due dates never count.
    const runs = [...months('2024-01', 24, 200, 200), ...months('2026-01', 9, 200, 0)]
    const s = getGoalStatus({ goal: goal(), current: 4800, runs, now: new Date(2026, 9, 18) })
    expect(s.kind).not.toBe('behind')
  })
  it('a yearly goal short on two closed years is behind, counted in years', () => {
    const runs = months('2024-01', 24, 200, 0)
    const s = getGoalStatus({ goal: goal(), current: 0, runs, now: new Date(2026, 0, 10) })
    expect(s.kind).toBe('behind')
    expect(s.params.count).toBe(2)
  })
  it('the coach dates the shortfall from the first month of the missed year', () => {
    const c = coachView({ goal: goal(), current: 0, runs: months('2024-01', 24, 200, 0), usualKeep: 1000, periodSavings: 12000, now: new Date(2026, 0, 10) })
    expect(c?.behindCount).toBe(2)
    expect(c?.since).toBe('2024-01')
  })
})

describe('yearly frequency: monthly equivalents', () => {
  it('a yearly fixed amount counts as a twelfth a month', () => {
    expect(goalMonthlyRate(goal({ monthlyContribution: 2400 }), null)).toBe(200)
  })
  it('hand-added money is counted in the year it landed', () => {
    const txs: SavingsTransaction[] = [{ id: 't', accountId: 'p', type: 'deposit', amount: 500, currency: 'EGP', date: '2025-07-04' }]
    const out = normalizeRuns({ goal: goal(), runs: [{ period: '2025', planned: 2400, amount: 1000 }], txs, baseToGoal: (n) => n, toGoal: (n) => n })
    expect(out[0]).toEqual({ period: '2025', planned: 2400, amount: 1500 })
  })
})

describe('yearly behind alert', () => {
  const input = {
    today: new Date(2026, 0, 10),
    goals: [goal()],
    runsByGoal: { g: months('2024-01', 24, 200, 0) },
    usualKeepFor: () => 1000,
    currentFor: () => 0,
    enabled: true,
  }
  it('fires once two years are missed and says so in years', () => {
    const [a] = evaluateGoalAlerts(input)
    expect(a).toMatchObject({ type: 'goal_behind', count: 2, quarterly: false, yearly: true })
    expect(renderGoalAlert(getServerDictionary('en'), a).body).toContain('2 years')
  })
  it('stays quiet while only months inside the running year are missed', () => {
    expect(evaluateGoalAlerts({ ...input, today: new Date(2026, 9, 18), runsByGoal: { g: [...months('2024-01', 24, 200, 200), ...months('2026-01', 9, 200, 0)] } })).toEqual([])
  })
})
