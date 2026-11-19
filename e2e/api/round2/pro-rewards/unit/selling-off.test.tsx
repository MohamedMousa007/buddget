// S8g: what every Pro, Rewards, Invite and Founders surface does while selling is OFF (billing.enabled = false), with the switch
// mocked. Live is ON (S8C-06), so this is the only way to check the OFF side without touching platform_settings.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ enabled: false, rpc: vi.fn(), from: vi.fn(), navigate: vi.fn() }))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: async () => 'u1', resolveActiveApiIdentity: async () => ({ id: 'u1' }) }))
vi.mock('@/lib/entitlements/billingSwitch', () => ({ billingEnabled: async () => h.enabled }))
vi.mock('@/lib/server/platformCache', () => ({ cachedSetting: async (_k: unknown, f: () => Promise<unknown>) => f() }))
vi.mock('@/lib/entitlements/server', () => ({ getUserEntitlements: async () => ({ planKey: 'free', planName: 'Free', status: 'active', trialEndsAt: null }) }))
vi.mock('@/lib/navigation/navigate', () => ({ navigate: h.navigate }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    rpc: h.rpc,
    from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [{ product_id: 'sparks_60', sparks: 60, countries: ['EG'] }], error: null }), eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'qa@example.test', email_confirmed_at: '2026-11-01T00:00:00Z' } } }) } },
  }),
}))

const STATE = { usage: { sparksLeft: 5 }, subscription: { status: 'active', source: 'default' }, history: [], proThisMonth: {}, rewards: { tier: { key: 'silver' }, streak: { current: 0 }, freezes: { banked: 0 }, points: { lifetime: 0 }, founder: null, betaTester: false, invite: { enabled: true, code: 'AB-123', link: 'https://buddget.app/i/AB-123' } } }

beforeEach(() => {
  h.enabled = false
  h.navigate.mockReset()
  h.rpc.mockReset().mockImplementation(async (fn: string) => ({ data: fn === 'entitlements_state' ? STATE : fn === 'trial_claim' ? { status: 'billing_off' } : fn === 'api_rate_hit' ? true : null, error: null }))
})

describe('routes with selling OFF', () => {
  it('OFF1 /api/entitlements/me says billingEnabled false, no packs, no usage, no Sparks', async () => {
    const { GET } = await import('@/app/api/entitlements/me/route')
    const body = await (await GET(new Request('http://x/api/entitlements/me'))).json()
    expect(body).toMatchObject({ billingEnabled: false, sparkProducts: [], usage: null, sparks: null })
  })
  it('OFF1b and with selling ON the same read lists the packs', async () => {
    h.enabled = true
    const { GET } = await import('@/app/api/entitlements/me/route')
    const body = await (await GET(new Request('http://x/api/entitlements/me'))).json()
    expect(body.billingEnabled).toBe(true)
    expect(body.sparkProducts.length).toBeGreaterThan(0)
  })
  it('OFF2 /api/billing/paywall-view records nothing', async () => {
    const { POST } = await import('@/app/api/billing/paywall-view/route')
    expect(await (await POST(new Request('http://x', { method: 'POST', body: '{}' }))).json()).toEqual({ ok: true, recorded: false })
    expect(h.rpc.mock.calls.filter(([f]) => f === 'record_paywall_view')).toHaveLength(0)
  })
  it('OFF3 /api/entitlements/trial passes the database answer billing_off through (no grant)', async () => {
    const { POST } = await import('@/app/api/entitlements/trial/route')
    expect((await (await POST(new Request('http://x', { method: 'POST' }))).json()).status).toBe('billing_off')
  })
  it('OFF4 S8G-12 /api/billing/stay-offer does not check the switch (it answers from the plan alone)', async () => {
    h.rpc.mockImplementation(async () => ({ data: { status: 'active', source: 'apple', product_id: 'pro_monthly', redeemed_at: null, lapsed_recently: false }, error: null }))
    const { GET } = await import('@/app/api/billing/stay-offer/route')
    const body = await (await GET(new Request('http://x'))).json()
    // Recorded as found: with selling off a store subscriber is still offered a discount. Expected by the plan: no offer while off.
    expect(body.eligible).toBe(true)
  })
})
