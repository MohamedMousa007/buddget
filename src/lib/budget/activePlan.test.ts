import { describe, expect, it } from 'vitest'
import { fallbackPlanId, selectActivePlan } from '@/lib/budget/activePlan'
import type { BudgetPlan } from '@/lib/store/types'

const plan = (id: string, status?: BudgetPlan['status']): BudgetPlan => ({
  id,
  name: id,
  categories: [],
  createdAt: '2026-01-01T00:00:00Z',
  status,
})

describe('selectActivePlan', () => {
  it('returns the plan matching the stored id', () => {
    expect(selectActivePlan([plan('a'), plan('b')], 'b')?.id).toBe('b')
  })
  it('falls back to the first live plan when the id is null or stale', () => {
    expect(selectActivePlan([plan('a'), plan('b')], null)?.id).toBe('a')
    expect(selectActivePlan([plan('a'), plan('b')], 'gone')?.id).toBe('a')
  })
  it('skips drafts and archived plans in the fallback', () => {
    expect(selectActivePlan([plan('d', 'draft'), plan('x', 'archived'), plan('r', 'ready')], null)?.id).toBe('r')
  })
  it('is null when there is no live plan', () => {
    expect(selectActivePlan([], null)).toBeNull()
    expect(selectActivePlan([plan('d', 'draft')], null)).toBeNull()
  })
})

describe('fallbackPlanId', () => {
  it('keeps the plan chrome reachable after the only live plan is deleted', () => {
    expect(fallbackPlanId([plan('d', 'draft'), plan('x', 'archived')], null)).toBe('d')
  })
  it('defers to the active plan and is empty with no plans', () => {
    expect(fallbackPlanId([plan('d', 'draft'), plan('a')], null)).toBeUndefined()
    expect(fallbackPlanId([], null)).toBeUndefined()
  })
})
