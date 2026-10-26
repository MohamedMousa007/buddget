import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ user: vi.fn(), inserted: vi.fn(), updated: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteUser: h.user }))
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

const call = () => POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ secret_hash: 'a'.repeat(64) }) }))

describe('POST /api/biometric/register', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => m.mockReset())
    h.user.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('binds a device nobody owns', async () => {
    h.inserted.mockResolvedValue({ data: [{ device_id: 'dev1' }], error: null })
    expect((await call()).status).toBe(200)
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
})
