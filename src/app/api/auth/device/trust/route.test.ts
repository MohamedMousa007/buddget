import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ identity: vi.fn(), upsert: vi.fn(), rpc: vi.fn(), cookieSet: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveVerifiedIdentity: h.identity }))
vi.mock('next/headers', () => ({ cookies: async () => ({ set: h.cookieSet }) }))
vi.mock('@/lib/auth/resolveDeviceId', () => ({ resolveDeviceId: async () => 'dev1' }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ from: () => ({ upsert: h.upsert }), rpc: h.rpc }) }))

import { POST } from './route'

const nowS = () => Math.floor(Date.now() / 1000)
const call = (headers: Record<string, string> = {}) => POST(new Request('http://x/api/auth/device/trust', { method: 'POST', headers }))
const as = (method: string, age: number) => h.identity.mockResolvedValue({ id: 'u1', email: 'a@x.com', sessionId: 's1', amr: [{ method, timestamp: nowS() - age }] })

describe('POST /api/auth/device/trust', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => m.mockReset())
    h.upsert.mockResolvedValue({ error: null })
    h.rpc.mockResolvedValue({ error: null })
  })

  it('trusts the device right after an email-code sign-in', async () => {
    as('otp', 20)
    expect((await call()).status).toBe(200)
    expect(h.upsert).toHaveBeenCalled()
    expect(h.rpc).toHaveBeenCalledWith('record_second_factor', expect.objectContaining({ p_user: 'u1' }))
  })

  it('stores only a hash of the issued secret; web gets it as an HttpOnly cookie, never in the body', async () => {
    as('otp', 20)
    const body = await (await call()).json()
    const row = h.upsert.mock.calls[0][0]
    expect(row.secret_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(body.deviceSecret).toBeUndefined()
    const [name, secret, opts] = h.cookieSet.mock.calls[0]
    expect(name).toBe('buddget_device_secret')
    expect(opts.httpOnly).toBe(true)
    expect(createHash('sha256').update(secret).digest('hex')).toBe(row.secret_hash)
  })

  it('native (device id header) gets the secret in the body and no cookie', async () => {
    as('otp', 20)
    const body = await (await call({ 'X-Buddget-Device-Id': '11111111-1111-1111-1111-111111111111' })).json()
    expect(createHash('sha256').update(body.deviceSecret).digest('hex')).toBe(h.upsert.mock.calls[0][0].secret_hash)
    expect(h.cookieSet).not.toHaveBeenCalled()
  })

  it('refuses a password-only session', async () => {
    as('password', 5)
    expect((await call()).status).toBe(403)
    expect(h.upsert).not.toHaveBeenCalled()
  })

  it('refuses a stale code sign-in', async () => {
    as('otp', 7200)
    expect((await call()).status).toBe(403)
  })

  it('needs a signed-in user', async () => {
    h.identity.mockResolvedValue(null)
    expect((await call()).status).toBe(401)
  })
})
