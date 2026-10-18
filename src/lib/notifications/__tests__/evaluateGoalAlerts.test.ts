import { describe, it, expect } from 'vitest'
import type { Goal } from '@/lib/store/types'
import { crossedCheckpoints, evaluateGoalAlerts, goalMilestoneAlert, renderGoalAlert } from '../evaluateGoalAlerts'
import { getServerDictionary } from '@/lib/i18n/getServerDictionary'

const today = new Date(2026, 9, 18)
const goal: Goal = {
  id: 'g', name: 'Vacation', emoji: '', category: 'vacation', targetAmount: 12000, currency: 'EGP',
  manualCurrentAmount: 0, targetDate: '2027-08-01', linkedSavingsAccountIds: [], linkedDebtIds: [],
  monthlySpendingLimit: null, priority: 0, status: 'active', monthlyContribution: null,
  fundingMode: 'share', sharePct: 40, frequency: 'monthly', planStart: null, notes: null,
  createdAt: '2026-01-01', achievedAt: null,
}
const behind = [
  { period: '2026-07', planned: 1000, amount: 0 },
  { period: '2026-08', planned: 1000, amount: 0 },
  { period: '2026-09', planned: 1000, amount: 0 },
]
const base = { today, goals: [goal], usualKeepFor: () => 1000, currentFor: () => 0, enabled: true }

describe('evaluateGoalAlerts', () => {
  it('alerts once a month after the second missed cycle', () => {
    const a = evaluateGoalAlerts({ ...base, runsByGoal: { g: behind } })
    expect(a).toHaveLength(1)
    expect(a[0].dedupeKey).toBe('goal_behind:g:2026-10')
    const next = evaluateGoalAlerts({ ...base, today: new Date(2026, 10, 2), runsByGoal: { g: behind } })
    expect(next[0].dedupeKey).toBe('goal_behind:g:2026-11')
  })
  it('stays quiet for one missed cycle, manual goals, paused goals and when disabled', () => {
    expect(evaluateGoalAlerts({ ...base, runsByGoal: { g: behind.slice(0, 1) } })).toEqual([])
    expect(evaluateGoalAlerts({ ...base, goals: [{ ...goal, fundingMode: 'manual' }], runsByGoal: { g: behind } })).toEqual([])
    expect(evaluateGoalAlerts({ ...base, goals: [{ ...goal, status: 'paused' }], runsByGoal: { g: behind } })).toEqual([])
    expect(evaluateGoalAlerts({ ...base, enabled: false, runsByGoal: { g: behind } })).toEqual([])
  })
  it('renders the decided copy', () => {
    const [a] = evaluateGoalAlerts({ ...base, runsByGoal: { g: behind } })
    const { body } = renderGoalAlert(getServerDictionary('en'), a)
    expect(body).toMatch(/^Vacation has been behind for 3 months\. Move the date to .+ or add EGP .+ a month\.$/)
  })
})

describe('milestones', () => {
  it('finds every checkpoint a deposit crosses', () => {
    expect(crossedCheckpoints(0, 300, 1000)).toEqual([25])
    expect(crossedCheckpoints(200, 800, 1000)).toEqual([25, 50, 75])
    expect(crossedCheckpoints(500, 500, 1000)).toEqual([])
    expect(crossedCheckpoints(900, 1000, 1000)).toEqual([100])
    expect(crossedCheckpoints(0, 10, 0)).toEqual([])
  })
  it('completion is its own alert type', () => {
    expect(goalMilestoneAlert(goal, 100, 12000).type).toBe('goal_achieved')
    expect(goalMilestoneAlert(goal, 50, 6000).dedupeKey).toBe('goal_milestone:g:50')
  })
})
