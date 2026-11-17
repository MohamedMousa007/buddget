import { beforeEach, describe, expect, it, vi } from 'vitest'

const ACTOR = '22222222-2222-4222-8222-222222222222'
const h = vi.hoisted(() => ({ guard: vi.fn(), setSwitch: vi.fn(), factory: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/admin/guard', async (orig) => ({ ...(await orig<typeof import('@/lib/server/admin/guard')>()), guardAdmin: h.guard }))
vi.mock('@/lib/server/rewardsAdmin', () => ({ rewardsAdmin: h.factory }))

import { POST } from './route'

const post = (body: unknown) => POST(new Request('http://x/api/admin/rewards/switches', { method: 'POST', body: JSON.stringify(body) }))
const withPermissions = (...perms: string[]) => h.guard.mockResolvedValue({ ok: true, ctx: { service: {}, user: { id: ACTOR }, permissions: new Set(perms) } })

beforeEach(() => {
  h.setSwitch.mockReset().mockResolvedValue({ status: 'ok' })
  h.factory.mockReset().mockReturnValue({ setSwitch: h.setSwitch })
  withPermissions('*')
})

describe('POST /api/admin/rewards/switches', () => {
  it('stops at the guard', async () => {
    h.guard.mockResolvedValue({ ok: false, res: new Response(null, { status: 403 }) })
    expect((await post({ key: 'billing', enabled: false })).status).toBe(403)
    expect(h.setSwitch).not.toHaveBeenCalled()
  })

  it.each([['billing', 'billing.grant'], ['tiers', 'loyalty.manage'], ['referrals', 'referrals.manage'], ['spark_gifts', 'sparks.manage']])('%s needs %s', async (key, perm) => {
    withPermissions(...['billing.grant', 'loyalty.manage', 'referrals.manage', 'sparks.manage'].filter((p) => p !== perm))
    expect((await post({ key, enabled: true })).status).toBe(403)
    withPermissions(perm)
    expect((await post({ key, enabled: true })).status).toBe(200)
    expect(h.setSwitch).toHaveBeenCalledWith(key, true)
  })

  it('refuses an unknown key or a missing value', async () => {
    for (const body of [{ key: 'maintenance', enabled: true }, { key: 'billing' }, { key: 'billing', enabled: 'no' }]) expect((await post(body)).status).toBe(400)
    expect(h.setSwitch).not.toHaveBeenCalled()
  })

  it('passes the actor to the wrapper and reports a database failure', async () => {
    h.setSwitch.mockResolvedValueOnce({ status: 'error', message: 'boom' })
    expect((await post({ key: 'tiers', enabled: false })).status).toBe(500)
    expect(h.factory).toHaveBeenCalledWith({}, ACTOR)
  })
})
