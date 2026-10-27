import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ user: vi.fn(), eqs: [] as [string, unknown][], result: { error: null as null | { message: string } } }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteUser: h.user }))
vi.mock('@/lib/auth/resolveDeviceId', () => ({ resolveDeviceId: async () => 'dev1' }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      delete: () => {
        const q = {
          eq: (c: string, v: unknown) => { h.eqs.push([c, v]); return q },
          then: (res: (r: unknown) => unknown) => res(h.result),
        }
        return q
      },
    }),
  }),
}))

import { DELETE } from './route'

const call = () => DELETE(new Request('http://x', { method: 'DELETE' }))

describe('DELETE /api/biometric/register', () => {
  beforeEach(() => {
    h.eqs.length = 0
    h.result.error = null
    h.user.mockReset()
    h.user.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('unbinds only this user on this device', async () => {
    expect((await call()).status).toBe(200)
    expect(h.eqs).toEqual([['device_id', 'dev1'], ['user_id', 'u1']])
  })
  it('401s when unauthenticated and deletes nothing', async () => {
    h.user.mockResolvedValue({ user: null })
    expect((await call()).status).toBe(401)
    expect(h.eqs).toEqual([])
  })
  it('500s on a database error', async () => {
    h.result.error = { message: 'boom' }
    expect((await call()).status).toBe(500)
  })
})
