import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ limited: vi.fn(), row: vi.fn(), removed: vi.fn(), unbind: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))
vi.mock('@/lib/auth/resolveDeviceId', () => ({ resolveDeviceId: async () => 'dev1' }))
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

const call = () => POST(new Request('http://x', { method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4' }, body: JSON.stringify({ secret: 's' }) }))

describe('POST /api/biometric/signin', () => {
  beforeEach(() => {
    h.limited.mockReset().mockResolvedValue(false)
    h.row.mockReset().mockResolvedValue({ data: null, error: null })
    h.removed.mockReset().mockResolvedValue({ data: null, error: null })
    h.unbind.mockReset().mockResolvedValue({ error: null })
  })

  it('throttles per device and per address before touching the secret', async () => {
    h.limited.mockResolvedValue(true)
    expect((await call()).status).toBe(429)
    expect(h.limited).toHaveBeenCalledWith(expect.anything(), 'bio-signin-dev:dev1', expect.any(Number), expect.any(Number))
    expect(h.row).not.toHaveBeenCalled()
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
