/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped JSON */
// Support conversation loop (migration 0346): user writes in, staff reply through the portal API, the user sees an unread
// reply, reads it, answers, the desk sees "needs reply" again, then CSAT once. Synthetic users only (qa-e2e-pr-sup-*),
// a temporary staff row and portal session on one of them, all deleted at the end. Never prints ids or tokens.
import { createHash, randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { app, dropUser, makeStaff, makeUser, mask, svc, type QaUser } from '../pro-rewards/lib'

let user: QaUser, staff: QaUser, other: QaUser
let adminToken = ''
let ticketNumber = 0
let ticketId = ''

const admin = (path: string, init: RequestInit = {}) =>
  app(path, { ...init, token: staff.token, headers: { 'X-Admin-Session': adminToken, 'X-Requested-With': 'buddget-admin', ...(init.headers as Record<string, string>) } })
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })

test.beforeAll(async () => {
  user = await makeUser('sup-user')
  staff = await makeUser('sup-staff')
  other = await makeUser('sup-other')
  await makeStaff(staff)
  // A portal session made the way createAdminSession makes one: only the hash is stored.
  adminToken = randomBytes(32).toString('base64url')
  const s = await svc('admin_sessions', post({ user_id: staff.id, token_hash: createHash('sha256').update(adminToken).digest('hex'), method: 'password_email', expires_at: new Date(Date.now() + 3_600_000).toISOString() }))
  expect(s.status, mask(s.text)).toBeLessThan(300)
  await svc('profiles?id=eq.' + user.id, { method: 'PATCH', body: JSON.stringify({ display_name: 'Mona QA' }) })
})

test.afterAll(async () => {
  for (const u of [user, other]) if (u) await svc(`support_tickets?user_id=eq.${u.id}`, { method: 'DELETE' })
  if (staff) {
    await svc(`admin_sessions?user_id=eq.${staff.id}`, { method: 'DELETE' })
    // The audit actor may be the staff row or the account: clear both so dropUser is never blocked.
    const st = (await svc(`admin_staff?user_id=eq.${staff.id}&select=id`)).json?.[0]?.id
    for (const actor of [st, staff.id].filter(Boolean)) await svc(`admin_audit_log?actor_id=eq.${actor}`, { method: 'DELETE' })
  }
  for (const u of [user, other, staff]) if (u) await dropUser(u)
})

test('S1 the user writes in with device context; the desk sees it as needing a reply, unread', async () => {
  const r = await app('/api/support/submit', { ...post({ chosen: 'question', title: 'QA support loop', description: 'Where do I see my replies?', context: { platform: 'web', appVersion: '1.0.0', osVersion: 'macOS 15', locale: 'en', timezone: 'Africa/Cairo', route: '/settings/help' } }), token: user.token })
  expect(r.status, mask(r.text)).toBe(200)
  ticketNumber = r.json.number
  ticketId = (await svc(`support_tickets?number=eq.${ticketNumber}&user_id=eq.${user.id}&select=id,context,last_message_from`)).json[0].id
  const desk = await admin('/api/admin/support/tickets?view=needs_reply')
  expect(desk.status, mask(desk.text)).toBe(200)
  const row = desk.json.tickets.find((t: any) => t.number === ticketNumber)
  expect(row).toMatchObject({ needs_reply: true, unread: true, last_message_from: 'user' })
  const summary = await admin('/api/admin/support/summary')
  expect(summary.json.needsReply).toBeGreaterThanOrEqual(1)
})

