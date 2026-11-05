import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  identity: vi.fn(), user: vi.fn(), verify: vi.fn(), token: vi.fn(),
  order: [] as string[],
  cookieSet: vi.fn(),
  revokeFails: false,
}))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: async () => ({ set: h.cookieSet }) }))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveVerifiedIdentity: h.identity, resolveRouteUser: h.user }))
vi.mock('@/lib/server/reauth', () => ({ verifyReauth: h.verify, accessTokenOf: h.token }))
vi.mock('@/lib/auth/resolveDeviceId', () => ({ resolveDeviceId: async () => '11111111-1111-1111-1111-111111111111' }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => ({
      delete: () => ({ eq: async () => { h.order.push(`delete:${table}`); return { error: null } } }),
      upsert: async () => { h.order.push(`upsert:${table}`); return { error: null } },
    }),
    auth: {
      admin: {
        updateUserById: async () => { h.order.push('password'); return { error: null } },
        signOut: async (_t: string, scope: string) => { h.order.push(`signOut:${scope}`); return { error: h.revokeFails ? { message: 'boom' } : null } },
      },
    },
  }),
}))

import { POST } from './route'

const call = (body: unknown) => POST(new Request('http://x/api/auth/password/change', { method: 'POST', body: JSON.stringify(body) }))

describe('POST /api/auth/password/change', () => {
  beforeEach(() => {
    h.order.length = 0
    h.revokeFails = false
    Object.values(h).forEach((m) => typeof m === 'function' && 'mockReset' in m && m.mockReset())
    h.identity.mockResolvedValue({ id: 'u1', email: 'a@x.com', sessionId: 's1', amr: [] })
    h.user.mockResolvedValue({ user: { id: 'u1' } })
    h.verify.mockResolvedValue('ok')
    h.token.mockResolvedValue('jwt')
  })

  it('removes biometric and trusted-device bindings before revoking other sessions, then re-trusts this device', async () => {
    const res = await call({ newPassword: 'newpass123', currentPassword: 'old' })
    expect(res.status).toBe(200)
    const i = (s: string) => h.order.indexOf(s)
    expect(i('delete:biometric_devices')).toBeGreaterThanOrEqual(0)
    expect(i('delete:trusted_devices')).toBeGreaterThanOrEqual(0)
    expect(i('password')).toBeGreaterThan(i('delete:biometric_devices'))
    expect(i('signOut:others')).toBeGreaterThan(i('password'))
    expect(i('upsert:trusted_devices')).toBeGreaterThan(i('signOut:others'))
  })

  it('answers with an error, not ok, when the other sessions cannot be revoked', async () => {
    h.revokeFails = true
    const res = await call({ newPassword: 'newpass123', currentPassword: 'old' })
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.code).toBe('sessions_not_revoked')
    expect(body.ok).toBeUndefined()
    expect(h.order.filter((x) => x === 'signOut:others')).toHaveLength(2)
  })

  it('changes nothing when the current password is wrong', async () => {
    h.verify.mockResolvedValue('wrong_password')
    const res = await call({ newPassword: 'newpass123', currentPassword: 'nope' })
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('wrong_password')
    expect(h.order).toEqual([])
  })

  it('asks for re-authentication when there is no password and no recent code sign-in', async () => {
    h.verify.mockResolvedValue('reauth_required')
    const res = await call({ newPassword: 'newpass123' })
    expect((await res.json()).code).toBe('reauth_required')
    expect(h.order).toEqual([])
  })

  it('refuses a weak new password and an unauthenticated caller', async () => {
    expect((await call({ newPassword: 'onlyletters' })).status).toBe(400)
    h.identity.mockResolvedValue(null)
    expect((await call({ newPassword: 'newpass123' })).status).toBe(401)
  })

  it('sets the one-minute announcement cookie only when asked', async () => {
    await call({ newPassword: 'newpass123', currentPassword: 'old' })
    const announced = () => h.cookieSet.mock.calls.filter(([name]) => name === 'buddget_password_updated').length
    expect(announced()).toBe(0)
    await call({ newPassword: 'newpass123', currentPassword: 'old', announce: true })
    expect(announced()).toBe(1)
  })

  it('re-trusts this device with a fresh secret: only its hash is stored, the web caller gets it as an HttpOnly cookie', async () => {
    const res = await call({ newPassword: 'newpass123', currentPassword: 'old' })
    expect(h.cookieSet).toHaveBeenCalledWith('buddget_device_secret', expect.stringMatching(/^[0-9a-f]{64}$/), expect.objectContaining({ httpOnly: true }))
    expect(JSON.stringify(await res.json())).not.toContain('deviceSecret')
  })
})
