import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ uid: vi.fn(), limited: vi.fn(), ticket: vi.fn(), insert: vi.fn(), update: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: h.uid }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: (t: string) => {
      if (t === 'support_tickets') {
        const q = { select: () => q, eq: () => q, maybeSingle: h.ticket, update: (v: unknown) => ({ eq: () => h.update(v) }) }
        return q
      }
      return { insert: h.insert }
    },
  }),
}))

import { POST } from './route'

const call = () => POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ message: 'hi' }) }), { params: Promise.resolve({ number: '5' }) })

describe('POST /api/support/tickets/[number]', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => m.mockReset())
    h.uid.mockResolvedValue('u1')
    h.limited.mockResolvedValue(false)
    h.ticket.mockResolvedValue({ data: { id: 't1', number: 5, status: 'resolved' } })
    h.insert.mockResolvedValue({ error: null })
    h.update.mockResolvedValue({ error: null })
  })

  it('reopens a resolved ticket', async () => {
    expect((await call()).status).toBe(200)
    expect(h.update).toHaveBeenCalledWith({ status: 'open', resolved_at: null })
  })

  it('does not reopen a closed ticket', async () => {
    h.ticket.mockResolvedValue({ data: { id: 't1', number: 5, status: 'closed' } })
    expect((await call()).status).toBe(409)
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('reports a failed message insert and leaves the status alone', async () => {
    h.insert.mockResolvedValue({ error: { message: 'x' } })
    expect((await call()).status).toBe(500)
    expect(h.update).not.toHaveBeenCalled()
  })

  it('fails closed when the rate limiter is down', async () => {
    h.limited.mockResolvedValue(true)
    expect((await call()).status).toBe(429)
  })
})
