import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ limited: vi.fn(), row: vi.fn(), removed: vi.fn(), unbind: vi.fn(), cookie: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))
vi.mock('@/lib/auth/deviceCookie', () => ({ readDeviceCookie: h.cookie, setDeviceCookie: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: h.row, eq: () => ({ maybeSingle: h.removed }) }) }),
      delete: () => ({ eq: () => ({ eq: h.unbind }) }),
      table,
    }),
  }),
}))

import { POST } from './route'

const DEV = 'abcdef0123'
const call = (headers: Record<string, string> = { 'x-buddget-device-id': DEV }) =>
  POST(new Request('http://x', { method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4', ...headers }, body: JSON.stringify({ secret: 's' }) }))

describe('POST /api/biometric/signin', () => {
  beforeEach(() => {
    h.limited.mockReset().mockResolvedValue(false)
    h.row.mockReset().mockResolvedValue({ data: null, error: null })
    h.removed.mockReset().mockResolvedValue({ data: null, error: null })
    h.unbind.mockReset().mockResolvedValue({ error: null })
    h.cookie.mockReset().mockResolvedValue(null)
  })

  it('answers a non-string secret with 400, not 500', async () => {
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ secret: 5 }) }))
    expect(res.status).toBe(400)
    expect(h.limited).not.toHaveBeenCalled()
  })

  it('throttles per device and per address before touching the secret', async () => {
    h.limited.mockImplementation(async (_s: unknown, key: string) => key === `bio-signin-dev:${DEV}`)
    expect((await call()).status).toBe(429)
    h.limited.mockImplementation(async (_s: unknown, key: string) => key.startsWith('bio-signin-ip:'))
    expect((await call()).status).toBe(429)
    expect(h.row).not.toHaveBeenCalled()
  })

  it('without a device id (no header, no cookie) answers 404 after the address limit only, and mints nothing', async () => {
    const res = await call({})
    expect(res.status).toBe(404)
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(h.limited).toHaveBeenCalledTimes(1)
    expect(h.limited).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^bio-signin-ip:/), expect.any(Number), expect.any(Number))
    expect(h.row).not.toHaveBeenCalled()
  })

  it('reads the web device cookie when there is no header', async () => {
    h.cookie.mockResolvedValue(DEV)
    expect((await call({})).status).toBe(404)
    expect(h.limited).toHaveBeenCalledWith(expect.anything(), `bio-signin-dev:${DEV}`, expect.any(Number), expect.any(Number))
    expect(h.row).toHaveBeenCalled()
  })

  it('carries on when under the limit', async () => {
    expect((await call()).status).toBe(404)
  })

  it('cuts off a phone the owner removed, and drops its binding', async () => {
    h.row.mockResolvedValue({ data: { user_id: 'u1', secret_hash: 'ab'.repeat(32) }, error: null })
    h.removed.mockResolvedValue({ data: { revoked_at: '2026-10-01T00:00:00Z' }, error: null })
    const res = await call()
    expect(res.status).toBe(404)
    expect(h.unbind).toHaveBeenCalled()
  })
})
