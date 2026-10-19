import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { OWNER_EMAIL } from '@/lib/admin/permissions'
import { adminPool, closePools, pgEnabled } from './harness/pgSupabase'
import { call, clearStep, codeFor, makeStaff, makeUser, q, resetRateLimits, resetWorld, unlock, type Staff } from './harness/world'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', async () => (await import('./harness/mocks')).serviceMock())
vi.mock('@/lib/supabase/resolveRouteUser', async () => (await import('./harness/mocks')).routeUserMock())
vi.mock('@/lib/auth/resolveDeviceId', async () => (await import('./harness/mocks')).deviceMock())
const mail = vi.hoisted(() => ({ send: vi.fn(async (_email: string) => true) }))
vi.mock('@/lib/server/admin/inviteEmail', () => ({ sendStaffInviteEmail: (_s: unknown, email: string) => mail.send(email) }))
vi.mock('@supabase/supabase-js', async () => (await import('./harness/mocks')).supabaseJsMock())

import { POST as login } from '@/app/api/admin/auth/login/route'
import { GET as staffGet, POST as staffPost } from '@/app/api/admin/staff/route'
import { GET as overview } from '@/app/api/admin/overview/route'

describe.skipIf(!pgEnabled)('team & roles (real Postgres)', () => {
  let owner: Staff, admin: Staff, lead: Staff, agent: Staff
  let tOwner: string, tAdmin: string, tLead: string

  /** A fresh authenticator code for `who` that has not been spent yet. */
  const fresh = async (who: Staff) => { await clearStep(who.id); return codeFor(who) }
  const act = async (who: Staff, token: string, body: Record<string, unknown>) => {
    return call(staffPost, { method: 'POST', as: who, token, body })
  }

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
  })

  describe('listing', () => {
    it('shows team, roles, the permission catalog and the caller’s rank', async () => {
      const r = await call(staffGet, { as: admin, token: tAdmin })
      expect(r.status).toBe(200)
      expect(r.body.staff).toHaveLength(4)
      expect(r.body.actorRank).toBe(10)
      expect(r.body.roles.map((x: { key: string }) => x.key)).toEqual(expect.arrayContaining(['owner', 'admin', 'viewer']))
      expect(r.body.permissions['users.delete']).toBeTruthy()
      const me = r.body.staff.find((s: { email: string }) => s.email === 'admin@x.com')
      expect(me.secured).toBe(true)
      expect(me.liveSessions).toBe(1)
      // never leaks credential material
      expect(JSON.stringify(r.body)).not.toMatch(/password_hash|totp_secret|recovery_hashes|token_hash/)
    })
  })

  describe('invite email', () => {
    beforeEach(() => { mail.send.mockClear(); mail.send.mockResolvedValue(true) })

    it('emails the sign-in link when someone is added, and records it', async () => {
      const r = await act(admin, tAdmin, { op: 'invite', email: 'Mail@X.com', roleKey: 'viewer' })
      expect(r.body).toMatchObject({ ok: true, emailSent: true })
      expect(mail.send).toHaveBeenCalledWith('mail@x.com')
      expect((await q(`select 1 from admin_audit_log where action='staff.invite_email' and target_id='mail@x.com'`)).length).toBe(1)
    })

    it('adds without emailing when asked not to', async () => {
      const r = await act(admin, tAdmin, { op: 'invite', email: 'quiet@x.com', roleKey: 'viewer', sendEmail: false })
      expect(r.body).toMatchObject({ ok: true, emailSent: false })
      expect(mail.send).not.toHaveBeenCalled()
    })

    it('still adds the person and reports it when the email cannot be sent', async () => {
      mail.send.mockResolvedValue(false)
      const r = await act(admin, tAdmin, { op: 'invite', email: 'fail@x.com', roleKey: 'viewer' })
      expect(r.body).toMatchObject({ ok: true, emailSent: false })
      expect((await q(`select 1 from admin_staff where email='fail@x.com'`)).length).toBe(1)
      expect((await q(`select 1 from admin_audit_log where action='staff.invite_email_failed'`)).length).toBe(1)
    })

    it('resends to a pending teammate, but not to suspended people or those above your level', async () => {
      await act(admin, tAdmin, { op: 'invite', email: 'again@x.com', roleKey: 'viewer', sendEmail: false })
      const [{ id }] = await q<{ id: string }>(`select id from admin_staff where email='again@x.com'`)
      expect((await act(admin, tAdmin, { op: 'resend_invite', id })).body).toMatchObject({ emailSent: true })
      expect(mail.send).toHaveBeenCalledWith('again@x.com')
      await q(`update admin_staff set status='suspended' where id=$1`, [id])
      expect((await act(admin, tAdmin, { op: 'resend_invite', id })).status).toBe(400)
      expect((await act(lead, tLead, { op: 'resend_invite', id: admin.staffId })).status).toBe(403)
    })

    it('limits how often one address can be emailed', async () => {
      await act(admin, tAdmin, { op: 'invite', email: 'spam@x.com', roleKey: 'viewer', sendEmail: false })
      const [{ id }] = await q<{ id: string }>(`select id from admin_staff where email='spam@x.com'`)
      for (let i = 0; i < 5; i++) expect((await act(admin, tAdmin, { op: 'resend_invite', id })).body.emailSent).toBe(true)
      expect((await act(admin, tAdmin, { op: 'resend_invite', id })).body.emailSent).toBe(false)
    })
  })

  describe('invite', () => {
    it('lets an admin add someone below their rank, and the invitation binds on that person’s first visit', async () => {
      const r = await act(admin, tAdmin, { op: 'invite', email: 'New@X.com ', roleKey: 'support_agent', displayName: 'Nora', department: 'Support' })
      expect(r.status).toBe(200)
      const [row] = await q<{ email: string; user_id: string | null; invited_by: string }>(`select email, user_id, invited_by from admin_staff where email='new@x.com'`)
      expect(row).toMatchObject({ email: 'new@x.com', user_id: null, invited_by: admin.staffId })
    })

    it.each([
      ['an owner role', { email: 'a@x.com', roleKey: 'owner' }, 400],
      ['the owner email', { email: OWNER_EMAIL, roleKey: 'viewer' }, 400],
      ['a role at the caller’s own rank', { email: 'a@x.com', roleKey: 'admin' }, 403],
      ['a role above the caller', { email: 'a@x.com', roleKey: 'owner' }, 400],
      ['a malformed email', { email: 'not-an-email', roleKey: 'viewer' }, 400],
      ['an unknown role', { email: 'a@x.com', roleKey: 'ghost' }, 400],
      ['a permission the caller lacks', { email: 'a@x.com', roleKey: 'viewer', extraPermissions: ['users.delete'] }, 403],
    ])('refuses %s', async (_name, body, status) => {
      const r = await act(admin, tAdmin, { op: 'invite', ...body })
      expect(r.status).toBe(status)
      expect(await q(`select 1 from admin_staff where email='a@x.com'`)).toHaveLength(0)
    })

    it('rejects duplicates case-insensitively', async () => {
      expect((await act(admin, tAdmin, { op: 'invite', email: 'AGENT@x.com', roleKey: 'viewer' })).status).toBe(409)
    })

    it('stops a lead (no staff.manage) outright', async () => {
      expect((await act(lead, tLead, { op: 'invite', email: 'z@x.com', roleKey: 'viewer' })).status).toBe(403)
    })

    it('lets the owner grant any permission and any non-owner role', async () => {
      expect((await act(owner, tOwner, { op: 'invite', email: 'ops@x.com', roleKey: 'admin', extraPermissions: ['users.delete'] })).status).toBe(200)
      const [row] = await q<{ extra_permissions: string[] }>(`select extra_permissions from admin_staff where email='ops@x.com'`)
      expect(row!.extra_permissions).toEqual(['users.delete'])
    })
  })

  describe('changing a teammate', () => {
    it('needs a fresh authenticator code for role or permission changes', async () => {
      const noCode = await act(admin, tAdmin, { op: 'update', id: agent.staffId, roleKey: 'viewer' })
      expect(noCode.status).toBe(401)
      const badCode = await act(admin, tAdmin, { op: 'update', id: agent.staffId, roleKey: 'viewer', code: '000000' })
      expect(badCode.status).toBe(401)
      expect((await q(`select role_key from admin_staff where id=$1`, [agent.staffId]))[0]).toMatchObject({ role_key: 'support_agent' })
      const ok = await act(admin, tAdmin, { op: 'update', id: agent.staffId, roleKey: 'viewer', code: await fresh(admin) })
      expect(ok.status).toBe(200)
      expect((await q(`select role_key from admin_staff where id=$1`, [agent.staffId]))[0]).toMatchObject({ role_key: 'viewer' })
    })

    it('signs the teammate out when their role changes', async () => {
      const tAgent = await unlock(login, agent)
      expect((await call(overview, { as: agent, token: tAgent })).status).toBe(403) // agent lacks overview.view, but is signed in
      await act(admin, tAdmin, { op: 'update', id: agent.staffId, roleKey: 'viewer', code: await fresh(admin) })
      expect((await call(overview, { as: agent, token: tAgent })).status).toBe(401)
    })

    it('edits names and departments without a code or a sign-out', async () => {
      const tAgent = await unlock(login, agent)
      const r = await act(admin, tAdmin, { op: 'update', id: agent.staffId, displayName: ' Agent A ', department: 'Care' })
      expect(r.status).toBe(200)
      expect((await q(`select display_name, department from admin_staff where id=$1`, [agent.staffId]))[0]).toMatchObject({ display_name: 'Agent A', department: 'Care' })
      expect((await call(overview, { as: agent, token: tAgent })).status).toBe(403) // still signed in (403 = forbidden, not 401 = locked)
    })

    it('cannot touch peers, superiors or the owner, nor promote above their own rank', async () => {
      const peer = await makeStaff('admin2@x.com', 'admin')
      for (const target of [peer.staffId, owner.staffId]) {
        expect((await act(admin, tAdmin, { op: 'suspend', id: target })).status, `suspend ${target}`).toBe(403)
        expect((await act(admin, tAdmin, { op: 'remove', id: target, code: await fresh(admin) })).status, `remove ${target}`).toBe(403)
      }
      expect((await act(admin, tAdmin, { op: 'update', id: agent.staffId, roleKey: 'admin', code: await fresh(admin) })).status).toBe(403)
      expect((await act(admin, tAdmin, { op: 'update', id: agent.staffId, roleKey: 'owner', code: await fresh(admin) })).status).toBe(400)
      // a lead with staff.manage granted individually is still below admin
      const delegated = await makeStaff('deleg@x.com', 'support_lead', { extra: ['staff.manage'] })
      const td = await unlock(login, delegated)
      expect((await act(delegated, td, { op: 'suspend', id: admin.staffId })).status).toBe(403)
      expect((await act(delegated, td, { op: 'update', id: lead.staffId, roleKey: 'viewer', code: await fresh(delegated) })).status).toBe(403) // peer (same rank)
    })

    it('only hands out permissions the caller holds', async () => {
      const r = await act(admin, tAdmin, { op: 'update', id: agent.staffId, extraPermissions: ['users.delete'], code: await fresh(admin) })
      expect(r.status).toBe(403)
    })

    it('suspends and restores, killing live sessions on suspend', async () => {
      const tAgent = await unlock(login, agent)
      expect((await act(admin, tAdmin, { op: 'suspend', id: agent.staffId })).status).toBe(200)
      expect((await call(overview, { as: agent, token: tAgent })).status).toBe(403)
      expect((await q(`select count(*)::int n from admin_sessions where user_id=$1 and revoked_at is null`, [agent.id]))[0]).toMatchObject({ n: 0 })
      expect((await act(admin, tAdmin, { op: 'restore', id: agent.staffId })).status).toBe(200)
      expect((await q(`select status from admin_staff where id=$1`, [agent.staffId]))[0]).toMatchObject({ status: 'active' })
    })

    it('resets credentials: sessions, password, authenticator and biometrics are all gone', async () => {
      await unlock(login, agent)
      await adminPool().query(`insert into admin_biometric_devices (device_id, user_id, secret_hash) values ('d1',$1,'x')`, [agent.id])
      expect((await act(admin, tAdmin, { op: 'reset_credentials', id: agent.staffId })).status).toBe(401)
      expect((await act(admin, tAdmin, { op: 'reset_credentials', id: agent.staffId, code: await fresh(admin) })).status).toBe(200)
      expect(await q(`select 1 from admin_credentials where user_id=$1`, [agent.id])).toHaveLength(0)
      expect(await q(`select 1 from admin_biometric_devices where user_id=$1`, [agent.id])).toHaveLength(0)
      expect((await q(`select count(*)::int n from admin_sessions where user_id=$1 and revoked_at is null`, [agent.id]))[0]).toMatchObject({ n: 0 })
    })

    it('removes a teammate entirely', async () => {
      expect((await act(admin, tAdmin, { op: 'remove', id: agent.staffId, code: await fresh(admin) })).status).toBe(200)
      expect(await q(`select 1 from admin_staff where id=$1`, [agent.staffId])).toHaveLength(0)
      expect(await q(`select 1 from auth.users where id=$1`, [agent.id])).toHaveLength(1) // the app account itself is untouched
    })

    it('rejects ids that are not staff', async () => {
      expect((await act(admin, tAdmin, { op: 'suspend', id: 'nope' })).status).toBe(400)
      expect((await act(admin, tAdmin, { op: 'suspend', id: '00000000-0000-4000-8000-000000000000' })).status).toBe(404)
      expect((await act(admin, tAdmin, { op: 'explode', id: agent.staffId })).status).toBe(400)
    })
  })

  describe('custom roles', () => {
    const role = { key: 'qa_team', name: 'QA', description: 'Testers', permissions: ['users.view', 'sms.view'], rank: 40 }

    it('creates, edits and deletes a role, with a code for create/edit', async () => {
      expect((await act(admin, tAdmin, { op: 'upsert_role', role })).status).toBe(401)
      expect((await act(admin, tAdmin, { op: 'upsert_role', role, code: await fresh(admin) })).status).toBe(200)
      const [row] = await q<{ permissions: string[]; is_system: boolean; rank: number }>(`select * from admin_roles where key='qa_team'`)
      expect(row).toMatchObject({ permissions: ['users.view', 'sms.view'], is_system: false, rank: 40 })
      expect((await act(admin, tAdmin, { op: 'upsert_role', role: { ...role, permissions: ['users.view'] }, code: await fresh(admin) })).status).toBe(200)
      expect((await act(admin, tAdmin, { op: 'delete_role', key: 'qa_team' })).status).toBe(200)
      expect(await q(`select 1 from admin_roles where key='qa_team'`)).toHaveLength(0)
    })

    it('forbids system roles, owner-only perms, outranking roles and permissions the author lacks', async () => {
      const code = async () => fresh(admin)
      expect((await act(admin, tAdmin, { op: 'upsert_role', role: { ...role, key: 'owner' }, code: await code() })).status).toBe(400)
      expect((await act(admin, tAdmin, { op: 'upsert_role', role: { ...role, key: 'viewer' }, code: await code() })).status).toBe(403)
      expect((await act(admin, tAdmin, { op: 'upsert_role', role: { ...role, rank: 10 }, code: await code() })).status).toBe(403)
      expect((await act(admin, tAdmin, { op: 'upsert_role', role: { ...role, rank: 5 }, code: await code() })).status).toBe(403)
      expect((await act(lead, tLead, { op: 'upsert_role', role, code: await code() })).status).toBe(403)
      const withDelete = await act(admin, tAdmin, { op: 'upsert_role', role: { ...role, permissions: ['users.view', 'users.delete'] }, code: await code() })
      // admin lacks users.delete, so it is refused rather than silently granted
      expect(withDelete.status).toBe(200)
      const [row] = await q<{ permissions: string[] }>(`select permissions from admin_roles where key='qa_team'`)
      expect(row!.permissions).not.toContain('users.delete')
      expect((await act(admin, tAdmin, { op: 'delete_role', key: 'viewer' })).status).toBe(403)
    })

    it('will not delete a role that people hold', async () => {
      await act(admin, tAdmin, { op: 'upsert_role', role, code: await fresh(admin) })
      await act(admin, tAdmin, { op: 'update', id: agent.staffId, roleKey: 'qa_team', code: await fresh(admin) })
      expect((await act(admin, tAdmin, { op: 'delete_role', key: 'qa_team' })).status).toBe(400)
    })

    it('gives a custom-role holder exactly the listed permissions', async () => {
      await act(admin, tAdmin, { op: 'upsert_role', role, code: await fresh(admin) })
      const c = await makeStaff('qa@x.com', 'qa_team')
      const tc = await unlock(login, c)
      expect((await call(staffGet, { as: c, token: tc })).status).toBe(403)
      const { GET: smsHealth } = await import('@/app/api/admin/sms/health/route')
      expect((await call(smsHealth, { as: c, token: tc })).status).toBe(200)
    })
  })

  describe('owner immutability', () => {
    it('is enforced by the API', async () => {
      for (const body of [
        { op: 'update', roleKey: 'viewer' }, { op: 'suspend' }, { op: 'remove' }, { op: 'reset_credentials' },
      ]) {
        const r = await act(owner, tOwner, { ...body, id: owner.staffId, code: await fresh(owner) })
        expect(r.status, JSON.stringify(body)).toBe(403)
      }
      expect((await q(`select role_key, status from admin_staff where id=$1`, [owner.staffId]))[0]).toMatchObject({ role_key: 'owner', status: 'active' })
    })

    it('is enforced by the database even for direct writes', async () => {
      const db = adminPool()
      await expect(db.query(`update admin_staff set role_key='admin' where id=$1`, [owner.staffId])).rejects.toThrow(/immutable/)
      await expect(db.query(`update admin_staff set status='suspended' where id=$1`, [owner.staffId])).rejects.toThrow(/immutable/)
      await expect(db.query(`update admin_staff set email='x@y.com' where id=$1`, [owner.staffId])).rejects.toThrow(/immutable|Only m.mousaofficial/)
      await expect(db.query(`delete from admin_staff where id=$1`, [owner.staffId])).rejects.toThrow(/cannot be removed/)
      await expect(db.query(`insert into admin_staff (email, role_key) values ('imp@x.com','owner')`)).rejects.toThrow()
      await expect(db.query(`update admin_staff set role_key='owner' where id=$1`, [admin.staffId])).rejects.toThrow()
      await expect(db.query(`update admin_roles set permissions='{}' where key='owner'`)).rejects.toThrow(/immutable/)
      await expect(db.query(`delete from admin_roles where key='admin'`)).rejects.toThrow(/cannot be deleted/)
      await expect(db.query(`update admin_staff set display_name='Boss' where id=$1`, [owner.staffId])).resolves.toBeTruthy()
    })

    it('survives deleting the owner’s auth account being attempted through the app', async () => {
      await expect(adminPool().query(`delete from auth.users where id=$1`, [owner.id])).rejects.toThrow(/cannot be removed/)
    })

    it('a second user cannot become owner by registering the same email in another case', async () => {
      const dupe = await makeUser('M.MousaOfficial@gmail.com').catch(() => null)
      if (dupe) {
        const { GET: status } = await import('@/app/api/admin/auth/status/route')
        const r = await call(status, { as: dupe })
        // Either not staff, or bound to the existing owner row — never a second owner.
        expect((await q(`select count(*)::int n from admin_staff where role_key='owner'`))[0]).toMatchObject({ n: 1 })
        expect(r.body.isStaff === false || r.body.staff?.role === 'owner').toBe(true)
      }
    })
  })

  describe('audit', () => {
    it('records team changes with actor and target', async () => {
      await act(admin, tAdmin, { op: 'invite', email: 'aud@x.com', roleKey: 'viewer' })
      const [row] = await q<{ actor_email: string; action: string; target_id: string }>(`select * from admin_audit_log where action='staff.invite'`)
      expect(row).toMatchObject({ actor_email: 'admin@x.com', target_id: 'aud@x.com' })
    })
  })
})
