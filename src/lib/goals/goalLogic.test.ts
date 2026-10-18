import { describe, it, expect } from 'vitest'
import type { Goal } from '@/lib/store/types'
import { computePace, replanOptions } from './goalPlan'
import { allocateMonth } from './allocateMonth'
import { getGoalStatus } from './goalStatus'
import { detectFundingScenario, getUsualKeep } from './fundingScenario'

const now = new Date(2026, 9, 18) // Oct 2026
const goal = (o: Partial<Goal> = {}): Goal => ({
  id: 'g', name: 'Trip', emoji: '', category: 'vacation', targetAmount: 12000, currency: 'EGP',
  manualCurrentAmount: 0, targetDate: '2027-10-01', linkedSavingsAccountIds: [], linkedDebtIds: [],
  monthlySpendingLimit: null, priority: 0, status: 'active', monthlyContribution: null,
  fundingMode: 'share', sharePct: 50, frequency: 'monthly', planStart: null, notes: null,
  createdAt: '2026-01-01', achievedAt: null, ...o,
})

describe('computePace', () => {
  it('comfortable when ask fits usual keep', () => {
    const p = computePace({ target: 12000, saved: 0, targetDate: '2027-10-01', frequency: 'monthly', usualKeep: 1500, now })
    expect(p.periods).toBe(12)
    expect(p.asked).toBe(1000)
    expect(p.zone).toBe('comfortable')
    expect(p.altDate).toBeNull()
  })
  it('stretch offers a later date that fits', () => {
    const p = computePace({ target: 12000, saved: 0, targetDate: '2027-10-01', frequency: 'monthly', usualKeep: 800, now })
    expect(p.zone).toBe('stretch')
    expect(p.altDate).toBe('2028-01-01')
  })
  it('unknown keep hides zone', () => {
    expect(computePace({ target: 100, saved: 0, targetDate: '2027-01-01', frequency: 'monthly', usualKeep: null, now }).zone).toBe('unknown')
    expect(computePace({ target: 100, saved: 0, targetDate: '2027-01-01', frequency: 'monthly', usualKeep: 0, now }).zone).toBe('unknown')
  })
  it('past date and reached target never divide by zero', () => {
    const p = computePace({ target: 100, saved: 100, targetDate: '2020-01-01', frequency: 'monthly', usualKeep: 50, now })
    expect(p.periods).toBe(1)
    expect(p.asked).toBe(0)
  })
  it('quarterly compares against 3x usual keep', () => {
    const p = computePace({ target: 12000, saved: 0, targetDate: '2027-10-01', frequency: 'quarterly', usualKeep: 1000, now })
    expect(p.periods).toBe(4)
    expect(p.asked).toBe(3000)
    expect(p.zone).toBe('comfortable')
  })
  it('far-out alt date becomes a smaller target', () => {
    const p = computePace({ target: 1_000_000, saved: 0, targetDate: '2027-10-01', frequency: 'monthly', usualKeep: 100, now })
    expect(p.altDate).toBeNull()
    expect(p.altTarget).toBe(1200)
  })
})

describe('replanOptions', () => {
  it('offers both ways back', () => {
    const r = replanOptions({ remaining: 6000, targetDate: '2027-04-01', frequency: 'monthly', usualKeep: 500, periodSavings: 3000, now })
    expect(r.keepDate.perPeriod).toBe(1000)
    expect(r.keepDate.sharePct).toBe(35)
    expect(r.moveDate?.targetDate).toBe('2027-10-01')
  })
})

describe('allocateMonth', () => {
  it('fills by priority and lets shares exceed 100%', () => {
    const a = goal({ id: 'a', priority: 0, sharePct: 60 })
    const b = goal({ id: 'b', priority: 1, sharePct: 75 })
    const out = allocateMonth({ goals: [b, a], periodSavings: 1000, current: {} })
    expect(out).toEqual([
      { goalId: 'a', planned: 600, amount: 600 },
      { goalId: 'b', planned: 750, amount: 400 },
    ])
  })
  it('caps at target and skips manual/paused', () => {
    const a = goal({ id: 'a', sharePct: 100, targetAmount: 1000 })
    const m = goal({ id: 'm', fundingMode: 'manual' })
    const p = goal({ id: 'p', status: 'paused' })
    const out = allocateMonth({ goals: [a, m, p], periodSavings: 5000, current: { a: 900 } })
    expect(out).toEqual([{ goalId: 'a', planned: 5000, amount: 100 }])
  })
  it('zero savings allocates nothing', () => {
    const out = allocateMonth({ goals: [goal()], periodSavings: 0, current: {} })
    expect(out[0].amount).toBe(0)
  })
  it('fixed mode uses monthlyContribution', () => {
    const out = allocateMonth({ goals: [goal({ fundingMode: 'fixed', monthlyContribution: 300 })], periodSavings: 1000, current: {} })
    expect(out[0].amount).toBe(300)
  })
})

