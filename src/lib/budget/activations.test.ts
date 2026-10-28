import { describe, expect, it } from 'vitest'
import { cycleKeyOf, planForMonth, planHistory, recordActivation } from '@/lib/budget/activations'
import type { BudgetPlan, BudgetPlanActivation } from '@/lib/store/types'

const plan = (id: string): BudgetPlan => ({ id, name: id, categories: [], createdAt: '2026-01-01T00:00:00Z' })
const act = (planId: string, key: string): BudgetPlanActivation => ({ id: `${planId}-${key}`, planId, effectiveFrom: `${key}-01`, createdAt: '' })
const plans = [plan('aug'), plan('sep'), plan('oct')]
const log = [act('aug', '2026-07'), act('sep', '2026-09'), act('oct', '2026-10')]

describe('cycleKeyOf', () => {
  it('uses the calendar month for day 1', () => {
    expect(cycleKeyOf(new Date(2026, 9, 19), 1)).toBe('2026-10')
  })
  it('belongs to the previous cycle before the start day', () => {
    expect(cycleKeyOf(new Date(2026, 9, 3), 25)).toBe('2026-09')
    expect(cycleKeyOf(new Date(2026, 9, 25), 25)).toBe('2026-10')
  })
})

describe('planForMonth', () => {
  it('returns the latest activation at or before the month', () => {
    expect(planForMonth(plans, log, '2026-08', null)?.id).toBe('aug')
    expect(planForMonth(plans, log, '2026-09', null)?.id).toBe('sep')
    expect(planForMonth(plans, log, '2026-12', null)?.id).toBe('oct')
  })
  it('uses the first plan for months before any activation', () => {
    expect(planForMonth(plans, log, '2026-01', null)?.id).toBe('aug')
  })
  it('skips activations of deleted plans', () => {
    expect(planForMonth([plan('aug'), plan('oct')], log, '2026-09', null)?.id).toBe('aug')
  })
  it('lets an explicit active plan govern months after the last activation', () => {
    expect(planForMonth(plans, log, '2026-12', 'sep')?.id).toBe('sep')
    expect(planForMonth(plans, log, '2026-10', 'sep')?.id).toBe('sep')
    expect(planForMonth(plans, log, '2026-09', 'aug')?.id).toBe('sep')
  })
  it('falls back to the stored active plan with no history', () => {
    expect(planForMonth(plans, [], '2026-10', 'sep')?.id).toBe('sep')
  })
})

describe('recordActivation', () => {
  it('replaces a switch made in the same cycle', () => {
    const next = recordActivation(log, 'aug', '2026-10', () => 'n', 'now')
    expect(next.filter((a) => a.effectiveFrom === '2026-10-01')).toEqual([expect.objectContaining({ planId: 'aug', id: 'n' })])
    expect(next).toHaveLength(3)
  })
  it('switching back to the plan already in force leaves no duplicate span', () => {
    const next = recordActivation([act('aug', '2026-07'), act('sep', '2026-10')], 'aug', '2026-10', () => 'n', 'now')
    expect(next.map((a) => [a.planId, a.effectiveFrom])).toEqual([['aug', '2026-07-01']])
  })
  it('appends a new cycle', () => {
    expect(recordActivation(log, 'sep', '2026-11', () => 'n', 'now')).toHaveLength(4)
  })
})

describe('planHistory', () => {
  it('lists stretches newest first with the open one ending null', () => {
    const h = planHistory(plans, log)
    expect(h.map((s) => [s.plan.id, s.fromKey, s.toKey])).toEqual([
      ['oct', '2026-10', null],
      ['sep', '2026-09', '2026-09'],
      ['aug', '2026-07', '2026-08'],
    ])
  })
})
