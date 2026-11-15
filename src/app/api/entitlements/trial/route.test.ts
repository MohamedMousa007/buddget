import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  uid: 'u1' as string | null,
  user: { email: 'First.Last+x@gmail.com', email_confirmed_at: '2026-11-01T00:00:00Z', is_anonymous: false } as Record<string, unknown> | null,
  rpc: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveActiveApiIdentity: async () => (h.uid ? { id: h.uid } : null) }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    auth: { admin: { getUserById: async () => ({ data: { user: h.user }, error: null }) } },
    rpc: h.rpc,
  }),
}))

import { POST } from './route'

const call = () => POST(new Request('http://x/api/entitlements/trial', { method: 'POST' }))

beforeEach(() => {
  h.uid = 'u1'
  h.user = { email: 'First.Last+x@gmail.com', email_confirmed_at: '2026-11-01T00:00:00Z', is_anonymous: false }
  h.rpc.mockReset().mockResolvedValue({ data: { status: 'granted', trial_ends_at: '2026-11-29T00:00:00Z' }, error: null })
})

describe('POST /api/entitlements/trial', () => {
  it('rejects an unauthenticated caller', async () => {
    h.uid = null
    expect((await call()).status).toBe(401)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('claims under the normalised email key, never the typed address', async () => {
    const res = await call()
    expect(await res.json()).toMatchObject({ status: 'granted' })
    expect(h.rpc).toHaveBeenCalledWith('trial_claim', { p_user: 'u1', p_email_key: 'firstlast@gmail.com' })
  })

  it('grants nothing to an unconfirmed email or an anonymous session', async () => {
    h.user = { email: 'a@example.com', email_confirmed_at: null, is_anonymous: false }
    expect(await (await call()).json()).toEqual({ status: 'unverified' })
    h.user = { email: 'a@example.com', email_confirmed_at: '2026-11-01T00:00:00Z', is_anonymous: true }
    expect(await (await call()).json()).toEqual({ status: 'unverified' })
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('answers invalid_email when the address cannot be keyed', async () => {
    h.user = { email: 'nonsense', email_confirmed_at: '2026-11-01T00:00:00Z', is_anonymous: false }
    expect(await (await call()).json()).toEqual({ status: 'invalid_email' })
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('passes the database refusals through as a status, not an error', async () => {
    for (const status of ['billing_off', 'already_claimed', 'already_entitled', 'daily_cap']) {
      h.rpc.mockResolvedValue({ data: { status }, error: null })
      const res = await call()
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ status })
    }
  })

  it('answers 503 when the database call fails, so the client can retry', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'down' } })
    expect((await call()).status).toBe(503)
  })
})
