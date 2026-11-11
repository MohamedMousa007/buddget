import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { device_id: string; secret_hash: string | null }
const h = vi.hoisted(() => ({
  user: vi.fn(), identity: vi.fn(), rpc: vi.fn(), cookieSet: vi.fn(), cookieGet: vi.fn(),
  twoFa: true, row: null as null | Row, upgraded: [] as unknown[], upgradeRows: [{ device_id: 'd' }] as unknown[],
}))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: async () => ({ set: h.cookieSet, get: h.cookieGet }) }))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteUser: h.user, resolveRouteIdentity: h.identity }))
vi.mock('@/lib/auth/resolveDeviceId', () => ({ resolveDeviceId: async () => '11111111-1111-1111-1111-111111111111' }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    rpc: h.rpc,
    from: (table: string) => {
      if (table === 'user_settings') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { two_factor_email_enabled: h.twoFa }, error: null }) }) }) }
      const q = {
        select: () => q,
        eq: () => q,
        is: () => q,
        maybeSingle: async () => ({ data: h.row, error: null }),
        update: (patch: unknown) => { h.upgraded.push(patch); return q },
        then: (res: (v: unknown) => unknown) => Promise.resolve({ data: h.upgradeRows, error: null }).then(res),
      }
      return q
    },
  }),
}))

import { POST } from './route'

const DEVICE = '11111111-1111-1111-1111-111111111111'
const SECRET = 'ab'.repeat(32)
const HASH = createHash('sha256').update(SECRET).digest('hex')
const call = (headers: Record<string, string> = {}) => POST(new Request('http://x/api/auth/device/check', { method: 'POST', headers }))

describe('POST /api/auth/device/check', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => typeof m === 'function' && 'mockReset' in m && m.mockReset())
    h.twoFa = true
    h.row = { device_id: DEVICE, secret_hash: HASH }
    h.upgraded = []
    h.upgradeRows = [{ device_id: 'd' }]
    h.user.mockResolvedValue({ user: { id: 'u1' } })
    h.identity.mockResolvedValue({ id: 'u1', email: 'a@x.com', sessionId: 's1', amr: [] })
    h.rpc.mockResolvedValue({ error: null })
    h.cookieGet.mockReturnValue(undefined)
  })

  it('2-step off: nothing required', async () => {
    h.twoFa = false
    expect(await (await call()).json()).toMatchObject({ trusted: true, required: false })
  })

  it('a hashed row trusts the device that presents its secret (native header)', async () => {
    const body = await (await call({ 'X-Buddget-Device-Secret': SECRET })).json()
    expect(body).toMatchObject({ trusted: true, required: false })
    expect(h.rpc).toHaveBeenCalledWith('record_second_factor', expect.objectContaining({ p_method: 'trusted_device' }))
  })

  it('a hashed row trusts the secret cookie on web', async () => {
    h.cookieGet.mockReturnValue({ value: SECRET })
    expect((await (await call()).json()).trusted).toBe(true)
  })

  it('a hashed row never trusts the device id alone', async () => {
    const body = await (await call()).json()
    expect(body).toMatchObject({ trusted: false, required: true })
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('a wrong secret is refused', async () => {
    expect((await (await call({ 'X-Buddget-Device-Secret': 'cd'.repeat(32) })).json()).trusted).toBe(false)
  })

  it('AUT-6: a legacy row (no hash) is never trusted by device id alone and is not upgraded', async () => {
    h.row = { device_id: DEVICE, secret_hash: null }
    const body = await (await call({ 'X-Buddget-Device-Id': DEVICE })).json()
    expect(body).toMatchObject({ trusted: false, required: true })
    expect(h.upgraded).toHaveLength(0)
  })

  it('an unknown device is required to verify', async () => {
    h.row = null
    expect(await (await call()).json()).toMatchObject({ trusted: false, required: true })
  })
})
