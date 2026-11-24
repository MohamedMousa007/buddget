import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn(), drain: vi.fn(), deleted: false, attach: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => fn() }))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: vi.fn(async () => 'u1') }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: async () => false }))
vi.mock('@/lib/server/integrations/outbox', () => ({ drainOutbox: h.drain }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    auth: { admin: { getUserById: async () => (h.deleted ? { data: { user: null }, error: { status: 404, code: 'user_not_found' } } : { data: { user: { email: 'a@b.co' } }, error: null }) } },
    rpc: h.rpc,
    from: () => ({ update: (v: unknown) => { const q = { eq: () => q, select: () => h.attach(v) }; return q } }),
  }),
}))

import { POST } from './route'

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ data: [{ ticket_id: 't7', ticket_number: 7 }], error: null })
  h.attach.mockReset().mockResolvedValue({ data: [{ id: 'm1' }], error: null })
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

  describe('screenshots on the first message', () => {
    const shot = { path: '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png', mime: 'image/png', size: 1000 }
    const send = () => POST(new Request('http://x/api/support/submit', { method: 'POST', body: JSON.stringify({ chosen: 'question', title: 'Where is my data', attachments: [shot] }) }))

    it('says they were saved', async () => {
      const { resolveApiUserId } = await import('@/lib/auth/resolveApiUser')
      vi.mocked(resolveApiUserId).mockResolvedValueOnce('11111111-1111-4111-8111-111111111111')
      expect(await (await send()).json()).toEqual({ ok: true, number: 7, attachmentsSaved: true })
      expect(h.attach).toHaveBeenCalledWith({ attachments: [shot] })
    })

    it('reports attachmentsSaved: false instead of hiding a failed save', async () => {
      const { resolveApiUserId } = await import('@/lib/auth/resolveApiUser')
      vi.mocked(resolveApiUserId).mockResolvedValueOnce('11111111-1111-4111-8111-111111111111')
      h.attach.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
      expect(await (await send()).json()).toEqual({ ok: true, number: 7, attachmentsSaved: false })
    })
  })
})
