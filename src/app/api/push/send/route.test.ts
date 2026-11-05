import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ uid: vi.fn(), limited: vi.fn(), push: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: h.uid, resolveActiveApiUserId: h.uid }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/server/sendNativePush', () => ({ sendNativePush: h.push }))

import { POST } from './route'

const U = '11111111-1111-4111-8111-111111111111'
const post = (body: unknown) => POST(new Request('http://x/api/push/send', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }))

describe('POST /api/push/send', () => {
  beforeEach(() => {
    h.uid.mockReset().mockResolvedValue(U)
    h.limited.mockReset().mockResolvedValue(false)
    h.push.mockReset().mockResolvedValue({ ok: true, sent: 1, failed: 0 })
  })

  it('sends a self-targeted test push for a Bearer or cookie caller', async () => {
    expect((await post({ userId: U, title: 't', body: 'b' })).status).toBe(200)
  })

  it('refuses to push to someone else', async () => {
    expect((await post({ userId: '22222222-2222-4222-8222-222222222222', title: 't', body: 'b' })).status).toBe(403)
  })

  it('rate limits per user', async () => {
    h.limited.mockResolvedValue(true)
    expect((await post({ userId: U, title: 't', body: 'b' })).status).toBe(429)
    expect(h.push).not.toHaveBeenCalled()
  })

  it('rejects an oversized body', async () => {
    expect((await post('x'.repeat(20_000))).status).toBe(413)
  })
})
