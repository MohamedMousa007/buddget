import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ identity: vi.fn(), user: vi.fn(), verify: vi.fn(), upsert: vi.fn(), rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveVerifiedIdentity: h.identity, resolveRouteUser: h.user }))
vi.mock('@/lib/server/reauth', () => ({ verifyReauth: h.verify }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ from: () => ({ upsert: h.upsert }), rpc: h.rpc }) }))

import { POST } from './route'

const call = (body: unknown) => POST(new Request('http://x/api/auth/two-factor', { method: 'POST', body: JSON.stringify(body) }))

describe('POST /api/auth/two-factor', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => m.mockReset())
    h.identity.mockResolvedValue({ id: 'u1', email: 'a@x.com', sessionId: 's1', amr: [] })
    h.user.mockResolvedValue({ user: { id: 'u1' } })
    h.upsert.mockResolvedValue({ error: null })
    h.rpc.mockResolvedValue({ error: null })
  })

  it('turning it off needs re-authentication', async () => {
    h.verify.mockResolvedValue('reauth_required')
    expect((await call({ enabled: false })).status).toBe(403)
    expect(h.upsert).not.toHaveBeenCalled()
  })

  it('turns it off after the password checks out', async () => {
    h.verify.mockResolvedValue('ok')
    expect((await call({ enabled: false, currentPassword: 'pw' })).status).toBe(200)
    expect(h.upsert).toHaveBeenCalledWith({ user_id: 'u1', two_factor_email_enabled: false }, { onConflict: 'user_id' })
  })

  it('turning it on needs no password and marks this session verified so it is not gated out', async () => {
    expect((await call({ enabled: true })).status).toBe(200)
    expect(h.verify).not.toHaveBeenCalled()
    expect(h.rpc).toHaveBeenCalledWith('record_second_factor', { p_session: 's1', p_user: 'u1', p_method: 'enabled_here' })
  })
})
