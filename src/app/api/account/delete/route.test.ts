import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ identity: vi.fn(), limited: vi.fn(), del: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveVerifiedIdentity: h.identity }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/server/deleteAccount', () => ({ deleteUserCompletely: h.del }))

import { POST } from './route'

const nowS = () => Math.floor(Date.now() / 1000)
const call = () => POST(new Request('http://x/api/account/delete', { method: 'POST' }))

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => m.mockReset())
    h.identity.mockResolvedValue({ id: 'u1', email: 'a@x.com', amr: [{ method: 'password', timestamp: nowS() - 30 }] })
    h.limited.mockResolvedValue(false)
    h.del.mockResolvedValue({ ok: true, partialErrors: [] })
  })

  it('deletes after a recent sign-in', async () => {
    expect((await call()).status).toBe(200)
    expect(h.del).toHaveBeenCalled()
  })

  it('does not report ok when the sweep left rows behind', async () => {
    h.del.mockResolvedValue({ ok: true, partialErrors: ['email_log: boom'] })
    const res = await call()
    expect(res.status).toBe(207)
    expect(await res.json()).toMatchObject({ ok: false, deleted: true, partial: true, partialErrors: ['email_log: boom'] })
  })

  it('fails (500) when the account could not be deleted', async () => {
    h.del.mockResolvedValue({ ok: false, error: 'Failed to delete auth user', details: ['x'] })
    expect((await call()).status).toBe(500)
  })

  it('asks for re-authentication when the session is older than 5 minutes', async () => {
    h.identity.mockResolvedValue({ id: 'u1', email: 'a@x.com', amr: [{ method: 'password', timestamp: nowS() - 3600 }] })
    const res = await call()
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('reauth_required')
    expect(h.del).not.toHaveBeenCalled()
  })

  it('needs a signed-in user', async () => {
    h.identity.mockResolvedValue(null)
    expect((await call()).status).toBe(401)
  })

  it('is rate limited', async () => {
    h.limited.mockResolvedValue(true)
    expect((await call()).status).toBe(429)
    expect(h.del).not.toHaveBeenCalled()
  })
})
