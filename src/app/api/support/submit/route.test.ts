import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn(), drain: vi.fn(), deleted: false }))
vi.mock('server-only', () => ({}))
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => fn() }))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: async () => 'u1' }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: async () => false }))
vi.mock('@/lib/server/integrations/outbox', () => ({ drainOutbox: h.drain }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    auth: { admin: { getUserById: async () => (h.deleted ? { data: { user: null }, error: { status: 404, code: 'user_not_found' } } : { data: { user: { email: 'a@b.co' } }, error: null }) } },
    rpc: h.rpc,
  }),
}))

import { POST } from './route'

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ data: [{ ticket_number: 7 }], error: null })
  h.drain.mockReset()
  h.deleted = false
})

describe('POST /api/support/submit', () => {
  it('QA-57: a sure bug is kept as a ticket and never queued for Linear', async () => {
    const body = { chosen: 'bug', title: 'App crashes on open', description: 'It crashes every time I open the app, critical' }
    const res = await POST(new Request('http://x/api/support/submit', { method: 'POST', body: JSON.stringify(body) }))
    expect(await res.json()).toEqual({ ok: true, number: 7 })
    expect(h.rpc).toHaveBeenCalledWith('support_submit', expect.objectContaining({ p_to_linear: false }))
    expect(h.drain).not.toHaveBeenCalled()
  })

  it('S8C-05: a deleted account answers 401 and never reaches the insert', async () => {
    h.deleted = true
    const res = await POST(new Request('http://x/api/support/submit', { method: 'POST', body: JSON.stringify({ chosen: 'question', title: 'Where is my data' }) }))
    expect(res.status).toBe(401)
    expect(h.rpc).not.toHaveBeenCalledWith('support_submit', expect.anything())
  })
})
