import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  uid: vi.fn(),
  limited: vi.fn(),
  ticket: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  messages: vi.fn(),
  eqs: [] as Array<[string, unknown]>,
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: h.uid }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    storage: { from: () => ({ createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}` })) }) }) },
    from: (t: string) => {
      if (t === 'support_tickets') {
        const q = {
          select: () => q,
          eq: (col: string, v: unknown) => { h.eqs.push([col, v]); return q },
          maybeSingle: h.ticket,
          update: (v: unknown) => { const u = { eq: () => u, then: (r: (x: unknown) => void) => r(h.update(v)) }; return u },
        }
        return q
      }
      const m = { select: () => m, eq: () => m, order: () => m, limit: () => h.messages(), insert: (v: unknown) => ({ select: () => ({ single: () => h.insert(v) }) }) }
      return m
    },
  }),
}))

import { GET, POST } from './route'

const UID = '11111111-1111-4111-8111-111111111111'
const params = { params: Promise.resolve({ number: '5' }) }
const post = (body: unknown) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), params)
const get = () => GET(new Request('http://x'), params)
const T0 = '2026-11-24T10:00:00.000Z'
const T1 = '2026-11-24T11:00:00.000Z'

describe('/api/support/tickets/[number]', () => {
  beforeEach(() => {
    for (const m of [h.uid, h.limited, h.ticket, h.insert, h.update, h.messages]) m.mockReset()
    h.eqs.length = 0
    h.uid.mockResolvedValue(UID)
    h.limited.mockResolvedValue(false)
    h.ticket.mockResolvedValue({ data: { id: 't1', number: 5, status: 'resolved', last_message_at: T1, last_message_from: 'staff', user_last_read_at: T0, csat_rating: null } })
    h.insert.mockResolvedValue({ data: { id: 'm1', created_at: T1 }, error: null })
    h.update.mockReturnValue({ error: null })
    h.messages.mockResolvedValue({ data: [{ id: 'm0', author_type: 'staff', author_label: 'Sara Hassan', body: 'hi', created_at: T1, attachments: [] }] })
  })

  it('only loads a ticket owned by the caller', async () => {
    await get()
    expect(h.eqs).toContainEqual(['user_id', UID])
  })

  it('answers 404 for someone else’s ticket number', async () => {
    h.ticket.mockResolvedValue({ data: null })
    expect((await get()).status).toBe(404)
    expect((await post({ message: 'hi' })).status).toBe(404)
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('marks the thread read up to the newest message and shows staff by first name only', async () => {
    const res = await get()
    const body = await res.json()
    expect(h.update).toHaveBeenCalledWith({ user_last_read_at: T1 })
    expect(body.messages[0]).toMatchObject({ author_label: 'buddget support', author_name: 'Sara' })
    expect(body.ticket).toMatchObject({ display_status: 'resolved', can_rate: true, can_reply: true })
  })

  it('does not write a read mark when nothing is new', async () => {
    h.ticket.mockResolvedValue({ data: { id: 't1', number: 5, status: 'pending', last_message_at: T1, last_message_from: 'staff', user_last_read_at: T1, csat_rating: null } })
    await get()
    expect(h.update).not.toHaveBeenCalled()
  })

  it('never shows a staff email as a name', async () => {
    h.messages.mockResolvedValue({ data: [{ id: 'm0', author_type: 'staff', author_label: 'ops@buddget.app', body: 'hi', created_at: T1, attachments: [] }] })
    const body = await (await get()).json()
    expect(body.messages[0].author_name).toBeNull()
    expect(JSON.stringify(body)).not.toContain('ops@buddget.app')
  })

  it('reopens a resolved ticket', async () => {
    expect((await post({ message: 'hi' })).status).toBe(200)
    expect(h.update).toHaveBeenCalledWith({ status: 'open', resolved_at: null })
  })

  it('does not reopen a closed ticket', async () => {
    h.ticket.mockResolvedValue({ data: { id: 't1', number: 5, status: 'closed' } })
    expect((await post({ message: 'hi' })).status).toBe(409)
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('rejects an attachment outside the caller’s folder', async () => {
    const path = '22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.png'
    expect((await post({ message: 'see', attachments: [{ path, mime: 'image/png', size: 10 }] })).status).toBe(400)
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('saves the caller’s own attachment with the message', async () => {
    const att = { path: `${UID}/33333333-3333-4333-8333-333333333333.png`, mime: 'image/png', size: 10 }
    expect((await post({ message: '', attachments: [att] })).status).toBe(200)
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ attachments: [att] }))
  })

  it('rejects an empty message with no attachment', async () => {
    expect((await post({ message: '  ' })).status).toBe(400)
  })

  it('reports a failed message insert and leaves the status alone', async () => {
    h.insert.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect((await post({ message: 'hi' })).status).toBe(500)
    expect(h.update).not.toHaveBeenCalled()
  })

  it('fails closed when the rate limiter is down', async () => {
    h.limited.mockResolvedValue(true)
    expect((await post({ message: 'hi' })).status).toBe(429)
  })
})
