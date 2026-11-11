import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ audit: vi.fn(), emit: vi.fn(), insert: vi.fn(), ticket: {} as Record<string, unknown>, body: {} as Record<string, unknown> }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/emitNotification', () => ({ emitNotification: h.emit }))
vi.mock('@/lib/server/notificationDedupe', () => ({ contentDedupeKey: () => 'k' }))
vi.mock('@/lib/admin/permissions', () => ({ can: () => true }))
vi.mock('@/lib/server/admin/targets', () => ({ UUID_RE: /^[0-9a-f-]{36}$/i }))
vi.mock('@/lib/server/admin/bodySchemas', () => ({ ticketUpdateBody: {}, readValidated: async () => h.body }))
vi.mock('@/lib/server/admin/guard', () => {
  const table = (name: string) => {
    const q: Record<string, unknown> = {}
    Object.assign(q, {
      select: (_c?: string, o?: { head?: boolean }) => (o?.head ? { eq: async () => ({ count: 4 }) } : q),
      eq: () => q,
      maybeSingle: async () => ({ data: h.ticket }),
      insert: h.insert,
      update: () => ({ eq: async () => ({ error: null }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    })
    void name
    return q
  }
  return {
    guardAdmin: async () => ({ ok: true, ctx: { service: { from: table }, permissions: [], staff: { id: 's', email: 'e', display_name: null }, audit: h.audit } }),
    json: (b: unknown, status = 200) => Response.json(b, { status }),
    bad: (m: string, status = 400) => Response.json({ error: m }, { status }),
    maskIf: (_c: unknown, e: string) => e,
  }
})

import { POST } from './route'

const ID = '11111111-1111-4111-8111-111111111111'
const call = () => POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: ID }) })

beforeEach(() => {
  Object.values(h).forEach((m) => typeof m === 'function' && 'mockReset' in m && (m as ReturnType<typeof vi.fn>).mockReset())
  h.insert.mockResolvedValue({ error: null })
  h.ticket = { id: ID, number: 7, user_id: null, subject: 'Sync broke', status: 'open', priority: 'high', category: 'sync', created_at: '2026-11-01', first_response_at: null }
})

describe('ADS-12 replies with nobody to notify', () => {
  it('refuses a public reply on a ticket with no app account, saves nothing', async () => {
    h.body = { op: 'reply', message: 'Fixed' }
    expect((await call()).status).toBe(409)
    expect(h.insert).not.toHaveBeenCalled()
    expect(h.audit).not.toHaveBeenCalled()
  })
  it('still allows an internal note', async () => {
    h.body = { op: 'reply', message: 'note', internal: true }
    expect((await call()).status).toBe(200)
    expect(h.insert).toHaveBeenCalled()
  })
  it('notifies when the ticket has an account', async () => {
    h.ticket = { ...h.ticket, user_id: 'u1' }
    h.body = { op: 'reply', message: 'Fixed' }
    expect((await call()).status).toBe(200)
    expect(h.emit).toHaveBeenCalled()
  })
})

describe('ADS-13 ticket delete keeps a snapshot in the audit row', () => {
  it('records subject, status and message count, not the text', async () => {
    h.body = { op: 'delete' }
    expect((await call()).status).toBe(200)
    const meta = (h.audit.mock.calls[0][1] as { metadata: Record<string, unknown> }).metadata
    expect(meta).toMatchObject({ number: 7, subject: 'Sync broke', status: 'open', messages: 4 })
  })
})
