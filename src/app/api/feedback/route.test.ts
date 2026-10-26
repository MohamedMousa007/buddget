import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ identity: vi.fn(), limited: vi.fn(), fetch: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteIdentity: h.identity }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))

import { POST } from './route'

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request('http://x/api/feedback', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }))
const valid = { type: 'bug', title: 'Broken thing', description: 'details' }

describe('POST /api/feedback', () => {
  beforeEach(() => {
    vi.stubEnv('LINEAR_API_KEY', 'k')
    vi.stubGlobal('fetch', h.fetch)
    h.identity.mockReset().mockResolvedValue({ id: 'u1', email: 'a@x.com', amr: [] })
    h.limited.mockReset().mockResolvedValue(false)
    h.fetch.mockReset().mockResolvedValue(new Response(JSON.stringify({ data: { issueCreate: { success: true, issue: { url: 'u', identifier: 'BUD-1' } } } })))
  })

  it('accepts a Bearer or cookie caller through the shared resolver', async () => {
    expect((await post(valid)).status).toBe(200)
    expect(h.identity).toHaveBeenCalled()
  })

  it('rate limits per user before calling Linear', async () => {
    h.limited.mockResolvedValue(true)
    expect((await post(valid)).status).toBe(429)
    expect(h.fetch).not.toHaveBeenCalled()
  })

  it('rejects an oversized body before parsing', async () => {
    expect((await post('x'.repeat(40_000))).status).toBe(413)
    expect(h.fetch).not.toHaveBeenCalled()
  })
})
