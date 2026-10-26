import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ limited: vi.fn(), row: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))
vi.mock('@/lib/auth/resolveDeviceId', () => ({ resolveDeviceId: async () => 'dev1' }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: h.row }) }) }) }),
}))

import { POST } from './route'

const call = () => POST(new Request('http://x', { method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4' }, body: JSON.stringify({ secret: 's' }) }))

describe('POST /api/biometric/signin', () => {
  beforeEach(() => {
    h.limited.mockReset().mockResolvedValue(false)
    h.row.mockReset().mockResolvedValue({ data: null, error: null })
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
})
