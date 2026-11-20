import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn(), user: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null, billing: true }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveActiveApiIdentity: async () => h.user }))
vi.mock('@/lib/entitlements/billingSwitch', () => ({ billingEnabled: async () => h.billing }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc: h.rpc }) }))

import { POST } from './route'

const USER = '11111111-1111-4111-8111-111111111111'
const NOW = Date.UTC(2026, 10, 20, 12)
const PURCHASED = '2026-11-20T11:58:00Z'
const sub = (over: Record<string, unknown> = {}) => ({
  purchase_date: PURCHASED, expires_date: '2026-12-20T11:58:00Z', store: 'app_store', is_sandbox: true,
  unsubscribe_detected_at: null, billing_issues_detected_at: null, grace_period_expires_date: null, refunded_at: null,
  price: { amount: 4.99, currency: 'USD' }, ...over,
})
const customer = (subscriptions: Record<string, unknown>) => ({ request_date_ms: NOW, subscriber: { subscriptions } })
const fetchMock = vi.fn()
const call = () => POST(new Request('http://x/api/billing/sync', { method: 'POST' }))
const applied = () => h.rpc.mock.calls.filter(([fn]) => fn === 'billing_apply').map(([, args]) => args)

beforeEach(() => {
  h.user = { id: USER }
  h.billing = true
  h.rpc.mockReset().mockImplementation(async (fn: string) => ({ data: fn === 'api_rate_hit' ? true : 'applied', error: null }))
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => customer({ pro_monthly: sub() }) })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('REVENUECAT_SECRET_KEY', 'sk_test')
  vi.stubEnv('REVENUECAT_IGNORE_SANDBOX', '')
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('POST /api/billing/sync (BDG-019 on-demand store read)', () => {
  it('refuses without a session and reads nobody', async () => {
    h.user = null
    expect((await call()).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 503 without the server key, so the app keeps "Confirming with the store"', async () => {
    vi.stubEnv('REVENUECAT_SECRET_KEY', '')
    expect((await call()).status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reads only the signed-in customer, with the secret key', async () => {
    await call()
    expect(fetchMock).toHaveBeenCalledWith(`https://api.revenuecat.com/v1/subscribers/${USER}`, expect.objectContaining({ headers: { Authorization: 'Bearer sk_test' } }))
    expect(h.rpc).toHaveBeenCalledWith('api_rate_hit', { p_key: `billing-sync:${USER}`, p_window_seconds: 60, p_max_hits: 6 })
  })

  it('a live store subscription goes through billing_apply at its purchase time, under a type the history does not list', async () => {
    const res = await call()
    expect(await res.json()).toEqual({ ok: true, outcome: 'applied' })
    const [args] = applied()
    expect(args.p_type).toBe('SYNC_PURCHASE')
    expect(['INITIAL_PURCHASE', 'RENEWAL']).not.toContain(args.p_type)
    expect(args.p_event_ms).toBe(Date.parse(PURCHASED))
    expect(args.p_event_id).toBe(`sync:${USER}:pro_monthly:${Date.parse(PURCHASED)}:active`)
    expect(args.p_effect).toMatchObject({
      entitlement: { plan_key: 'plus', status: 'active', source: 'apple', store: 'app_store', will_renew: true, current_period_end: '2026-12-20T11:58:00.000Z' },
      endTrial: false,
      receipt: { price_micros: 4_990_000, currency: 'USD' },
    })
    // Sparks stay with the webhook: a second-precision purchase date would open a second period beside the webhook's.
    expect(args.p_effect.sparks).toBeUndefined()
  })

  it('a repeat tap sends the same event id, so billing_apply answers duplicate and grants nothing twice', async () => {
    await call()
    h.rpc.mockImplementation(async (fn: string) => ({ data: fn === 'api_rate_hit' ? true : 'duplicate', error: null }))
    expect(await (await call()).json()).toEqual({ ok: true, outcome: 'duplicate' })
    expect(applied()[0].p_event_id).toBe(applied()[1].p_event_id)
  })

  it('writes nothing when RevenueCat has no live Pro: expired, refunded, promotional, or another product', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => customer({
      pro_monthly: sub({ expires_date: '2026-11-19T00:00:00Z' }),
      pro_annual: sub({ refunded_at: '2026-11-20T00:00:00Z' }),
      'pro_annual:promo': sub({ store: 'promotional' }),
      sparks_100: sub(),
    }) })
    expect(await (await call()).json()).toEqual({ ok: true, outcome: 'none' })
    expect(applied()).toHaveLength(0)
  })

  it('keeps a cancelled renewal and a billing problem as the store shows them', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => customer({ pro_annual: sub({ unsubscribe_detected_at: '2026-11-20T11:59:00Z' }) }) })
    await call()
    expect(applied()[0].p_effect.entitlement).toMatchObject({ status: 'canceled', will_renew: false, canceled_at: '2026-11-20T11:59:00.000Z' })
    expect(applied()[0].p_event_id).toMatch(/:canceled$/)
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => customer({ pro_monthly: sub({ billing_issues_detected_at: '2026-11-20T11:59:00Z', grace_period_expires_date: '2026-11-26T00:00:00Z' }) }) })
    await call()
    expect(applied()[1].p_effect.entitlement).toMatchObject({ status: 'past_due', grace_ends_at: '2026-11-26T00:00:00.000Z' })
    expect(applied()[1].p_event_id).toMatch(/:issue$/)
  })

  it('honours REVENUECAT_IGNORE_SANDBOX like the webhook', async () => {
    vi.stubEnv('REVENUECAT_IGNORE_SANDBOX', '1')
    expect(await (await call()).json()).toEqual({ ok: true, outcome: 'ignored' })
    expect(applied()).toHaveLength(0)
  })

  it('answers 429 past the per-user limit, 502 when RevenueCat fails, and nothing while billing is off', async () => {
    h.rpc.mockImplementation(async (fn: string) => ({ data: fn === 'api_rate_hit' ? false : 'applied', error: null }))
    expect((await call()).status).toBe(429)
    h.rpc.mockImplementation(async (fn: string) => ({ data: fn === 'api_rate_hit' ? true : 'applied', error: null }))
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    expect((await call()).status).toBe(502)
    h.billing = false
    expect(await (await call()).json()).toEqual({ ok: true, outcome: 'billing_off' })
    expect(applied()).toHaveLength(0)
  })
})
