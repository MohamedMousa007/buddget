/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped JSON */
// Round 3 (PR #38). BUD-94: an `admin` confirms a risky action (reset an account's data) in the app instead of an emailed
// code; the proof must be exactly `confirmed: true`, nothing without it, and it is audited. Admins may reset their own
// app account. BUD-107: a reinstall that reports the same install_key under a new device id is merged into one row on the
// server (name and roles carried over, the old device's SMS token switched off). Synthetic users only (qa-e2e-pr-r3-*).
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { app, dropUser, makeStaff, makeUser, mask, svc, type QaUser } from '../round2/pro-rewards/lib'

let staff: QaUser, target: QaUser, phone: QaUser
let adminToken = ''

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })
const admin = (path: string, init: RequestInit = {}) =>
  app(path, { ...init, token: staff.token, headers: { 'X-Admin-Session': adminToken, 'X-Requested-With': 'buddget-admin', ...(init.headers as Record<string, string>) } })
const seedExpense = (u: QaUser, description: string) =>
  svc('expenses', post({ id: randomUUID(), user_id: u.id, amount: 42, currency: 'EGP', category: 'Food', description, expense_date: '2026-11-20' }))
const expenseCount = async (u: QaUser) => ((await svc(`expenses?user_id=eq.${u.id}&deleted_at=is.null&select=id`)).json ?? []).length

test.beforeAll(async () => {
  staff = await makeUser('r3-admin')
  target = await makeUser('r3-target')
  phone = await makeUser('r3-phone')
  await makeStaff(staff)
  const cred = await svc('admin_credentials', post({ user_id: staff.id, password_hash: 'qa-not-a-real-hash', setup_completed_at: new Date().toISOString() }))
  expect(cred.status, mask(cred.text)).toBeLessThan(300)
  adminToken = randomBytes(32).toString('base64url')
  const s = await svc('admin_sessions', post({ user_id: staff.id, token_hash: createHash('sha256').update(adminToken).digest('hex'), method: 'password_email', expires_at: new Date(Date.now() + 3_600_000).toISOString() }))
  expect(s.status, mask(s.text)).toBeLessThan(300)
})

test.afterAll(async () => {
  if (staff) {
    await svc(`admin_sessions?user_id=eq.${staff.id}`, { method: 'DELETE' })
    await svc(`admin_credentials?user_id=eq.${staff.id}`, { method: 'DELETE' })
    const st = (await svc(`admin_staff?user_id=eq.${staff.id}&select=id`)).json?.[0]?.id
    for (const actor of [st, staff.id].filter(Boolean)) await svc(`admin_audit_log?actor_id=eq.${actor}`, { method: 'DELETE' })
  }
  for (const u of [target, phone, staff]) if (u) await dropUser(u)
})

test('A1 BUD-94 an admin reset with no proof, or a proof that is not exactly true, is refused and erases nothing', async () => {
  expect((await seedExpense(target, 'QA R3 keep me')).status).toBeLessThan(300)
  for (const body of [{ op: 'reset_data' }, { op: 'reset_data', confirmed: 'true' }, { op: 'reset_data', confirmed: 1 }]) {
    const r = await admin(`/api/admin/users/${target.id}`, post(body))
    expect(r.status, mask(r.text)).toBe(401)
    expect(r.json?.error).toMatch(/code we emailed you or your admin password/)
  }
  expect(await expenseCount(target)).toBe(1)
})

test('A2 BUD-94 an admin confirms in the app: the reset runs and the in-app confirm is audited', async () => {
  const r = await admin(`/api/admin/users/${target.id}`, post({ op: 'reset_data', confirmed: true }))
  expect(r.status, mask(r.text)).toBe(200)
  expect(r.json).toMatchObject({ ok: true })
  await expect.poll(() => expenseCount(target)).toBe(0)
  const st = (await svc(`admin_staff?user_id=eq.${staff.id}&select=id`)).json?.[0]?.id
  const audit = (await svc(`admin_audit_log?actor_id=in.(${[st, staff.id].filter(Boolean).join(',')})&action=eq.auth.step_up_inapp&select=metadata`)).json ?? []
  expect(audit.length).toBeGreaterThanOrEqual(1)
  expect(audit[0].metadata).toMatchObject({ method: 'inapp_confirm', role: 'admin' })
})

test('A3 BUD-94 an admin may reset their own app account with the in-app confirm', async () => {
  expect((await seedExpense(staff, 'QA R3 my own')).status).toBeLessThan(300)
  const r = await admin(`/api/admin/users/${staff.id}`, post({ op: 'reset_data', confirmed: true }))
  expect(r.status, mask(r.text)).toBe(200)
  await expect.poll(() => expenseCount(staff)).toBe(0)
})

test('D1 BUD-107 a reinstall with the same install_key under a new device id leaves one row with the old name and roles', async () => {
  const installKey = randomBytes(32).toString('hex')
  const oldId = randomUUID()
  const newId = randomUUID()
  const beat = (deviceId: string) => app('/api/devices', { ...post({ platform: 'android', model: 'QA Pixel', installKey }), token: phone.token, headers: { 'X-Buddget-Device-Id': deviceId } })

  const first = await beat(oldId)
  expect(first.status, mask(first.text)).toBe(200)
  await expect.poll(async () => (await svc(`user_devices?user_id=eq.${phone.id}&device_id=eq.${oldId}&select=install_key`)).json?.[0]?.install_key ?? null).toBe(installKey)
  // The first install was named, is the main phone, hears notifications and has an SMS token.
  await svc(`user_devices?user_id=eq.${phone.id}&device_id=eq.${oldId}`, { method: 'PATCH', body: JSON.stringify({ name: 'QA kitchen phone', is_main: true, notify: true }) })
  const tok = await svc('sms_ingest_tokens', post({ user_id: phone.id, device_id: oldId, token_hash: createHash('sha256').update(randomUUID()).digest('hex'), is_active: true }))
  expect(tok.status, mask(tok.text)).toBeLessThan(300)

  const second = await beat(newId)
  expect(second.status, mask(second.text)).toBe(200)
  const rows = async () => (await svc(`user_devices?user_id=eq.${phone.id}&revoked_at=is.null&select=device_id,name,is_main,notify,install_key`)).json ?? []
  await expect.poll(async () => (await rows()).map((r: any) => r.device_id)).toEqual([newId])
  expect((await rows())[0]).toMatchObject({ name: 'QA kitchen phone', is_main: true, notify: true, install_key: installKey })
  const tokens = (await svc(`sms_ingest_tokens?user_id=eq.${phone.id}&device_id=eq.${oldId}&select=is_active`)).json ?? []
  expect(tokens.every((t: any) => t.is_active === false)).toBe(true)

  // The same phone beating again changes nothing.
  expect((await beat(newId)).status).toBe(200)
  expect((await rows()).length).toBe(1)
})
