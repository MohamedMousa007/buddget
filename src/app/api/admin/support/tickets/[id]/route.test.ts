import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  audit: vi.fn(),
  emit: vi.fn(),
  insert: vi.fn(),
  ticket: {} as Record<string, unknown>,
  body: {} as Record<string, unknown>,
  profile: null as Record<string, unknown> | null,
  language: null as string | null,
  staffName: null as string | null,
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/emitNotification', () => ({ emitNotification: h.emit }))
vi.mock('@/lib/server/notificationDedupe', () => ({ contentDedupeKey: () => 'k' }))
vi.mock('@/lib/server/userDictionary', () => ({ getUserDictionary: async () => ({ serverNotifications: { supportResolvedTitle: (s: string) => `Resolved: ${s}`, supportResolvedBody: (n: number) => `#${n}` } }) }))
vi.mock('@/lib/admin/permissions', () => ({ can: () => true }))
vi.mock('@/lib/server/admin/targets', () => ({ UUID_RE: /^[0-9a-f-]{36}$/i }))
vi.mock('@/lib/server/admin/bodySchemas', () => ({ ticketUpdateBody: {}, readValidated: async () => h.body }))
vi.mock('@/lib/server/admin/guard', () => {
  const table = (name: string) => {
    const q: Record<string, unknown> = {}
    Object.assign(q, {
      select: (_c?: string, o?: { head?: boolean }) => (o?.head ? { eq: async () => ({ count: 4 }) } : q),
      eq: () => q,
      maybeSingle: async () => ({ data: name === 'profiles' ? h.profile : name === 'user_settings' ? { language: h.language } : h.ticket }),
      insert: h.insert,
      update: () => ({ eq: async () => ({ error: null }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    })
    return q
  }
  return {
    guardAdmin: async () => ({ ok: true, ctx: { service: { from: table }, permissions: [], staff: { id: 's', email: 'e', display_name: h.staffName }, audit: h.audit } }),
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
  h.profile = null
  h.language = null
  h.staffName = null
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

describe('replies reach the user localized, deep-linked and personalised', () => {
  beforeEach(() => {
    h.ticket = { ...h.ticket, user_id: 'u1' }
  })

  it('sends an Arabic title with the staff first name and a deep link to the ticket', async () => {
    h.language = 'ar'
    h.staffName = 'Sara Hassan'
    h.body = { op: 'reply', message: 'Done' }
    await call()
    expect(h.emit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      title: 'ردّ Sara من فريق بادجت',
      metadata: { ticketNumber: 7 },
      push: expect.objectContaining({ data: { kind: 'support_reply', ticketNumber: '7' } }),
    }))
  })

  it('fills {{first_name}} in the stored message and the push alike', async () => {
    h.profile = { display_name: 'Mona Adel', name: null }
    h.body = { op: 'reply', message: 'Hi {{first_name}}, fixed.' }
    await call()
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ body: 'Hi Mona, fixed.' }))
    expect(h.emit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ body: 'Hi Mona, fixed.' }))
  })

  it('drops {{first_name}} cleanly when the profile has no name', async () => {
    h.body = { op: 'reply', message: 'Hi {{first_name}}, fixed.' }
    await call()
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ body: 'Hi, fixed.' }))
  })

  it('leaves the placeholder alone in an internal note', async () => {
    h.body = { op: 'reply', message: 'ask {{first_name}}', internal: true }
    await call()
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ body: 'ask {{first_name}}' }))
    expect(h.emit).not.toHaveBeenCalled()
  })

  it('tells the user once when staff resolve the ticket, with a deep link', async () => {
    h.body = { op: 'update', status: 'resolved' }
    await call()
    expect(h.emit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ category: 'support_resolved', dedupeKey: `ticket:${ID}:resolved`, push: { data: { kind: 'support_resolved', ticketNumber: '7' } } }))
  })
})
