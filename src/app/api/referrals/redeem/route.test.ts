import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  uid: 'u1' as string | null,
  user: null as Record<string, unknown> | null,
  limited: new Set<string>(),
  rpc: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveActiveApiIdentity: async () => (h.uid ? { id: h.uid } : null) }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: async (_s: unknown, key: string) => [...h.limited].some((k) => key.startsWith(k)) }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({ auth: { admin: { getUserById: async () => ({ data: { user: h.user }, error: null }) } }, rpc: h.rpc }),
}))

import { POST } from './route'

const call = (body: unknown = { code: 'AB-CDE', deviceId: 'dev-1' }, headers: Record<string, string> = { 'x-real-ip': '41.33.10.7' }) =>
  POST(new Request('http://x/api/referrals/redeem', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers }))

beforeEach(() => {
  h.uid = 'u1'
  h.user = { email: 'First.Last+x@gmail.com', email_confirmed_at: '2026-11-01T00:00:00Z', is_anonymous: false }
  h.limited.clear()
  delete process.env.TRIAL_CLAIM_KEY_SECRET
  h.rpc.mockReset().mockResolvedValue({ data: { status: 'ok', trialExtended: false }, error: null })
})

describe('POST /api/referrals/redeem', () => {
  it('refuses an unauthenticated caller and a bad body without touching the database', async () => {
    h.uid = null
    expect((await call()).status).toBe(401)
    h.uid = 'u1'
    expect((await call('not json')).status).toBe(400)
    expect((await call({ code: 'x'.repeat(65) })).status).toBe(400)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('redeems under the server-built mailbox key and the caller address, never a client-supplied identity', async () => {
    expect(await (await call()).json()).toEqual({ status: 'ok', trialExtended: false })
    expect(h.rpc).toHaveBeenCalledWith('referral_redeem', { p_user: 'u1', p_code: 'AB-CDE', p_device_id: 'dev-1', p_mailbox_key: 'firstlast@gmail.com', p_legacy_key: undefined, p_ip: '41.33.10.7' })
  })

  it('with the key secret, sends the keyed hash and the plain key as legacy (same key as the trial)', async () => {
    process.env.TRIAL_CLAIM_KEY_SECRET = 's3cret'
    await call()
    const args = h.rpc.mock.calls[0]![1] as Record<string, string>
    expect(args.p_mailbox_key).toMatch(/^[0-9a-f]{64}$/)
    expect(args.p_legacy_key).toBe('firstlast@gmail.com')
  })

  it('refuses unverified and disposable mailboxes before the database', async () => {
    h.user = { email: 'a@b.co', email_confirmed_at: null, is_anonymous: false }
    expect((await (await call()).json()).status).toBe('unverified')
    h.user = { email: 'x@sub.mailinator.com', email_confirmed_at: '2026-11-01T00:00:00Z', is_anonymous: false }
    expect((await (await call()).json()).status).toBe('disposable_email')
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('answers 429 over the per-user or per-address limit, so the app keeps the code and retries', async () => {
    h.limited.add('referral-redeem:')
    expect((await call()).status).toBe(429)
    h.limited.clear(); h.limited.add('referral-redeem-ip:')
    expect((await call()).status).toBe(429)
    expect((await call(undefined, {})).status).toBe(200)
    expect(h.rpc).toHaveBeenCalledTimes(1)
  })

  it('answers 503 when the database fails (retryable), not a final status', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'down' } })
    expect((await call()).status).toBe(503)
  })
})
