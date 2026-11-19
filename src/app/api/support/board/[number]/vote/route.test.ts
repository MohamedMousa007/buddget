import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn(), drain: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => fn() }))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveActiveApiUserId: async () => 'u1' }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: async () => false }))
vi.mock('@/lib/server/integrations/outbox', () => ({ drainOutbox: h.drain }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => {
      const c: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'neq']) c[m] = () => c
      c.maybeSingle = async () => ({ data: { id: 't1' } })
      return c
    },
    rpc: h.rpc,
  }),
}))

import { POST } from './route'

describe('POST /api/support/board/[number]/vote', () => {
  it('QA-57: a vote never queues the idea for Linear', async () => {
    h.rpc.mockResolvedValue({ data: { votes: 50, queued: false }, error: null })
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ value: 1 }) }), { params: Promise.resolve({ number: '3' }) })
    expect(await res.json()).toEqual({ votes: 50, mine: 1 })
    expect(h.rpc).toHaveBeenCalledWith('cast_feedback_vote', expect.objectContaining({ p_threshold: 2_147_483_647 }))
    expect(h.drain).not.toHaveBeenCalled()
  })
})
