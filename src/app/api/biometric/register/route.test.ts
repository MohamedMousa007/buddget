import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ user: vi.fn(), identity: vi.fn(), verify: vi.fn(), inserted: vi.fn(), updated: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteUser: h.user, resolveRouteIdentity: h.identity }))
vi.mock('@/lib/server/reauth', () => ({ verifyReauth: h.verify }))
vi.mock('@/lib/auth/resolveDeviceId', () => ({ resolveDeviceId: async () => 'dev1' }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => {
      const upd = { eq: () => upd, select: h.updated }
      return { upsert: () => ({ select: h.inserted }), update: () => upd, delete: () => upd }
    },
  }),
}))

import { POST } from './route'

const HASH = 'a'.repeat(64)
const call = (body: Record<string, unknown> = { secret_hash: HASH }) =>
  POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }))
const nowSec = () => Math.floor(Date.now() / 1000)

describe('POST /api/biometric/register', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => m.mockReset())
    h.user.mockResolvedValue({ user: { id: 'u1' } })
    h.identity.mockResolvedValue({ id: 'u1', email: 'a@x.com', sessionId: 's1', amr: [{ method: 'password', timestamp: nowSec() - 30 }] })
    h.verify.mockResolvedValue('reauth_required')
  })

  it('binds a device nobody owns after a fresh sign-in', async () => {
    h.inserted.mockResolvedValue({ data: [{ device_id: 'dev1' }], error: null })
    expect((await call()).status).toBe(200)
    expect(h.verify).not.toHaveBeenCalled()
  })

  it('refreshes the secret of the same owner', async () => {
    h.inserted.mockResolvedValue({ data: [], error: null })
    h.updated.mockResolvedValue({ data: [{ device_id: 'dev1' }], error: null })
    expect((await call()).status).toBe(200)
  })

  it('refuses to rebind a device owned by another account', async () => {
    h.inserted.mockResolvedValue({ data: [], error: null })
    h.updated.mockResolvedValue({ data: [], error: null })
    expect((await call()).status).toBe(409)
  })

  it('a stale session gets a typed reauth_required and binds nothing', async () => {
    h.identity.mockResolvedValue({ id: 'u1', email: 'a@x.com', sessionId: 's1', amr: [{ method: 'password', timestamp: nowSec() - 3600 }] })
    const res = await call()
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('reauth_required')
    expect(h.inserted).not.toHaveBeenCalled()
  })

  it('a valid reauth (current password) binds even on a stale session', async () => {
    h.identity.mockResolvedValue({ id: 'u1', email: 'a@x.com', sessionId: 's1', amr: [{ method: 'password', timestamp: nowSec() - 3600 }] })
    h.verify.mockResolvedValue('ok')
    h.inserted.mockResolvedValue({ data: [{ device_id: 'dev1' }], error: null })
    expect((await call({ secret_hash: HASH, currentPassword: 'pw' })).status).toBe(200)
    expect(h.verify).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'u1' }), { id: 'u1' }, 'pw')
  })

  it('a wrong password is a typed 403 even on a fresh session', async () => {
    h.verify.mockResolvedValue('wrong_password')
    const res = await call({ secret_hash: HASH, currentPassword: 'nope' })
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('wrong_password')
    expect(h.inserted).not.toHaveBeenCalled()
  })

  it('maps a reauth rate limit to 429', async () => {
    h.identity.mockResolvedValue({ id: 'u1', email: 'a@x.com', sessionId: 's1', amr: [] })
    h.verify.mockResolvedValue('rate_limited')
    expect((await call()).status).toBe(429)
  })

  it.each([['too short', 'a'.repeat(40)], ['non-hex', 'z'.repeat(64)], ['too long', 'a'.repeat(65)], ['missing', undefined]])('rejects a %s secret_hash with 400', async (_n, secret_hash) => {
    expect((await call({ secret_hash })).status).toBe(400)
    expect(h.inserted).not.toHaveBeenCalled()
  })

  it('401 without a session, or when the verified user differs from the token', async () => {
    h.user.mockResolvedValue({ user: null })
    expect((await call()).status).toBe(401)
    h.user.mockResolvedValue({ user: { id: 'u2' } })
    expect((await call()).status).toBe(401)
  })
})
