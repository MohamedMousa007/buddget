import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn(), user: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null, billing: true }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveActiveApiIdentity: async () => h.user }))
vi.mock('@/lib/entitlements/billingSwitch', () => ({ billingEnabled: async () => h.billing }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc: h.rpc }) }))

import { POST } from './route'

const USER = '11111111-1111-4111-8111-111111111111'
const STARTS = Date.UTC(2026, 10, 20, 11, 58, 0, 417)
const ENDS = Date.UTC(2026, 11, 20, 11, 58, 0, 417)
const MONTHLY = 'prodc5ccfbb979'

/** A REST v2 Subscription as the docs show it: RevenueCat product id, ms timestamps, entitlements listing products with store ids. */
const sub = (over: Record<string, unknown> = {}) => ({
  object: 'subscription', id: 'sub1a2b3c', customer_id: USER, original_customer_id: USER, product_id: MONTHLY,
  starts_at: STARTS, current_period_starts_at: STARTS, current_period_ends_at: ENDS, ends_at: ENDS,
  gives_access: true, pending_payment: false, auto_renewal_status: 'will_renew', status: 'active',
  total_revenue_in_usd: { currency: 'USD', gross: 4.99, commission: 0.75, tax: 0, proceeds: 4.24 },
  presented_offering_id: 'default', environment: 'sandbox', store: 'app_store', store_subscription_identifier: '2000000123456789',
  ownership: 'purchased', pending_changes: null, country: 'EG', management_url: 'https://apps.apple.com/account/subscriptions',
  entitlements: { object: 'list', items: [{ object: 'entitlement', id: 'entla1b2c3', lookup_key: 'pro', display_name: 'Pro',
    products: { object: 'list', items: [{ object: 'product', id: MONTHLY, store_identifier: 'pro_monthly', type: 'subscription' }], next_page: null } }], next_page: null },
  ...over,
})
const list = (...items: unknown[]) => ({ object: 'list', items, next_page: null, url: `/v2/projects/projb9480b99/customers/${USER}/subscriptions` })
const fetchMock = vi.fn()
const call = () => POST(new Request('http://x/api/billing/sync', { method: 'POST' }))
const applied = () => h.rpc.mock.calls.filter(([fn]) => fn === 'billing_apply').map(([, args]) => args)
const answer = (body: unknown) => fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body })

