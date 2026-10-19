import { describe, expect, it } from 'vitest'
import { resolveEntitlements, type EntitlementRecord, type PlanRecord } from './resolve'

const free: PlanRecord = { key: 'free', name: 'Free', limits: { ai_budget_per_hour: 15 }, features: ['sms_tracking'], trial_days: 0 }
const plus: PlanRecord = { key: 'plus', name: 'Plus', limits: { ai_budget_per_hour: 60, receipt_scans_per_month: null }, features: ['ai_assistant'], trial_days: 14 }
const plans = new Map([['free', free], ['plus', plus]])
const now = Date.parse('2026-10-19T12:00:00Z')

const ent = (over: Partial<EntitlementRecord>): EntitlementRecord => ({
  plan_key: 'plus', status: 'active', trial_ends_at: null, current_period_end: null, limit_overrides: {}, feature_overrides: {}, ...over,
})

describe('resolveEntitlements', () => {
  it('puts users with no row on the default plan', () => {
    const r = resolveEntitlements(free, null, plans, now)
    expect(r.planKey).toBe('free')
    expect(r.limits.ai_budget_per_hour).toBe(15)
    expect(r.limits.ai_chat_per_day).toBeNull()
  })

  it('applies the entitled plan', () => {
    const r = resolveEntitlements(free, ent({}), plans, now)
    expect(r.planKey).toBe('plus')
    expect(r.limits.ai_budget_per_hour).toBe(60)
    expect(r.features).toEqual(['ai_assistant'])
  })

  it('lets an override beat the plan, including unlimited', () => {
    const r = resolveEntitlements(free, ent({ limit_overrides: { ai_budget_per_hour: null, budget_plans_max: 3 } }), plans, now)
    expect(r.limits.ai_budget_per_hour).toBeNull()
    expect(r.limits.budget_plans_max).toBe(3)
  })

  it('drops to the default plan when a trial lapses, but keeps individual overrides', () => {
    const r = resolveEntitlements(free, ent({ status: 'trialing', trial_ends_at: '2026-10-18T00:00:00Z', limit_overrides: { ai_budget_per_hour: 99 } }), plans, now)
    expect(r.status).toBe('expired')
    expect(r.planKey).toBe('free')
    expect(r.limits.ai_budget_per_hour).toBe(99)
  })

  it('keeps a running trial on its plan', () => {
    const r = resolveEntitlements(free, ent({ status: 'trialing', trial_ends_at: '2026-10-25T00:00:00Z' }), plans, now)
    expect(r.status).toBe('trialing')
    expect(r.planKey).toBe('plus')
  })

  it('expires a paid period that ran out', () => {
    expect(resolveEntitlements(free, ent({ current_period_end: '2026-10-01T00:00:00Z' }), plans, now).planKey).toBe('free')
  })

  it('applies feature overrides in both directions', () => {
    const r = resolveEntitlements(free, ent({ feature_overrides: { ai_assistant: false, data_export: true } }), plans, now)
    expect(r.features).toEqual(['data_export'])
  })

  it('ignores malformed override values', () => {
    expect(resolveEntitlements(free, ent({ limit_overrides: { ai_budget_per_hour: 'lots' } }), plans, now).limits.ai_budget_per_hour).toBe(60)
  })
})
