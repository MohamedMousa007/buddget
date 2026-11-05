import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ identity: vi.fn(), active: vi.fn(), tokenRow: vi.fn() }))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ looksLikeJwt: (t: string) => t.split('.').length === 3, resolveRouteIdentity: h.identity }))
vi.mock('@/lib/auth/accountActive', () => ({ isAccountActive: h.active }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single: h.tokenRow }) }) }) }) }),
}))

import { resolveSmsCaller } from './resolveSmsUser'

const req = (token: string, device?: string) => new Request('http://x', { headers: { authorization: `Bearer ${token}`, ...(device ? { 'x-buddget-device-id': device } : {}) } })

describe('resolveSmsCaller', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => m.mockReset())
    h.identity.mockResolvedValue({ id: 'u1' })
    h.tokenRow.mockResolvedValue({ data: { user_id: 'u1', device_id: 'dev1' } })
    h.active.mockResolvedValue(true)
  })

  it('lets an active JWT caller through', async () => {
    expect(await resolveSmsCaller(req('a.b.c', 'dev1'))).toEqual({ userId: 'u1', deviceId: 'dev1', viaJwt: true })
  })
  it('a suspended account is no caller on the JWT path', async () => {
    h.active.mockResolvedValue(false)
    expect((await resolveSmsCaller(req('a.b.c'))).userId).toBeNull()
  })
  it('a suspended account is no caller on the ingest-token path either', async () => {
    h.active.mockResolvedValue(false)
    expect((await resolveSmsCaller(req('opaque-token'))).userId).toBeNull()
  })
  it('an active ingest token resolves its device', async () => {
    expect(await resolveSmsCaller(req('opaque-token'))).toEqual({ userId: 'u1', deviceId: 'dev1', viaJwt: false })
  })
  it('no bearer means no caller and no Auth lookup', async () => {
    expect((await resolveSmsCaller(new Request('http://x'))).userId).toBeNull()
    expect(h.active).not.toHaveBeenCalled()
  })
})
