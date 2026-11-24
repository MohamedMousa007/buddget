import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ result: vi.fn(), filters: [] as Array<[string, string, unknown]>, patch: null as unknown }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: async () => 'u1' }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      update: (v: unknown) => {
        h.patch = v
        const q = {
          eq: (c: string, val: unknown) => { h.filters.push(['eq', c, val]); return q },
          in: (c: string, val: unknown) => { h.filters.push(['in', c, val]); return q },
          is: (c: string, val: unknown) => { h.filters.push(['is', c, val]); return q },
          select: () => h.result(),
        }
        return q
      },
    }),
  }),
}))

import { POST } from './route'

const rate = (body: unknown) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ number: '5' }) })

describe('POST /api/support/tickets/[number]/csat', () => {
  beforeEach(() => {
    h.result.mockReset().mockResolvedValue({ data: [{ number: 5 }], error: null })
    h.filters.length = 0
    h.patch = null
  })

  it('writes once, only on the caller’s resolved ticket, in one conditional update', async () => {
    expect((await rate({ rating: 1, comment: 'quick' })).status).toBe(200)
    expect(h.patch).toMatchObject({ csat_rating: 1, csat_comment: 'quick' })
    expect(h.filters).toEqual(expect.arrayContaining([['eq', 'user_id', 'u1'], ['eq', 'number', 5], ['in', 'status', ['resolved', 'closed']], ['is', 'csat_rating', null]]))
  })

  it('answers 409 when already rated (or not resolved, or not theirs)', async () => {
    h.result.mockResolvedValue({ data: [], error: null })
    expect((await rate({ rating: -1 })).status).toBe(409)
  })

  it('rejects a rating other than up or down', async () => {
    expect((await rate({ rating: 5 })).status).toBe(400)
    expect(h.patch).toBeNull()
  })
})
