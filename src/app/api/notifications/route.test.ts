import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ uid: vi.fn(), list: vi.fn(), upd: vi.fn(), count: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: h.uid }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => {
      const head = { eq: () => ({ eq: () => h.count() }) }
      const q: Record<string, unknown> = { select: (_c?: string, o?: { head?: boolean }) => (o?.head ? head : q), eq: () => q, order: () => q, limit: h.list, update: () => q, in: () => h.upd() }
      ;(q as { then: unknown }).then = undefined
      return Object.assign(q, { eq: () => Object.assign(q, { eq: () => h.upd() }) })
    },
  }),
}))

import { GET, PATCH } from './route'

const patch = (body: unknown) => PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) }))

describe('/api/notifications', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => m.mockReset())
    h.uid.mockResolvedValue('u1')
    h.count.mockResolvedValue({ count: 1, error: null })
  })

  it('lists the caller notifications', async () => {
    h.list.mockResolvedValue({ data: [{ id: 'a', is_read: false }], error: null })
    expect(await (await GET(new Request('http://x'))).json()).toEqual({ notifications: [{ id: 'a', is_read: false }], unreadCount: 1 })
  })

  it('NAT-7 unreadCount comes from the database count, not the 80-row page', async () => {
    h.list.mockResolvedValue({ data: [{ id: 'a', is_read: false }], error: null })
    h.count.mockResolvedValue({ count: 137, error: null })
    expect((await (await GET(new Request('http://x'))).json()).unreadCount).toBe(137)
  })

  it('reports a read failure instead of an empty list', async () => {
    h.list.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect((await GET(new Request('http://x'))).status).toBe(500)
  })

  it('reports a failed mark-as-read', async () => {
    h.upd.mockResolvedValue({ error: { message: 'boom' } })
    expect((await patch({ markAllRead: true })).status).toBe(500)
  })

  it('needs a caller', async () => {
    h.uid.mockResolvedValue(null)
    expect((await GET(new Request('http://x'))).status).toBe(401)
  })
})