beforeEach(() => {
  h.user = { id: USER }
  h.billing = true
  h.rpc.mockReset().mockImplementation(async (fn: string) => ({ data: fn === 'api_rate_hit' ? true : 'applied', error: null }))
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => list(sub()) })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('REVENUECAT_SECRET_KEY', 'sk_test')
  vi.stubEnv('REVENUECAT_PROJECT_ID', '')
  vi.stubEnv('REVENUECAT_IGNORE_SANDBOX', '')
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('POST /api/billing/sync (BDG-019 on-demand store read, REST v2)', () => {
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

  it('reads only the signed-in customer\'s subscriptions in the project, with the Bearer key', async () => {
    await call()
    expect(fetchMock).toHaveBeenCalledWith(`https://api.revenuecat.com/v2/projects/projb9480b99/customers/${USER}/subscriptions?limit=100`, expect.objectContaining({ headers: { Authorization: 'Bearer sk_test' } }))
    expect(h.rpc).toHaveBeenCalledWith('api_rate_hit', { p_key: `billing-sync:${USER}`, p_window_seconds: 60, p_max_hits: 6 })
    vi.stubEnv('REVENUECAT_PROJECT_ID', 'projother')
    await call()
    expect(fetchMock.mock.calls[1][0]).toContain('/v2/projects/projother/')
  })

  it('a live store subscription goes through billing_apply at its period start, under a type the history does not list', async () => {
    expect(await (await call()).json()).toEqual({ ok: true, outcome: 'applied' })
    const [args] = applied()
    expect(args.p_type).toBe('SYNC_PURCHASE')
    expect(args.p_event_ms).toBe(STARTS)
    expect(args.p_event_id).toBe(`sync:${USER}:pro_monthly:${STARTS}:active`)
    expect(args.p_effect).toMatchObject({
      entitlement: { plan_key: 'plus', status: 'active', source: 'apple', store: 'app_store', product_id: 'pro_monthly', will_renew: true, current_period_end: new Date(ENDS).toISOString(), store_original_txn: null },
      endTrial: false,
      country: 'EG',
      receipt: { store: 'app_store', product_id: 'pro_monthly', price_micros: null, currency: null },
    })
    // Sparks stay with the webhook: a second plan period would open unless both paths stamped the exact same start.
    expect(args.p_effect.sparks).toBeUndefined()
  })

  it('finds the store id through the catalogue when the entitlements do not list the product', async () => {
    answer(list(sub({ product_id: 'prod0ad078c15f', entitlements: { object: 'list', items: [], next_page: null } })))
    await call()
    expect(applied()[0].p_effect.entitlement.product_id).toBe('pro_annual')
  })

  it('a repeat tap sends the same event id, so billing_apply answers duplicate and grants nothing twice', async () => {
    await call()
    h.rpc.mockImplementation(async (fn: string) => ({ data: fn === 'api_rate_hit' ? true : 'duplicate', error: null }))
    expect(await (await call()).json()).toEqual({ ok: true, outcome: 'duplicate' })
    expect(applied()[0].p_event_id).toBe(applied()[1].p_event_id)
  })

  it('writes nothing without live Pro: no access, promotional, a Sparks product, an unknown product, or no customer', async () => {
    answer(list(
      sub({ gives_access: false, status: 'expired' }),
      sub({ store: 'promotional', product_id: null }),
      sub({ product_id: 'prodd147bde401', entitlements: null }),
      sub({ product_id: 'prod_unknown', entitlements: null }),
    ))
    expect(await (await call()).json()).toEqual({ ok: true, outcome: 'none' })
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ type: 'resource_missing' }) })
    expect(await (await call()).json()).toEqual({ ok: true, outcome: 'none' })
    expect(applied()).toHaveLength(0)
  })

  it('keeps a renewal turned off and a billing problem as the store shows them, each under its own event id', async () => {
    answer(list(sub({ auto_renewal_status: 'will_not_renew' })))
    await call()
    expect(applied()[0].p_effect.entitlement).toMatchObject({ status: 'canceled', will_renew: false })
    expect(applied()[0].p_event_id).toMatch(/:canceled$/)
    const graceEnd = Date.UTC(2026, 11, 26)
    answer(list(sub({ status: 'in_grace_period', ends_at: graceEnd })))
    await call()
    expect(applied()[1].p_effect.entitlement).toMatchObject({ status: 'past_due', grace_ends_at: new Date(graceEnd).toISOString() })
    expect(applied()[1].p_event_id).toMatch(/:issue$/)
  })

  it('honours REVENUECAT_IGNORE_SANDBOX like the webhook, reading environment', async () => {
    vi.stubEnv('REVENUECAT_IGNORE_SANDBOX', '1')
    expect(await (await call()).json()).toEqual({ ok: true, outcome: 'ignored' })
    answer(list(sub({ environment: 'production' })))
    expect(await (await call()).json()).toEqual({ ok: true, outcome: 'applied' })
  })

  it('answers 429 past the per-user limit, 502 when RevenueCat fails, and nothing while billing is off', async () => {
    h.rpc.mockImplementation(async (fn: string) => ({ data: fn === 'api_rate_hit' ? false : 'applied', error: null }))
    expect((await call()).status).toBe(429)
    h.rpc.mockImplementation(async (fn: string) => ({ data: fn === 'api_rate_hit' ? true : 'applied', error: null }))
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
    expect((await call()).status).toBe(502)
    h.billing = false
    expect(await (await call()).json()).toEqual({ ok: true, outcome: 'billing_off' })
    expect(applied()).toHaveLength(0)
  })
})
