import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ identity: vi.fn(), rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveVerifiedIdentity: h.identity }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc: h.rpc }) }))

import { POST } from './route'

const nowS = () => Math.floor(Date.now() / 1000)
const call = (method = 'biometric') => POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ method }) }))
const as = (m: string, age: number) => h.identity.mockResolvedValue({ id: 'u1', email: null, sessionId: 's1', amr: [{ method: m, timestamp: nowS() - age }] })

describe('POST /api/auth/second-factor', () => {
  beforeEach(() => {
    h.identity.mockReset()
    h.rpc.mockReset().mockResolvedValue({ error: null })
  })

  it('records a biometric sign-in, which redeems a one-time code', async () => {
    as('otp', 10)
    expect((await call()).status).toBe(200)
    expect(h.rpc).toHaveBeenCalledWith('record_second_factor', { p_session: 's1', p_user: 'u1', p_method: 'biometric' })
  })

  it('a password-only session cannot mark itself verified', async () => {
    as('password', 5)
    expect((await call()).status).toBe(403)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('refuses a stale code sign-in', async () => {
    as('otp', 7200)
    expect((await call()).status).toBe(403)
  })
})
