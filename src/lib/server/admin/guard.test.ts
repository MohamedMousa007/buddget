import { beforeEach, describe, expect, it, vi } from 'vitest'

const allowAttempt = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('./credentials', () => ({ allowAttempt: (...a: unknown[]) => allowAttempt(...a) }))
vi.mock('./session', () => ({ ADMIN_CSRF_HEADER: 'x-requested-with', ADMIN_CSRF_VALUE: 'buddget-admin', readSessionToken: vi.fn(), validateAdminSession: vi.fn() }))

import { guardSignIn } from './guard'

const req = (ip: string) => new Request('http://x', { method: 'POST', headers: { 'x-requested-with': 'buddget-admin', 'x-real-ip': ip } })

beforeEach(() => allowAttempt.mockReset().mockResolvedValue(false))

describe('guardSignIn IP throttle (F-06)', () => {
  it('buckets an IPv6 caller by its /64, so a fresh address in the same prefix shares the budget', async () => {
    await guardSignIn(req('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), {})
    await guardSignIn(req('2001:db8:1:2:1111:2222:3333:4444'), {})
    const keys = allowAttempt.mock.calls.map((c) => c[1])
    expect(keys[0]).toBe('admin-signin-ip:2001:db8:1:2::/64')
    expect(keys[1]).toBe(keys[0])
  })

  it('keeps an IPv4 address whole and answers 429 when the bucket is spent', async () => {
    const g = await guardSignIn(req('203.0.113.9'), {})
    expect(allowAttempt.mock.calls[0]![1]).toBe('admin-signin-ip:203.0.113.9')
    expect(!g.ok && g.res.status).toBe(429)
  })
})
