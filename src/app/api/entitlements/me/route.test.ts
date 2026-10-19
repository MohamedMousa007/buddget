import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ uid: 'u1' as string | null, plans: [] as unknown[], ent: null as unknown }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: async () => state.uid }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: (t: string) => ({
      select: () => (t === 'plans' ? Promise.resolve({ data: state.plans }) : { eq: () => ({ maybeSingle: async () => ({ data: state.ent }) }) }),
    }),
  }),
}))

import { GET } from './route'

const plans = [
  { key: 'free', name: 'Free', limits: { ai_budget_per_hour: 15 }, features: [], trial_days: 0, is_default: true },
  { key: 'pro', name: 'Pro', limits: { ai_budget_per_hour: 100 }, features: ['ai_assistant'], trial_days: 14, is_default: false },
]

describe('GET /api/entitlements/me', () => {
  it('rejects unauthenticated callers', async () => {
    state.uid = null
    expect((await GET(new Request('http://x'))).status).toBe(401)
    state.uid = 'u1'
  })

  it('puts users without an entitlement on the default plan, uncached', async () => {
    state.plans = plans
    state.ent = null
    const res = await GET(new Request('http://x'))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect((await res.json()).planKey).toBe('free')
  })

  it('falls back to the default plan when a trial has lapsed', async () => {
    state.plans = plans
    state.ent = { plan_key: 'pro', status: 'trialing', trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(), current_period_end: null, limit_overrides: {}, feature_overrides: {} }
    expect((await (await GET(new Request('http://x'))).json()).planKey).toBe('free')
  })

  it('honours an active paid plan', async () => {
    state.plans = plans
    state.ent = { plan_key: 'pro', status: 'active', trial_ends_at: null, current_period_end: new Date(Date.now() + 86_400_000).toISOString(), limit_overrides: {}, feature_overrides: {} }
    expect((await (await GET(new Request('http://x'))).json()).planKey).toBe('pro')
  })
})
