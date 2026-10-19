import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ user: vi.fn(), send: vi.fn(), claim: vi.fn(), release: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteUser: h.user }))
vi.mock('@/lib/server/email/send', () => ({ sendTemplatedEmail: h.send }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      update: (v: { welcome_email_sent_at: string | null }) => {
        if (v.welcome_email_sent_at === null) return { eq: h.release }
        const q = { eq: () => q, is: () => q, select: () => q, maybeSingle: h.claim }
        return q
      },
    }),
  }),
}))

import { POST } from './route'

const fresh = () => new Date().toISOString()
const req = () => new Request('http://x/api/auth/welcome', { method: 'POST' })

describe('POST /api/auth/welcome', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => m.mockReset())
    h.user.mockResolvedValue({ user: { id: 'u1', email: 'a@x.com', created_at: fresh(), user_metadata: {} } })
    h.claim.mockResolvedValue({ data: { id: 'u1', display_name: 'Sara Ahmed' } })
    h.send.mockResolvedValue({ ok: true, providerId: 'p', locale: 'en' })
    h.release.mockResolvedValue({})
  })

  it('welcomes a new account once, using the first name', async () => {
    expect(await (await POST(req())).json()).toEqual({ sent: true })
    expect(h.send).toHaveBeenCalledWith('welcome', expect.objectContaining({ email: 'a@x.com', firstName: 'Sara' }), {}, expect.objectContaining({ idempotencyKey: 'welcome:u1' }))
  })

  it('does nothing when the claim was already taken', async () => {
    h.claim.mockResolvedValue({ data: null })
    expect(await (await POST(req())).json()).toEqual({ sent: false })
    expect(h.send).not.toHaveBeenCalled()
  })

  it('leaves old accounts alone', async () => {
    h.user.mockResolvedValue({ user: { id: 'u1', email: 'a@x.com', created_at: '2020-01-01T00:00:00Z', user_metadata: {} } })
    expect(await (await POST(req())).json()).toEqual({ sent: false })
    expect(h.claim).not.toHaveBeenCalled()
  })

  it('gives the claim back when the send fails so the next sign-in retries', async () => {
    h.send.mockResolvedValue({ ok: false, error: 'boom' })
    const res = await POST(req())
    expect(res.status).toBe(502)
    expect(h.release).toHaveBeenCalled()
  })

  it('needs a signed-in user', async () => {
    h.user.mockResolvedValue({ user: null })
    expect((await POST(req())).status).toBe(401)
  })
})
