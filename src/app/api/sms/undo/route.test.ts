import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  caller: vi.fn(),
  cookieUser: vi.fn(),
  revoked: vi.fn(),
  log: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/sms/resolveSmsUser', () => ({ resolveSmsCaller: h.caller }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: h.cookieUser, resolveActiveApiUserId: h.cookieUser }))
vi.mock('@/lib/server/devices/registry', () => ({ isRevokedDevice: h.revoked, hasAnyDevice: async () => false }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: h.log }) }) }),
    rpc: h.rpc,
  }),
}))

import { POST } from './route'

const LOG_ID = '11111111-1111-4111-8111-111111111111'
const req = (headers: Record<string, string> = { authorization: 'Bearer t' }) =>
  new Request('http://x/api/sms/undo', { method: 'POST', headers, body: JSON.stringify({ parseLogId: LOG_ID }) })

describe('POST /api/sms/undo', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => m.mockReset())
    h.caller.mockResolvedValue({ userId: 'u1', deviceId: 'd1' })
    h.revoked.mockResolvedValue(false)
    h.log.mockResolvedValue({ data: { user_id: 'u1' }, error: null })
    h.rpc.mockResolvedValue({ data: { found: true, nothing_to_do: false }, error: null })
  })

  it('discards through the one database function with the user and log id', async () => {
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, expired: false })
    expect(h.rpc).toHaveBeenCalledWith('sms_discard_message', { p_user_id: 'u1', p_log_id: LOG_ID })
  })

  it('maps "nothing left to do" to alreadyUndone', async () => {
    h.rpc.mockResolvedValue({ data: { found: true, nothing_to_do: true }, error: null })
    expect(await (await POST(req())).json()).toEqual({ ok: true, alreadyUndone: true })
  })

  it("refuses another user's log without calling the function", async () => {
    h.log.mockResolvedValue({ data: { user_id: 'someone-else' }, error: null })
    expect((await POST(req())).status).toBe(403)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('answers 404 for a missing log', async () => {
    h.log.mockResolvedValue({ data: null, error: { message: 'none' } })
    expect((await POST(req())).status).toBe(404)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('reports a failed function call instead of ok', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect((await POST(req())).status).toBe(500)
  })

  it('refuses a revoked device', async () => {
    h.revoked.mockResolvedValue(true)
    expect((await POST(req())).status).toBe(403)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('falls back to the session cookie when there is no bearer', async () => {
    h.cookieUser.mockResolvedValue('u1')
    expect((await POST(req({}))).status).toBe(200)
    expect(h.caller).not.toHaveBeenCalled()
  })

  it('rejects an unauthenticated caller', async () => {
    h.caller.mockResolvedValue({ userId: null, deviceId: null })
    expect((await POST(req())).status).toBe(401)
  })
})
