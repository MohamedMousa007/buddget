import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ cred: null as Record<string, unknown> | null, recordFailure: vi.fn(), verify: vi.fn(), audit: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/admin/guard', () => ({
  SIGN_IN_ERROR: 'same',
  guardSignIn: async () => ({ ok: true, ctx: { user: { id: 'a1', email: 'a@x.com' }, service: {}, audit: h.audit } }),
  readJson: async (req: Request) => req.json(),
  bad: (error: string, status = 400) => new Response(JSON.stringify({ error }), { status }),
  json: (b: unknown) => new Response(JSON.stringify(b)),
}))
vi.mock('@/lib/server/admin/credentials', () => ({
  allowAttempt: async () => true,
  loadCredentials: async () => h.cred,
  isLocked: (c: { locked_until: string | null }) => !!c.locked_until && new Date(c.locked_until).getTime() > Date.now(),
  recordFailure: h.recordFailure,
  clearFailures: vi.fn(),
}))
vi.mock('@/lib/server/admin/crypto', () => ({ hashPassword: async () => 'h', verifyPassword: h.verify }))
vi.mock('@/lib/server/admin/emailCode', () => ({ verifyEmailCode: async () => false }))
vi.mock('@/lib/server/admin/session', () => ({ createAdminSession: vi.fn(), sessionCookie: vi.fn() }))

import { POST } from './route'

const post = () => POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ email: 'a@x.com', password: 'pw', code: '123456' }) }))

beforeEach(() => {
  h.cred = { user_id: 'a1', password_hash: 'x', setup_completed_at: 'now', failed_attempts: 0, locked_until: null }
  h.recordFailure.mockReset().mockResolvedValue({ locked: false })
  h.verify.mockReset().mockResolvedValue(false)
  h.audit.mockReset()
})

describe('POST /api/admin/auth/login uniform replies (F-07)', () => {
  it('a locked account gets the same 401 as a wrong password', async () => {
    h.cred!.locked_until = new Date(Date.now() + 60_000).toISOString()
    const locked = await post()
    h.cred!.locked_until = null
    const wrong = await post()
    expect(locked.status).toBe(401)
    expect(await locked.json()).toEqual(await wrong.json())
  })

  it('the lockout still trips and is audited, but the reply does not say so', async () => {
    h.recordFailure.mockResolvedValue({ locked: true })
    const res = await post()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'same' })
    expect(h.recordFailure).toHaveBeenCalledTimes(1)
    expect(h.audit).toHaveBeenCalledWith('auth.login_failed', { metadata: { locked: true } })
  })
})
