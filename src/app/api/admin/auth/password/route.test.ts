import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  cred: null as Record<string, unknown> | null,
  recordFailure: vi.fn(), clearFailures: vi.fn(), verify: vi.fn(), code: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/admin/guard', () => ({
  guardAdmin: async () => ({ ok: true, ctx: { user: { id: 'a1', email: 'a@x.com' }, session: {}, audit: async () => undefined, service: { from: () => ({ update: () => ({ eq: async () => ({}) }) }) } } }),
  readJson: async (req: Request) => req.json(),
  bad: (error: string, status = 400) => new Response(JSON.stringify({ error }), { status }),
  json: (b: unknown) => new Response(JSON.stringify(b)),
}))
vi.mock('@/lib/server/admin/credentials', () => ({
  allowAttempt: async () => true,
  loadCredentials: async () => h.cred,
  isLocked: (c: { locked_until: string | null }) => !!c.locked_until && new Date(c.locked_until).getTime() > Date.now(),
  recordFailure: h.recordFailure,
  clearFailures: h.clearFailures,
}))
vi.mock('@/lib/server/admin/crypto', () => ({ hashPassword: async () => 'h', passwordProblem: () => null, verifyPassword: h.verify }))
vi.mock('@/lib/server/admin/emailCode', () => ({ verifyEmailCode: h.code }))
vi.mock('@/lib/server/admin/session', () => ({ revokeAllAdminSessions: async () => undefined, storedSessionId: () => 's' }))

import { POST } from './route'

const post = () => POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ current: 'old', next: 'New-pass-123', code: '123456' }) }))

describe('POST /api/admin/auth/password lockout (API-11)', () => {
  beforeEach(() => {
    h.cred = { user_id: 'a1', password_hash: 'x', setup_completed_at: 'now', failed_attempts: 0, locked_until: null }
    h.recordFailure.mockReset(); h.clearFailures.mockReset()
    h.verify.mockReset().mockResolvedValue(true)
    h.code.mockReset().mockResolvedValue(true)
  })

  it('feeds a wrong guess into the lockout counter', async () => {
    h.verify.mockResolvedValue(false)
    expect((await post()).status).toBe(401)
    expect(h.recordFailure).toHaveBeenCalledTimes(1)
  })

  it('refuses while the account is locked', async () => {
    h.cred = { ...h.cred, locked_until: new Date(Date.now() + 60_000).toISOString() }
    expect((await post()).status).toBe(429)
    expect(h.verify).not.toHaveBeenCalled()
  })

  it('clears the counter on success', async () => {
    expect((await post()).status).toBe(200)
    expect(h.clearFailures).toHaveBeenCalledTimes(1)
    expect(h.recordFailure).not.toHaveBeenCalled()
  })
})