describe('getGoalStatus', () => {
  const run = (period: string, planned: number, amount: number) => ({ period, planned, amount })
  it('paused wins', () => {
    expect(getGoalStatus({ goal: goal({ status: 'paused' }), current: 0, runs: [], now }).kind).toBe('paused')
  })
  it('over limit', () => {
    const g = goal({ category: 'spending_control', monthlySpendingLimit: 1000, targetAmount: null })
    const s = getGoalStatus({ goal: g, current: 1320, runs: [], now })
    expect(s.kind).toBe('over')
    expect(s.params.amount).toBe(320)
  })
  it('limit goal under its limit shows what is left', () => {
    const g = goal({ category: 'spending_control', monthlySpendingLimit: 1000, targetAmount: null })
    const s = getGoalStatus({ goal: g, current: 400, runs: [], now })
    expect(s.kind).toBe('underLimit')
    expect(s.params.amount).toBe(600)
  })
  it('due within 30 days', () => {
    expect(getGoalStatus({ goal: goal({ targetDate: '2026-11-05' }), current: 0, runs: [], now }).kind).toBe('due')
  })
  it('behind needs a plan and 2 cycles', () => {
    const runs = [run('2026-07', 1000, 0), run('2026-08', 1000, 0), run('2026-09', 1000, 0)]
    const s = getGoalStatus({ goal: goal(), current: 0, runs, now })
    expect(s.kind).toBe('behind')
    expect(s.params.count).toBe(3)
    expect(getGoalStatus({ goal: goal({ fundingMode: 'manual' }), current: 0, runs, now }).kind).toBe('next')
    expect(getGoalStatus({ goal: goal(), current: 0, runs: runs.slice(0, 1), now }).kind).toBe('next')
  })
  it('one deposit away and streak', () => {
    const runs = [run('2026-07', 1000, 1000), run('2026-08', 1000, 1000), run('2026-09', 1000, 1000)]
    expect(getGoalStatus({ goal: goal(), current: 3000, runs, now }).kind).toBe('streak')
    expect(getGoalStatus({ goal: goal(), current: 11500, runs, now }).kind).toBe('oneDeposit')
  })
  it('next checkpoint', () => {
    const s = getGoalStatus({ goal: goal({ fundingMode: 'manual' }), current: 4000, runs: [], now })
    expect(s.params).toEqual({ pct: 50, toGo: 2000 })
  })
})

describe('funding scenario', () => {
  const ev = [{ receivedDate: '2026-08-25', status: 'confirmed' as const }]
  it('A, B, C', () => {
    expect(detectFundingScenario({ incomeEvents: ev, budgetCategories: [{ budgetedAmount: 5 }], budgetPlanCount: 0, currentMonth: '2026-10' })).toBe('A')
    expect(detectFundingScenario({ incomeEvents: ev, budgetCategories: [], budgetPlanCount: 0, currentMonth: '2026-10' })).toBe('B')
    expect(detectFundingScenario({ incomeEvents: [], budgetCategories: [], budgetPlanCount: 0, currentMonth: '2026-10' })).toBe('C')
  })
  it('usual keep', () => {
    expect(getUsualKeep({ scenario: 'A', budgetSavings: 12000, monthlyNets: [] })).toBe(12000)
    expect(getUsualKeep({ scenario: 'B', monthlyNets: [2000, 3000, 4000, -500] })).toBe(3000)
    expect(getUsualKeep({ scenario: 'B', monthlyNets: [-100, -200, -300] })).toBe(0)
    expect(getUsualKeep({ scenario: 'C', monthlyNets: [100] })).toBeNull()
    expect(getUsualKeep({ scenario: 'B', monthlyNets: [] })).toBeNull()
  })
})