test('S2 staff open and reply with {{first_name}}; the user gets a deep-linked notification row', async () => {
  const detail = await admin(`/api/admin/support/tickets/${ticketId}`)
  expect(detail.json.ticket.context).toMatchObject({ osVersion: 'macOS 15', timezone: 'Africa/Cairo' })
  const after = (await admin('/api/admin/support/tickets?view=needs_reply')).json.tickets.find((t: any) => t.number === ticketNumber)
  expect(after.unread).toBe(false)

  const reply = await admin(`/api/admin/support/tickets/${ticketId}`, post({ op: 'reply', message: 'Hi {{first_name}}, they are under Messages.' }))
  expect(reply.status, mask(reply.text)).toBe(200)
  const note = (await svc(`notifications?user_id=eq.${user.id}&select=title,message,metadata`)).json.find((n: any) => n.metadata?.ticketNumber === ticketNumber)
  expect(note).toBeTruthy()
  expect(note.message).toBe('Hi Mona, they are under Messages.')
  expect(note.metadata.category).toBe('support_reply')
  const desk = (await admin('/api/admin/support/tickets?view=needs_reply')).json.tickets.map((t: any) => t.number)
  expect(desk).not.toContain(ticketNumber)
})

test('S3 the user sees an unread reply, opening the thread reads it, staff show by first name only', async () => {
  const list = await app('/api/support/tickets', { token: user.token })
  const row = list.json.tickets.find((t: any) => t.number === ticketNumber)
  expect(row).toMatchObject({ unread: true, display_status: 'waiting', last_message_from: 'staff' })
  expect(list.json.unread).toBeGreaterThanOrEqual(1)

  const thread = await app(`/api/support/tickets/${ticketNumber}`, { token: user.token })
  const staffMsg = thread.json.messages.find((m: any) => m.author_type === 'staff')
  expect(staffMsg).toMatchObject({ author_label: 'buddget support', author_name: 'QA', body: 'Hi Mona, they are under Messages.' })
  expect(thread.text).not.toContain('@buddget-qa.test')

  const again = await app('/api/support/tickets', { token: user.token })
  expect(again.json.tickets.find((t: any) => t.number === ticketNumber).unread).toBe(false)
})

test('S4 another user cannot read, reply to or rate the ticket', async () => {
  expect((await app(`/api/support/tickets/${ticketNumber}`, { token: other.token })).status).toBe(404)
  expect((await app(`/api/support/tickets/${ticketNumber}`, { ...post({ message: 'not mine' }), token: other.token })).status).toBe(404)
  expect((await app(`/api/support/tickets/${ticketNumber}/csat`, { ...post({ rating: -1 }), token: other.token })).status).toBe(409)
})

test('S5 the user answers; the desk sees it needing a reply again, unread', async () => {
  const r = await app(`/api/support/tickets/${ticketNumber}`, { ...post({ message: 'Found it, thanks' }), token: user.token })
  expect(r.status, mask(r.text)).toBe(200)
  const row = (await admin('/api/admin/support/tickets?view=needs_reply')).json.tickets.find((t: any) => t.number === ticketNumber)
  expect(row).toMatchObject({ needs_reply: true, unread: true, status: 'open' })
})

test('S6 resolved: CSAT is taken once, a reply reopens, and the desk shows the rating', async () => {
  expect((await app(`/api/support/tickets/${ticketNumber}/csat`, { ...post({ rating: 1 }), token: user.token })).status).toBe(409)
  expect((await admin(`/api/admin/support/tickets/${ticketId}`, post({ op: 'update', status: 'resolved' }))).status).toBe(200)
  const thread = await app(`/api/support/tickets/${ticketNumber}`, { token: user.token })
  expect(thread.json.ticket).toMatchObject({ display_status: 'resolved', can_rate: true, can_reply: true })
  expect((await app(`/api/support/tickets/${ticketNumber}/csat`, { ...post({ rating: 1, comment: 'quick' }), token: user.token })).status).toBe(200)
  expect((await app(`/api/support/tickets/${ticketNumber}/csat`, { ...post({ rating: -1 }), token: user.token })).status).toBe(409)
  expect((await admin(`/api/admin/support/tickets/${ticketId}`)).json.ticket).toMatchObject({ csat_rating: 1, csat_comment: 'quick' })
  await app(`/api/support/tickets/${ticketNumber}`, { ...post({ message: 'One more thing' }), token: user.token })
  expect((await svc(`support_tickets?id=eq.${ticketId}&select=status`)).json[0].status).toBe('open')
})
