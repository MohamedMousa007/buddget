import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  sourceRow: null as Record<string, unknown> | null,
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    rpc: h.rpc,
    from: () => ({ select: () => ({ eq: () => Object.assign(Promise.resolve({ data: [], error: null }), { maybeSingle: async () => ({ data: h.sourceRow, error: null }) }) }) }),
  }),
}))

import { POST } from './route'

const USER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const NOW = Date.now()
const AUTH = 'auth-secret'
const HMAC = 'hmac-secret'

function post(event: Record<string, unknown>, over: { auth?: string; ts?: number; sign?: string; raw?: string } = {}) {
  const raw = over.raw ?? JSON.stringify({ api_version: '1.0', event })
  const ts = String(over.ts ?? Math.floor(NOW / 1000))
  const sig = createHmac('sha256', over.sign ?? HMAC).update(`${ts}.${raw}`).digest('hex')
  return POST(new Request('http://x/api/billing/revenuecat', {
    method: 'POST', body: raw,
    headers: { authorization: over.auth ?? `Bearer ${AUTH}`, 'x-revenuecat-webhook-signature': `t=${ts},v1=${sig}` },
  }))
}
const purchase = { type: 'INITIAL_PURCHASE', id: 'e1', app_user_id: USER, product_id: 'plus_monthly', store: 'APP_STORE', event_timestamp_ms: NOW, purchased_at_ms: NOW, expiration_at_ms: NOW + 30 * 86_400_000, original_transaction_id: 'o1' }

beforeEach(() => {
  process.env.REVENUECAT_WEBHOOK_AUTH = AUTH
  process.env.REVENUECAT_WEBHOOK_HMAC_SECRET = HMAC
  h.sourceRow = null
  h.rpc.mockReset().mockResolvedValue({ data: 'applied', error: null })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('POST /api/billing/revenuecat', () => {
  it('fails closed while the secrets are not configured', async () => {
    delete process.env.REVENUECAT_WEBHOOK_HMAC_SECRET
    expect((await post(purchase)).status).toBe(503)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('refuses a wrong secret, a bad signature and a stale timestamp without touching the database', async () => {
    expect((await post(purchase, { auth: 'Bearer nope' })).status).toBe(401)
    expect((await post(purchase, { sign: 'other' })).status).toBe(401)
    expect((await post(purchase, { ts: Math.floor(NOW / 1000) - 3600 })).status).toBe(401)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('answers 400 to a body that is not JSON or not an event', async () => {
    expect((await post(purchase, { raw: 'not json' })).status).toBe(400)
    expect((await post({}, { raw: JSON.stringify({ event: {} }) })).status).toBe(400)
  })

  it('applies a purchase once through billing_apply with the planned effect', async () => {
    const res = await post(purchase)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, outcome: 'applied' })
    const [fn, args] = h.rpc.mock.calls[0]!
    expect(fn).toBe('billing_apply')
    expect(args).toMatchObject({ p_user: USER, p_event_id: 'e1', p_type: 'INITIAL_PURCHASE', p_event_ms: NOW })
    expect(args.p_effect.entitlement).toMatchObject({ plan_key: 'plus', status: 'active', source: 'apple' })
    expect(args.p_effect.sparks).toMatchObject({ action: 'open', ref: 'store:monthly' })
  })

  it('answers 200 to a replayed event and to a stale one, so the sender stops retrying', async () => {
    h.rpc.mockResolvedValue({ data: 'duplicate', error: null })
    expect(await (await post(purchase)).json()).toEqual({ ok: true, outcome: 'duplicate' })
    h.rpc.mockResolvedValue({ data: 'stale', error: null })
    expect(await (await post({ ...purchase, id: 'e0', event_timestamp_ms: NOW - 1000 })).json()).toEqual({ ok: true, outcome: 'stale' })
  })

  it('records and ignores an event that does nothing here (a test event, a product that is not Plus)', async () => {
    h.rpc.mockResolvedValue({ data: null, error: null })
    expect((await post({ ...purchase, type: 'TEST' })).status).toBe(200)
    expect((await post({ ...purchase, id: 'e2', product_id: 'other' })).status).toBe(200)
    expect(h.rpc.mock.calls.every(([fn]) => fn === 'billing_note')).toBe(true)
  })

  it('answers 500 on a database failure so RevenueCat retries, but 200 for a user that does not exist', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'down', code: '57P01' } })
    expect((await post(purchase)).status).toBe(500)
    h.rpc.mockResolvedValue({ data: null, error: { message: 'fk', code: '23503' } })
    expect(await (await post(purchase)).json()).toEqual({ ok: true, outcome: 'unknown_user' })
  })

  it('a transfer copies the subscription the old user held to the new one', async () => {
    h.sourceRow = { plan_key: 'plus', status: 'active', source: 'apple', trial_ends_at: null, current_period_end: '2027-01-01T00:00:00.000Z', canceled_at: null, will_renew: true, product_id: 'plus_monthly', store: 'app_store', store_original_txn: 'o9', grace_ends_at: null }
    await post({ type: 'TRANSFER', id: 'e3', app_user_id: OTHER, event_timestamp_ms: NOW, transferred_from: [USER], transferred_to: [OTHER] })
    const args = h.rpc.mock.calls[0]![1]
    expect(args.p_user).toBe(OTHER)
    expect(args.p_effect.transfer).toEqual({ from: [USER] })
    expect(args.p_effect.entitlement).toMatchObject({ store_original_txn: 'o9', status: 'active' })
    expect(args.p_effect.sparks).toBeUndefined()
  })
})
