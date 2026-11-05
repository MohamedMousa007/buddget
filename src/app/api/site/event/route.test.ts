import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ limited: vi.fn(), rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc: h.rpc }) }))

import { POST } from './route'

const post = () => POST(new Request('http://x/api/site/event', {
  method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, body: JSON.stringify({ path: '/en', event: 'view' }),
}))

describe('POST /api/site/event rate limit (API-10)', () => {
  beforeEach(() => {
    h.limited.mockReset().mockResolvedValue(false)
    h.rpc.mockReset().mockResolvedValue({ error: null })
  })

  it('uses the shared database counter, failing open', async () => {
    expect((await post()).status).toBe(204)
    expect(h.limited).toHaveBeenCalledWith(expect.anything(), 'site-event:1.2.3.4', 60, 120, true)
  })

  it('answers 429 without bumping a counter when limited', async () => {
    h.limited.mockResolvedValue(true)
    expect((await post()).status).toBe(429)
    expect(h.rpc).not.toHaveBeenCalled()
  })
})
