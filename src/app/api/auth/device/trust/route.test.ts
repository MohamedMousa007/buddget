import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ identity: vi.fn(), upsert: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteIdentity: h.identity }))
vi.mock('@/lib/auth/resolveDeviceId', () => ({ resolveDeviceId: async () => 'dev1' }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ from: () => ({ upsert: h.upsert }) }) }))

import { POST } from './route'

const nowS = () => Math.floor(Date.now() / 1000)
const call = () => POST(new Request('http://x/api/auth/device/trust', { method: 'POST' }))
const as = (method: string, age: number) => h.identity.mockResolvedValue({ id: 'u1', email: 'a@x.com', amr: [{ method, timestamp: nowS() - age }] })

describe('POST /api/auth/device/trust', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => m.mockReset())
    h.upsert.mockResolvedValue({ error: null })
  })

  it('trusts the device right after an email-code sign-in', async () => {
    as('otp', 20)
    expect((await call()).status).toBe(200)
    expect(h.upsert).toHaveBeenCalled()
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
