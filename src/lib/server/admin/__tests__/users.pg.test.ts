import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { OWNER_EMAIL } from '@/lib/admin/permissions'
import { adminPool, closePools, pgEnabled } from './harness/pgSupabase'
import { call, codeFor, makeStaff, makeUser, q, resetRateLimits, resetWorld, unlock, type Staff, type TestUser } from './harness/world'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', async () => (await import('./harness/mocks')).serviceMock())
vi.mock('@/lib/supabase/resolveRouteUser', async () => (await import('./harness/mocks')).routeUserMock())
vi.mock('@/lib/auth/resolveDeviceId', async () => (await import('./harness/mocks')).deviceMock())
vi.mock('@supabase/supabase-js', async () => (await import('./harness/mocks')).supabaseJsMock())
vi.mock('@/lib/server/firebaseAdmin', () => ({ getFirebaseAdmin: () => null }))

import { POST as login } from '@/app/api/admin/auth/login/route'
import { GET as usersList } from '@/app/api/admin/users/route'
import { GET as userGet, POST as userPost } from '@/app/api/admin/users/[id]/route'
import { GET as userActivity } from '@/app/api/admin/users/[id]/activity/route'

describe.skipIf(!pgEnabled)('user management (real Postgres)', () => {
  let owner: Staff, admin: Staff, lead: Staff, agent: Staff
  let tOwner: string, tAdmin: string, tLead: string, tAgent: string
  let u: TestUser

  const act = (who: Staff, token: string, id: string, body: Record<string, unknown>) =>
    call(userPost, { method: 'POST', as: who, token, params: { id }, body })
  const fresh = async (who: Staff) => codeFor(who)

  beforeAll(async () => {
    process.env.ADMIN_AUTH_SECRET = 'qa-secret'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'qa'
  })
  afterAll(closePools)
  beforeEach(async () => {
    await resetWorld()
    await resetRateLimits()
    owner = await makeStaff(OWNER_EMAIL, 'owner', { name: 'Owner' })
    admin = await makeStaff('admin@x.com', 'admin')
    lead = await makeStaff('lead@x.com', 'support_lead')
    agent = await makeStaff('agent@x.com', 'support_agent')
    tOwner = await unlock(login, owner)
    tAdmin = await unlock(login, admin)
    tLead = await unlock(login, lead)
    tAgent = await unlock(login, agent)
    u = await makeUser('sara@example.com', { name: 'Sara' })
  })

  describe('directory', () => {
    it('searches, filters, sorts and pages', async () => {
      const b = await makeUser('bob@example.com', { name: 'Bob' })
      await q(`insert into expenses (user_id, amount) select $1, 5 from generate_series(1,3)`, [b.id])
      await q(`insert into expenses (user_id, amount) select $1, 5 from generate_series(1,1)`, [u.id])
      await q(`update user_settings set sms_tracking_enabled = true where user_id=$1`, [b.id])
      await q(`update auth.users set banned_until = now() + interval '1 day' where id=$1`, [u.id])
      const get = (query: Record<string, string>) => call(usersList, { as: admin, token: tAdmin, query })

      expect((await get({})).body.total).toBe(6)
      expect((await get({ q: 'sara' })).body.rows.map((r: { id: string }) => r.id)).toEqual([u.id])
      expect((await get({ q: 'BOB' })).body.rows).toHaveLength(1)
      expect((await get({ q: u.id })).body.rows).toHaveLength(1)
      expect((await get({ q: "o'brien; drop table x" })).body.total).toBe(0)
      expect((await get({ state: 'sms' })).body.rows.map((r: { id: string }) => r.id)).toEqual([b.id])
      expect((await get({ state: 'banned' })).body.rows.map((r: { id: string }) => r.id)).toEqual([u.id])
      expect((await get({ order: 'expenses_desc', q: 'example.com' })).body.rows[0].id).toBe(b.id)
      expect((await get({ order: 'email_asc' })).body.rows[0].email).toContain('admin')
      const page1 = await get({ limit: '2', offset: '0', order: 'email_asc' })
      const page2 = await get({ limit: '2', offset: '2', order: 'email_asc' })
      expect(page1.body.rows).toHaveLength(2)
      expect(page1.body.rows.map((r: { id: string }) => r.id)).not.toEqual(page2.body.rows.map((r: { id: string }) => r.id))
      expect(page1.body.total).toBe(6)
      expect((await get({ offset: '999' })).body.rows).toEqual([])
      // junk parameters fall back to safe defaults
      expect((await get({ order: 'DROP', state: 'bogus', limit: '-5', offset: '-1' })).status).toBe(200)
    })

    it('reports plan, activity and platform columns', async () => {
      await q(`insert into app_analytics_events (user_id, event_type) values ($1,'session_start')`, [u.id])
      await q(`insert into push_tokens (user_id, token, platform) values ($1,'t1','ios'), ($1,'t2','android')`, [u.id])
      const r = await call(usersList, { as: admin, token: tAdmin, query: { q: 'sara' } })
      expect(r.body.rows[0]).toMatchObject({ plan_key: 'free', plan_status: 'active', confirmed: true, expenses: 0 })
      expect(r.body.rows[0].last_active_at).toBeTruthy()
      expect(r.body.rows[0].platforms.split(',').sort()).toEqual(['android', 'ios'])
    })
  })

  describe('profile', () => {
    it('returns the user overview with counts, devices and an entitlement', async () => {
      await q(`insert into expenses (user_id, amount) values ($1, 9), ($1, 9)`, [u.id])
      await q(`insert into sms_parse_log (user_id, source, raw_body, status) values ($1,'x','b','failed'), ($1,'x','b','logged')`, [u.id])
      await q(`insert into sms_ingest_tokens (user_id) values ($1)`, [u.id])
      const r = await call(userGet, { as: admin, token: tAdmin, params: { id: u.id } })
      expect(r.status).toBe(200)
      expect(r.body.counts).toMatchObject({ expenses: 2, sms_total: 2, sms_failed: 1 })
      expect(r.body.devices.sms_tokens_active).toBe(1)
      expect(r.body.plans.map((p: { key: string }) => p.key)).toEqual(['free'])
      expect(r.body.auth.providers).toEqual(['email'])
    })

    it('ignores soft-deleted rows in counts', async () => {
      await q(`insert into expenses (user_id, amount, deleted_at) values ($1, 9, now())`, [u.id])
      expect((await call(userGet, { as: admin, token: tAdmin, params: { id: u.id } })).body.counts.expenses).toBe(0)
    })

    it('404s for unknown users and 400s for malformed ids', async () => {
      expect((await call(userGet, { as: admin, token: tAdmin, params: { id: '00000000-0000-4000-8000-000000000000' } })).status).toBe(404)
      expect((await call(userGet, { as: admin, token: tAdmin, params: { id: "1'; drop table x;--" } })).status).toBe(400)
      expect((await act(admin, tAdmin, '00000000-0000-4000-8000-000000000000', { op: 'note', body: 'x' })).status).toBe(404)
    })
  })

  describe('actions', () => {
    it('adds notes, trims and rejects empty ones', async () => {
      expect((await act(lead, tLead, u.id, { op: 'note', body: '   ' })).status).toBe(400)
      expect((await act(lead, tLead, u.id, { op: 'note', body: ' called them ', pinned: true })).status).toBe(200)
      const [n] = await q<{ body: string; pinned: boolean; author_label: string }>(`select * from admin_user_notes`)
      expect(n).toMatchObject({ body: 'called them', pinned: true })
      const r = await call(userGet, { as: lead, token: tLead, params: { id: u.id } })
      expect(r.body.notes).toHaveLength(1)
    })

    it('suspends and restores, and refuses to suspend yourself, peers, superiors and the owner', async () => {
      expect((await act(lead, tLead, u.id, { op: 'suspend' })).status).toBe(200)
      expect((await q(`select banned_until from auth.users where id=$1`, [u.id]))[0]!.banned_until).toBeTruthy()
      expect((await act(lead, tLead, u.id, { op: 'restore' })).status).toBe(200)
      expect((await q(`select banned_until from auth.users where id=$1`, [u.id]))[0]!.banned_until).toBeNull()
      for (const [who, token, target] of [[lead, tLead, lead.id], [lead, tLead, admin.id], [admin, tAdmin, owner.id], [admin, tAdmin, admin.id]] as const) {
        expect((await act(who, token, target, { op: 'suspend' })).status, `${who.email} -> ${target}`).toBe(403)
      }
      expect((await q(`select count(*)::int n from auth.users where banned_until is not null`))[0]).toMatchObject({ n: 0 })
      // an agent (no users.suspend) cannot do it at all
      expect((await act(agent, tAgent, u.id, { op: 'suspend' })).status).toBe(403)
    })

    it('manages memberships: trials get an end date, invalid input is refused, clearing returns to default', async () => {
      await q(`insert into plans (key, name, status, trial_days) values ('plus','Plus','active',14)`)
      expect((await act(admin, tAdmin, u.id, { op: 'set_entitlement', planKey: 'ghost', status: 'active' })).status).toBe(400)
      expect((await act(admin, tAdmin, u.id, { op: 'set_entitlement', planKey: 'plus', status: 'wat' })).status).toBe(400)
      expect((await act(admin, tAdmin, u.id, { op: 'set_entitlement', planKey: 'plus', status: 'active', periodEnd: 'garbage' })).status).toBe(400)
      const ok = await act(admin, tAdmin, u.id, { op: 'set_entitlement', planKey: 'plus', status: 'trialing', note: 'beta' })
      expect(ok.status).toBe(200)
      const [e] = await q<{ plan_key: string; status: string; days: number; source: string; granted_by: string }>(`select plan_key, status, source, granted_by, round(extract(epoch from trial_ends_at - now())/86400)::int days from user_entitlements`)
      expect(e).toMatchObject({ plan_key: 'plus', status: 'trialing', days: 14, source: 'admin', granted_by: admin.staffId })
      await act(admin, tAdmin, u.id, { op: 'set_entitlement', planKey: 'plus', status: 'trialing', trialDays: 3 })
      expect((await q<{ days: number }>(`select round(extract(epoch from trial_ends_at - now())/86400)::int days from user_entitlements`))[0]!.days).toBe(3)
      await act(admin, tAdmin, u.id, { op: 'set_entitlement', planKey: 'plus', status: 'canceled' })
      expect((await q(`select trial_ends_at, canceled_at from user_entitlements`))[0]).toMatchObject({ trial_ends_at: null })
      expect((await act(admin, tAdmin, u.id, { op: 'clear_entitlement' })).status).toBe(200)
      expect(await q(`select 1 from user_entitlements`)).toHaveLength(0)
    })

    it('sets individual limits with validation, without disturbing the membership (regression)', async () => {
      await q(`insert into plans (key, name, status) values ('plus','Plus','active')`)
      await act(admin, tAdmin, u.id, { op: 'set_entitlement', planKey: 'plus', status: 'trialing' })
      await q(`update user_entitlements set source='apple'`)
      expect((await act(lead, tLead, u.id, { op: 'set_limits', limits: { nope: 1 } })).status).toBe(400)
      expect((await act(lead, tLead, u.id, { op: 'set_limits', limits: { ai_budget_per_hour: -1 } })).status).toBe(400)
      expect((await act(lead, tLead, u.id, { op: 'set_limits', limits: { ai_budget_per_hour: 'many' } })).status).toBe(400)
      const ok = await act(lead, tLead, u.id, { op: 'set_limits', limits: { ai_budget_per_hour: 40.9, receipt_scans_per_month: null }, features: { ai_assistant: true, junk: 'x' } })
      expect(ok.status).toBe(200)
      const [e] = await q<{ plan_key: string; status: string; source: string; limit_overrides: Record<string, unknown>; feature_overrides: Record<string, unknown> }>(`select * from user_entitlements`)
      expect(e).toMatchObject({ plan_key: 'plus', status: 'trialing', source: 'apple' })
      expect(e!.limit_overrides).toEqual({ ai_budget_per_hour: 40, receipt_scans_per_month: null })
      expect(e!.feature_overrides).toEqual({ ai_assistant: true })
    })

    it('creates an entitlement on the default plan when none exists', async () => {
      await act(lead, tLead, u.id, { op: 'set_limits', limits: { ai_budget_per_hour: 5 } })
      expect((await q(`select plan_key, status from user_entitlements`))[0]).toMatchObject({ plan_key: 'free', status: 'active' })
    })

    it('sends an in-app notification with validation', async () => {
      expect((await act(lead, tLead, u.id, { op: 'notify', title: '', body: 'x' })).status).toBe(400)
      expect((await act(lead, tLead, u.id, { op: 'notify', title: 'Hello', body: 'World' })).status).toBe(200)
      expect((await q(`select title, message, type from notifications where user_id=$1`, [u.id]))[0]).toMatchObject({ title: 'Hello', message: 'World', type: 'info' })
    })

    it('repair tools act only on the target user', async () => {
      const other = await makeUser('other@example.com')
      await q(`insert into sms_ingest_tokens (user_id) values ($1), ($2)`, [u.id, other.id])
      await q(`insert into push_tokens (user_id, token, platform) values ($1,'a','ios'), ($2,'b','ios')`, [u.id, other.id])
      await q(`insert into trusted_devices (user_id, device_id) values ($1, gen_random_uuid()), ($2, gen_random_uuid())`, [u.id, other.id])
      await q(`insert into biometric_devices (device_id, user_id, secret_hash) values ('d1',$1,'x'), ('d2',$2,'y')`, [u.id, other.id])
      expect((await act(agent, tAgent, u.id, { op: 'reset_sms_tokens' })).body).toMatchObject({ revoked: 1 })
      expect((await act(agent, tAgent, u.id, { op: 'clear_push_tokens' })).body).toMatchObject({ cleared: 1 })
      expect((await act(agent, tAgent, u.id, { op: 'clear_trusted_devices' })).body).toMatchObject({ cleared: 1 })
      expect((await act(agent, tAgent, u.id, { op: 'remove_biometric' })).body).toMatchObject({ cleared: 1 })
      expect((await q(`select count(*)::int n from sms_ingest_tokens where is_active`))[0]).toMatchObject({ n: 1 })
      expect((await q(`select user_id from push_tokens`))[0]).toMatchObject({ user_id: other.id })
      expect(await q(`select 1 from trusted_devices`)).toHaveLength(1)
      expect(await q(`select 1 from biometric_devices where user_id=$1`, [other.id])).toHaveLength(1)
    })

    it('refuses to strip biometrics from staff above you', async () => {
      await q(`insert into biometric_devices (device_id, user_id, secret_hash) values ('d9',$1,'x')`, [admin.id])
      expect((await act(agent, tAgent, admin.id, { op: 'remove_biometric' })).status).toBe(403)
      expect(await q(`select 1 from biometric_devices where user_id=$1`, [admin.id])).toHaveLength(1)
    })

    it('emails a password reset and verifies email on request', async () => {
      ;(globalThis as { __resetEmails?: string[] }).__resetEmails = []
      expect((await act(agent, tAgent, u.id, { op: 'send_password_reset' })).status).toBe(200)
      expect((globalThis as { __resetEmails?: string[] }).__resetEmails).toEqual(['sara@example.com'])
      const unverified = await makeUser('nov@example.com', { confirmed: false })
      expect((await act(lead, tLead, unverified.id, { op: 'verify_email' })).status).toBe(200)
      expect((await q(`select email_confirmed_at from auth.users where id=$1`, [unverified.id]))[0]!.email_confirmed_at).toBeTruthy()
      expect((await act(agent, tAgent, unverified.id, { op: 'verify_email' })).status).toBe(403)
    })

    it('answers an unknown op with 400, not a crash', async () => {
      expect((await act(admin, tAdmin, u.id, { op: 'rm -rf' })).status).toBe(400)
      expect((await call(userPost, { method: 'POST', as: admin, token: tAdmin, params: { id: u.id } })).status).toBe(400)
    })
  })

  describe('deleting a user', () => {
    beforeEach(async () => {
      await q(`insert into expenses (user_id, amount) values ($1, 1)`, [u.id])
      await q(`insert into goals (user_id, name) values ($1, 'g')`, [u.id])
    })

    it('is owner-only, needs a fresh authenticator code, and erases the account and its data', async () => {
      expect((await act(admin, tAdmin, u.id, { op: 'delete', code: await fresh(admin) })).status).toBe(403)
      expect((await act(owner, tOwner, u.id, { op: 'delete' })).status).toBe(401)
      expect((await act(owner, tOwner, u.id, { op: 'delete', code: '000000' })).status).toBe(401)
      expect(await q(`select 1 from auth.users where id=$1`, [u.id])).toHaveLength(1)
      const ok = await act(owner, tOwner, u.id, { op: 'delete', code: await fresh(owner) })
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
      expect(await q(`select 1 from auth.users where id=$1`, [u.id])).toHaveLength(0)
      expect(await q(`select 1 from expenses where user_id=$1`, [u.id])).toHaveLength(0)
      expect(await q(`select 1 from goals where user_id=$1`, [u.id])).toHaveLength(0)
      expect(await q(`select 1 from profiles where id=$1`, [u.id])).toHaveLength(0)
      expect((await q(`select action, target_id from admin_audit_log where action='user.delete'`))[0]).toMatchObject({ target_id: u.id })
    })

    it('never deletes the owner or yourself, and leaves all data intact when refused', async () => {
      await q(`insert into expenses (user_id, amount) values ($1, 1)`, [owner.id])
      expect((await act(owner, tOwner, owner.id, { op: 'delete', code: await fresh(owner) })).status).toBe(403)
      expect(await q(`select 1 from expenses where user_id=$1`, [owner.id])).toHaveLength(1)
      expect(await q(`select 1 from auth.users where id=$1`, [owner.id])).toHaveLength(1)
    })

    it('deleting a staff member removes their staff record with them', async () => {
      expect((await act(owner, tOwner, agent.id, { op: 'delete', code: await fresh(owner) })).status).toBe(200)
      expect(await q(`select 1 from admin_staff where id=$1`, [agent.staffId])).toHaveLength(0)
    })
  })

  describe('activity timeline', () => {
    it('merges app, SMS, notification, ticket and staff events newest first, without heartbeats', async () => {
      await q(`insert into app_analytics_events (user_id, event_type, created_at) values ($1,'session_start', now() - interval '5 minutes'), ($1,'heartbeat', now())`, [u.id])
      await q(`insert into sms_parse_log (user_id, source, raw_body, status, sender, failure_code, received_at) values ($1,'x','b','failed','CIB','null_amount', now() - interval '1 minute')`, [u.id])
      await q(`insert into notifications (user_id, title, message, type, created_at) values ($1,'Hi','m','warning', now() - interval '10 minutes')`, [u.id])
      await act(lead, tLead, u.id, { op: 'note', body: 'n' })
      await act(lead, tLead, u.id, { op: 'suspend' })
      const r = await call(userActivity, { as: lead, token: tLead, params: { id: u.id } })
      expect(r.status).toBe(200)
      const titles = r.body.events.map((e: { title: string }) => e.title)
      expect(titles.some((t: string) => t.includes('Active in the app'))).toBe(false)
      expect(titles).toEqual(expect.arrayContaining(['Opened the app', 'SMS failed to import (null_amount)', 'Notification: Hi']))
      expect(r.body.events.some((e: { source: string }) => e.source === 'staff')).toBe(true)
      const times = r.body.events.map((e: { at: string }) => e.at)
      expect([...times].sort().reverse()).toEqual(times)
      expect(r.body.events.find((e: { source: string }) => e.source === 'sms').tone).toBe('bad')
    })

    it('is hidden from roles without users.logs', async () => {
      expect((await call(userActivity, { as: admin, token: tAdmin, params: { id: u.id } })).status).toBe(200)
      const viewer = await makeStaff('v@x.com', 'viewer')
      const tv = await unlock(login, viewer)
      expect((await call(userActivity, { as: viewer, token: tv, params: { id: u.id } })).status).toBe(403)
    })
  })

  it('writes an audit entry for every state-changing action', async () => {
    const before = (await q<{ n: number }>(`select count(*)::int n from admin_audit_log`))[0]!.n
    await act(lead, tLead, u.id, { op: 'suspend' })
    await act(lead, tLead, u.id, { op: 'restore' })
    await act(lead, tLead, u.id, { op: 'set_limits', limits: { ai_budget_per_hour: 1 } })
    await act(lead, tLead, u.id, { op: 'notify', title: 'a', body: 'b' })
    const after = await q<{ action: string; actor_email: string; target_type: string; target_id: string }>(`select * from admin_audit_log order by id offset ${before}`)
    expect(after.map((a) => a.action)).toEqual(['user.suspend', 'user.restore', 'user.limits_set', 'user.notify'])
    for (const a of after) expect(a).toMatchObject({ actor_email: 'lead@x.com', target_type: 'user', target_id: u.id })
    void adminPool
  })
})
