import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { OWNER_EMAIL } from '@/lib/admin/permissions'
import { closePools, pgEnabled } from './harness/pgSupabase'
import { failNextSends, sentCodes } from './harness/mocks'
import { STAFF_PASSWORD, call, codeFor, makeStaff, makeUser, q, resetRateLimits, resetWorld, unlock } from './harness/world'
import { ADMIN_COOKIE } from '../session'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', async () => (await import('./harness/mocks')).serviceMock())
vi.mock('@/lib/supabase/resolveRouteUser', async () => (await import('./harness/mocks')).routeUserMock())
vi.mock('@/lib/auth/resolveDeviceId', async () => (await import('./harness/mocks')).deviceMock())
vi.mock('@supabase/supabase-js', async () => (await import('./harness/mocks')).supabaseJsMock())

import { GET as status } from '@/app/api/admin/auth/status/route'
import { POST as setup } from '@/app/api/admin/auth/setup/route'
import { POST as confirm } from '@/app/api/admin/auth/setup/confirm/route'
import { POST as sendCode } from '@/app/api/admin/auth/code/route'
import { POST as sso } from '@/app/api/admin/auth/sso/route'
import { POST as login } from '@/app/api/admin/auth/login/route'
import { POST as logout } from '@/app/api/admin/auth/logout/route'
import { POST as biometric } from '@/app/api/admin/auth/biometric/route'
import { DELETE as delDevice, POST as addDevice } from '@/app/api/admin/auth/biometric/device/route'
import { POST as changePassword } from '@/app/api/admin/auth/password/route'
import { DELETE as delSession, GET as sessions } from '@/app/api/admin/auth/sessions/route'
import { GET as overview } from '@/app/api/admin/overview/route'
import { POST as staffPost } from '@/app/api/admin/staff/route'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const PW = 'Aa1-long-enough-pw'

describe.skipIf(!pgEnabled)('admin auth (real Postgres)', () => {
  beforeAll(async () => {
    process.env.ADMIN_AUTH_SECRET = 'qa-secret'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'qa-publishable'
  })
  afterAll(closePools)
  beforeEach(async () => { await resetWorld(); await resetRateLimits() })

  describe('status', () => {
    it('answers isStaff:false to nobody and to non-staff, leaking nothing else', async () => {
      expect((await call(status)).body).toEqual({ isStaff: false, signedIn: false })
      const u = await makeUser('plain@example.com')
      expect((await call(status, { as: u })).body).toEqual({ isStaff: false, signedIn: true })
    })

    it('provisions the owner on first visit, only for the confirmed owner email', async () => {
      const owner = await makeUser(OWNER_EMAIL)
      const r = await call(status, { as: owner })
      expect(r.body).toMatchObject({ isStaff: true, staff: { role: 'owner' }, permissions: ['*'], setup: 'needed' })
      await resetWorld()
      const unconfirmed = await makeUser(OWNER_EMAIL, { confirmed: false })
      expect((await call(status, { as: unconfirmed })).body.isStaff).toBe(false)
    })

    it('claims an invitation by exact email and never by wildcard match', async () => {
      await q(`insert into admin_staff (email, role_key) values ('a_b@x.com','viewer')`)
      const impostor = await makeUser('axb@x.com')
      expect((await call(status, { as: impostor })).body.isStaff).toBe(false)
      expect((await q(`select user_id from admin_staff where email='a_b@x.com'`))[0]!.user_id).toBeNull()
      const real = await makeUser('a_b@x.com')
      expect((await call(status, { as: real })).body.isStaff).toBe(true)
      expect((await q(`select user_id from admin_staff where email='a_b@x.com'`))[0]!.user_id).toBe(real.id)
    })

    it('does not let an unverified email claim an invitation', async () => {
      await q(`insert into admin_staff (email, role_key) values ('new@x.com','viewer')`)
      const u = await makeUser('new@x.com', { confirmed: false })
      expect((await call(status, { as: u })).body.isStaff).toBe(false)
    })

    it('hides suspended staff', async () => {
      const s = await makeStaff('sus@x.com', 'viewer')
      await q(`update admin_staff set status='suspended' where id=$1`, [s.staffId])
      expect((await call(status, { as: s })).body.isStaff).toBe(false)
    })

    it('reports the setup / session / biometric state', async () => {
      const s = await makeStaff('st@x.com', 'viewer')
      expect((await call(status, { as: s })).body).toMatchObject({ setup: 'complete', session: null, biometricEnrolled: false, ssoEnabled: false })
      const token = await unlock(login, s)
      const r = await call(status, { as: s, token })
      expect(r.body.session).toMatchObject({ method: 'password_email' })
      expect(r.body.permissions).toEqual(expect.arrayContaining(['overview.view']))
    })
  })

  describe('first-time setup', () => {
    const invitee = async () => {
      const u = await makeUser('inv@x.com')
      await q(`insert into admin_staff (email, user_id, role_key) values ('inv@x.com',$1,'viewer')`, [u.id])
      return u
    }

    it('rejects non-staff, a missing CSRF header and weak passwords, and never asks for the Buddget password', async () => {
      const plain = await makeUser('plain@x.com')
      expect((await call(setup, { method: 'POST', as: plain, body: { password: PW } })).body.code).toBe('not_staff')
      const s = await invitee()
      expect((await call(setup, { method: 'POST', as: s, csrf: false, body: { password: PW } })).body.code).toBe('csrf')
      expect((await call(setup, { method: 'POST', as: s, body: { password: 'short' } })).status).toBe(400)
      expect(await q(`select 1 from admin_credentials`)).toHaveLength(0)
      expect(sentCodes()).toHaveLength(0)
    })

    it('works the same for OAuth-only and invited accounts: no account-password or recent-sign-in check', async () => {
      const g = await makeUser('goog@x.com', { provider: 'google' })
      await q(`insert into admin_staff (email, user_id, role_key) values ('goog@x.com',$1,'viewer')`, [g.id])
      await q(`update auth.users set last_sign_in_at = now() - interval '2 days' where id=$1`, [g.id])
      expect((await call(setup, { method: 'POST', as: g, body: { password: PW } })).status).toBe(200)
    })

    it('runs end to end: password + emailed code, wrong code refused, session opened, SSO on by default', async () => {
      const u = await invitee()
      const start = await call(setup, { method: 'POST', as: u, body: { password: PW } })
      expect(start.status).toBe(200)
      expect(sentCodes()).toEqual(['inv@x.com'])
      const [row] = await q<{ setup_completed_at: string | null; password_hash: string; sso_enabled: boolean }>(`select * from admin_credentials`)
      expect(row!.setup_completed_at).toBeNull()
      expect(row!.password_hash.startsWith('scrypt$')).toBe(true)
      expect(row!.sso_enabled).toBe(true)
      expect((await call(status, { as: u })).body.setup).toBe('confirm_email')

      // unusable until the mailbox is proven
      expect((await call(login, { method: 'POST', as: u, body: { password: PW, code: codeFor(u) } })).body.code).toBe('setup_required')
      expect((await call(status, { as: u })).body.session).toBeNull()

      expect((await call(confirm, { method: 'POST', as: u, body: { code: '000000' } })).status).toBe(401)
      const done = await call(confirm, { method: 'POST', as: u, body: { code: codeFor(u) } })
      expect(done.status).toBe(200)
      expect(done.headers.get('set-cookie')).toContain(`${ADMIN_COOKIE}=`)
      expect(done.headers.get('set-cookie')).toMatch(/HttpOnly.*SameSite=Strict/)
      expect((await q<{ setup_completed_at: string }>(`select setup_completed_at from admin_credentials`))[0]!.setup_completed_at).toBeTruthy()
      expect((await call(overview, { as: u, token: done.body.token })).status).toBe(200)

      // setup is one-shot
      expect((await call(setup, { method: 'POST', as: u, body: { password: PW } })).status).toBe(409)
      expect((await call(confirm, { method: 'POST', as: u, body: { code: codeFor(u) } })).status).toBe(409)
    })

    it('lets the password be changed while setup is unfinished', async () => {
      const u = await invitee()
      await call(setup, { method: 'POST', as: u, body: { password: PW } })
      await call(setup, { method: 'POST', as: u, body: { password: 'Zz9-another-long-pw' } })
      expect((await call(confirm, { method: 'POST', as: u, body: { code: codeFor(u) } })).status).toBe(200)
      await q(`update admin_credentials set sso_enabled = false`)
      expect((await call(login, { method: 'POST', as: u, body: { password: 'Zz9-another-long-pw', code: codeFor(u) } })).status).toBe(200)
    })

    it('another account’s code cannot finish setup', async () => {
      const u = await invitee()
      const other = await makeUser('other@x.com')
      await call(setup, { method: 'POST', as: u, body: { password: PW } })
      expect((await call(confirm, { method: 'POST', as: u, body: { code: codeFor(other) } })).status).toBe(401)
    })

    it('counts wrong codes towards the lockout', async () => {
      const u = await invitee()
      await call(setup, { method: 'POST', as: u, body: { password: PW } })
      for (let i = 0; i < 5; i++) await call(confirm, { method: 'POST', as: u, body: { code: '000000' } })
      expect((await call(confirm, { method: 'POST', as: u, body: { code: codeFor(u) } })).status).toBe(429)
    })

    it('throttles repeated setup attempts and surfaces a mail failure', async () => {
      const u = await invitee()
      let last = 0
      for (let i = 0; i < 12; i++) last = (await call(setup, { method: 'POST', as: u, body: { password: 'x' } })).status
      expect(last).toBe(429)
      await resetRateLimits()
      failNextSends(429)
      expect((await call(setup, { method: 'POST', as: u, body: { password: PW } })).status).toBe(429)
      failNextSends(500)
      expect((await call(setup, { method: 'POST', as: u, body: { password: PW } })).status).toBe(502)
    })
  })

  describe('emailed codes', () => {
    it('are sent only to the caller’s own address, and only after setup has begun', async () => {
      const u = await makeUser('inv@x.com')
      await q(`insert into admin_staff (email, user_id, role_key) values ('inv@x.com',$1,'viewer')`, [u.id])
      expect((await call(sendCode, { method: 'POST', as: u })).body.code).toBe('setup_required')
      const s = await makeStaff('a@x.com', 'viewer')
      expect((await call(sendCode, { method: 'POST', as: s })).status).toBe(200)
      expect(sentCodes()).toEqual(['a@x.com'])
      expect((await call(sendCode, { method: 'POST', as: s, csrf: false })).body.code).toBe('csrf')
    })

    it('are rate limited per account', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      const seen: number[] = []
      for (let i = 0; i < 10; i++) seen.push((await call(sendCode, { method: 'POST', as: s })).status)
      expect(seen.slice(0, 8).every((c) => c === 200)).toBe(true)
      expect(seen.slice(8)).toEqual([429, 429])
    })

    it('report a mail provider cool-down as 429', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      failNextSends(429)
      expect((await call(sendCode, { method: 'POST', as: s })).status).toBe(429)
    })
  })

  describe('login', () => {
    it('unlocks with password + emailed code, stores only a hash of the session token', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      const r = await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code: codeFor(s) } })
      expect(r.status).toBe(200)
      const token = r.body.token as string
      expect(token.length).toBeGreaterThanOrEqual(40)
      const rows = await q<{ token_hash: string; method: string }>(`select token_hash, method from admin_sessions`)
      expect(rows).toHaveLength(1)
      expect(rows[0]!.token_hash).toBe(sha(token))
      expect(rows[0]!.method).toBe('password_email')
      expect((await call(overview, { as: s, token })).status).toBe(200)
    })

    it('gives wrong password and wrong code the same answer, and counts both', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      const badPw = await call(login, { method: 'POST', as: s, body: { password: 'wrong-Passw0rd', code: codeFor(s) } })
      const badCode = await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code: '000000' } })
      expect(badPw.status).toBe(401)
      expect(badCode.status).toBe(401)
      expect(badPw.body.error).toBe(badCode.body.error)
      expect((await q<{ failed_attempts: number }>(`select failed_attempts from admin_credentials`))[0]!.failed_attempts).toBe(2)
    })

    it('locks after 5 failures — even the correct credentials are refused — and recovers after the lock lapses', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      for (let i = 0; i < 5; i++) await call(login, { method: 'POST', as: s, body: { password: 'bad-Passw0rd', code: '123456' } })
      const locked = await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code: codeFor(s) } })
      expect(locked.status).toBe(429)
      await q(`update admin_credentials set locked_until = now() - interval '1 minute'`)
      await resetRateLimits()
      expect((await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code: codeFor(s) } })).status).toBe(200)
      expect((await q<{ failed_attempts: number }>(`select failed_attempts from admin_credentials`))[0]!.failed_attempts).toBe(0)
    })

    it('refuses a replayed code', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      const code = codeFor(s)
      expect((await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code } })).status).toBe(200)
      expect((await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code } })).status).toBe(401)
    })

    it('does not accept another staff member’s code', async () => {
      const a = await makeStaff('a@x.com', 'viewer')
      const b = await makeStaff('b@x.com', 'viewer')
      expect((await call(login, { method: 'POST', as: a, body: { password: STAFF_PASSWORD, code: codeFor(b) } })).status).toBe(401)
    })

    it('accepts a code typed with a space', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      const code = codeFor(s)
      expect((await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code: `${code.slice(0, 3)} ${code.slice(3)}` } })).status).toBe(200)
    })

    it('throttles per account', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      const seen: number[] = []
      for (let i = 0; i < 14; i++) {
        await q(`update admin_credentials set failed_attempts = 0, locked_until = null`)
        seen.push((await call(login, { method: 'POST', as: s, body: { password: 'bad-Passw0rd', code: '123456' } })).status)
      }
      expect(seen.slice(0, 12).every((c) => c === 401)).toBe(true)
      expect(seen.slice(12)).toEqual([429, 429])
    })

    it('blocks suspended staff and users without credentials', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      await q(`update admin_staff set status='suspended'`)
      expect((await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code: codeFor(s) } })).status).toBe(403)
      await resetWorld()
      const u = await makeUser('b@x.com')
      await q(`insert into admin_staff (email, user_id, role_key) values ('b@x.com',$1,'viewer')`, [u.id])
      expect((await call(login, { method: 'POST', as: u, body: { password: STAFF_PASSWORD, code: '123456' } })).body.code).toBe('setup_required')
    })

    it('needs the CSRF header and valid input', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      expect((await call(login, { method: 'POST', as: s, csrf: false, body: { password: STAFF_PASSWORD, code: codeFor(s) } })).status).toBe(403)
      expect((await call(login, { method: 'POST', as: s, body: { password: 1, code: 2 } })).status).toBe(400)
      expect((await call(login, { method: 'POST', as: s })).status).toBe(400)
    })
  })

  describe('SSO with the app session', () => {
    it('is on by default for staff and opens the portal with no admin token', async () => {
      const s = await makeStaff('a@x.com', 'admin', { sso: true })
      const st = await call(status, { as: s })
      expect(st.body).toMatchObject({ setup: 'complete', ssoEnabled: true, session: { method: 'sso' } })
      expect((await call(overview, { as: s })).status).toBe(200)
      expect(await q(`select 1 from admin_sessions`)).toHaveLength(0)
    })

    it('does not apply when the switch is off, when setup is unfinished, or without an app sign-in', async () => {
      const s = await makeStaff('a@x.com', 'admin', { sso: false })
      expect((await call(overview, { as: s })).body.code).toBe('locked')
      await q(`update admin_credentials set sso_enabled = true, setup_completed_at = null`)
      expect((await call(overview, { as: s })).body.code).toBe('locked')
      await q(`update admin_credentials set setup_completed_at = now()`)
      expect((await call(overview, { as: null })).status).toBe(401)
      expect((await call(overview, { as: s })).status).toBe(200)
    })

    it('follows role changes and suspension on the very next request', async () => {
      const s = await makeStaff('a@x.com', 'admin', { sso: true })
      expect((await call(overview, { as: s })).status).toBe(200)
      await q(`update admin_staff set role_key='viewer'`)
      expect((await call(staffPost, { method: 'POST', as: s, body: { op: 'invite', email: 'n@x.com', roleKey: 'viewer' } })).body.code).toBe('forbidden')
      await q(`update admin_staff set status='suspended'`)
      expect((await call(overview, { as: s })).status).toBe(403)
    })

    it('keeps CSRF, permissions and the audit trail', async () => {
      const s = await makeStaff('a@x.com', 'support_agent', { sso: true })
      expect((await call(addDevice, { method: 'POST', as: s, csrf: false, body: {} })).body.code).toBe('csrf')
      expect((await call(staffPost, { method: 'POST', as: s, body: { op: 'invite', email: 'n@x.com', roleKey: 'viewer' } })).body.code).toBe('forbidden')
      await call(status, { as: s })
      expect((await q<{ metadata: { via: string } }>(`select metadata from admin_audit_log where action='auth.login'`)).map((r) => r.metadata.via)).toContain('sso')
    })

    it('logout from an SSO session is a harmless no-op, and it is listed as the current session', async () => {
      const s = await makeStaff('a@x.com', 'admin', { sso: true })
      expect((await call(logout, { method: 'POST', as: s })).status).toBe(200)
      expect((await call(overview, { as: s })).status).toBe(200)
      const list = await call(sessions, { as: s })
      expect(list.body.sessions).toEqual([expect.objectContaining({ method: 'sso', current: true })])
      expect(list.body.ssoEnabled).toBe(true)
      expect((await call(delSession, { method: 'DELETE', as: s, body: { all: true } })).status).toBe(200)
    })

    it('turning it off is immediate and needs no proof; the next request is locked', async () => {
      const s = await makeStaff('a@x.com', 'admin', { sso: true })
      expect((await call(sso, { method: 'POST', as: s, body: { enabled: 'no' } })).status).toBe(400)
      expect((await call(sso, { method: 'POST', as: s, body: { enabled: false } })).status).toBe(200)
      expect((await call(overview, { as: s })).body.code).toBe('locked')
      expect((await call(status, { as: s })).body).toMatchObject({ ssoEnabled: false, session: null })
      expect(await q(`select 1 from admin_audit_log where action='auth.sso_changed'`)).toHaveLength(1)
    })

    it('turning it on needs a fresh emailed code or the admin password', async () => {
      const s = await makeStaff('a@x.com', 'admin')
      const t = await unlock(login, s)
      expect((await call(sso, { method: 'POST', as: s, token: t, body: { enabled: true } })).status).toBe(401)
      expect((await call(sso, { method: 'POST', as: s, token: t, body: { enabled: true, code: '000000' } })).status).toBe(401)
      expect((await call(sso, { method: 'POST', as: s, token: t, body: { enabled: true, stepUpPassword: 'wrong' } })).status).toBe(401)
      expect((await call(overview, { as: s })).body.code).toBe('locked')
      expect((await call(sso, { method: 'POST', as: s, token: t, body: { enabled: true, code: codeFor(s) } })).status).toBe(200)
      expect((await call(overview, { as: s })).status).toBe(200)
      await call(sso, { method: 'POST', as: s, body: { enabled: false } })
      const t2 = await unlock(login, s)
      expect((await call(sso, { method: 'POST', as: s, token: t2, body: { enabled: true, stepUpPassword: STAFF_PASSWORD } })).status).toBe(200)
    })

    it('failed proofs for the switch count towards the lockout', async () => {
      const s = await makeStaff('a@x.com', 'admin')
      const t = await unlock(login, s)
      for (let i = 0; i < 5; i++) await call(sso, { method: 'POST', as: s, token: t, body: { enabled: true, code: '000000' } })
      expect((await call(sso, { method: 'POST', as: s, token: t, body: { enabled: true, stepUpPassword: STAFF_PASSWORD } })).status).toBe(401)
      expect((await q<{ locked_until: string | null }>(`select locked_until from admin_credentials`))[0]!.locked_until).toBeTruthy()
    })
  })

  describe('step-up for dangerous actions', () => {
    it('is satisfied by an emailed code or the admin password, also in SSO mode, and never by nothing', async () => {
      const owner = await makeStaff(OWNER_EMAIL, 'owner', { sso: true })
      const victim = await makeStaff('v@x.com', 'viewer')
      const reset = (proof: Record<string, unknown>) => call(staffPost, { method: 'POST', as: owner, body: { op: 'reset_credentials', id: victim.staffId, ...proof } })
      expect((await reset({})).status).toBe(401)
      expect((await reset({ code: '000000' })).status).toBe(401)
      expect((await reset({ stepUpPassword: 'wrong' })).status).toBe(401)
      await q(`update admin_credentials set failed_attempts = 0, locked_until = null`)
      expect((await reset({ code: codeFor(owner) })).status).toBe(200)
      expect(await q(`select 1 from admin_credentials where user_id=$1`, [victim.id])).toHaveLength(0)
      await q(`insert into admin_credentials (user_id, password_hash, setup_completed_at) select $1, password_hash, now() from admin_credentials where user_id=$2`, [victim.id, owner.id])
      expect((await reset({ stepUpPassword: STAFF_PASSWORD })).status).toBe(200)
    })

    it('does not accept a code that was meant for someone else, or the same code twice', async () => {
      const owner = await makeStaff(OWNER_EMAIL, 'owner', { sso: true })
      const victim = await makeStaff('v@x.com', 'viewer')
      const reset = (code: string) => call(staffPost, { method: 'POST', as: owner, body: { op: 'reset_credentials', id: victim.staffId, code } })
      expect((await reset(codeFor(victim))).status).toBe(401)
      const code = codeFor(owner)
      expect((await reset(code)).status).toBe(200)
      expect((await reset(code)).status).toBe(401)
    })
  })

  describe('session lifecycle', () => {
    it('refuses requests without, with a foreign, a revoked, an expired or an idle session', async () => {
      const a = await makeStaff('a@x.com', 'admin')
      const b = await makeStaff('b@x.com', 'admin')
      const ta = await unlock(login, a)
      const tb = await unlock(login, b)
      expect((await call(overview, { as: a })).body.code).toBe('locked')
      expect((await call(overview, { as: a, token: tb })).body.code).toBe('locked')
      expect((await call(overview, { as: a, token: 'garbage' })).status).toBe(401)
      expect((await call(overview, { as: a, token: ta })).status).toBe(200)

      await q(`update admin_sessions set last_seen_at = now() - interval '61 minutes' where token_hash = $1`, [sha(ta)])
      expect((await call(overview, { as: a, token: ta })).status).toBe(401)
      const t2 = await unlock(login, a)
      await q(`update admin_sessions set expires_at = now() - interval '1 second' where token_hash = $1`, [sha(t2)])
      expect((await call(overview, { as: a, token: t2 })).status).toBe(401)
      const t3 = await unlock(login, a)
      await q(`update admin_sessions set revoked_at = now() where token_hash = $1`, [sha(t3)])
      expect((await call(overview, { as: a, token: t3 })).status).toBe(401)
    })

    it('accepts the token from the HttpOnly cookie and slides the idle clock', async () => {
      const a = await makeStaff('a@x.com', 'admin')
      const token = await unlock(login, a)
      await q(`update admin_sessions set last_seen_at = now() - interval '30 minutes'`)
      expect((await call(overview, { as: a, headers: { cookie: `${ADMIN_COOKIE}=${token}` } })).status).toBe(200)
      const [row] = await q<{ age: number }>(`select extract(epoch from now() - last_seen_at) age from admin_sessions`)
      expect(row!.age).toBeLessThan(60)
    })

    it('logout revokes the session and clears the cookie', async () => {
      const a = await makeStaff('a@x.com', 'admin')
      const token = await unlock(login, a)
      const out = await call(logout, { method: 'POST', as: a, token })
      expect(out.headers.get('set-cookie')).toContain('Max-Age=0')
      expect((await call(overview, { as: a, token })).status).toBe(401)
    })

    it('a suspended or role-less account loses a live session immediately', async () => {
      const a = await makeStaff('a@x.com', 'admin')
      const token = await unlock(login, a)
      await q(`update admin_staff set status='suspended'`)
      expect((await call(overview, { as: a, token })).status).toBe(403)
    })

    it('lists and revokes only the caller’s own sessions', async () => {
      const a = await makeStaff('a@x.com', 'admin')
      const b = await makeStaff('b@x.com', 'admin')
      const ta = await unlock(login, a)
      const tb = await unlock(login, b)
      const ta2 = await unlock(login, a)
      const list = await call(sessions, { as: a, token: ta })
      expect(list.body.sessions).toHaveLength(2)
      expect(list.body.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1)
      const [bSession] = await q<{ id: string }>(`select id from admin_sessions where token_hash=$1`, [sha(tb)])
      expect((await call(delSession, { method: 'DELETE', as: a, token: ta, body: { id: bSession!.id } })).status).toBe(404)
      expect((await call(overview, { as: b, token: tb })).status).toBe(200)
      expect((await call(delSession, { method: 'DELETE', as: a, token: ta, body: { all: true } })).status).toBe(200)
      expect((await call(overview, { as: a, token: ta })).status).toBe(200)
      expect((await call(overview, { as: a, token: ta2 })).status).toBe(401)
    })
  })

  describe('changing the password', () => {
    it('needs the current password and an emailed code, signing other sessions out', async () => {
      const a = await makeStaff('a@x.com', 'admin')
      const t1 = await unlock(login, a)
      const t2 = await unlock(login, a)
      expect((await call(changePassword, { method: 'POST', as: a, token: t1, body: { current: 'wrong', next: 'New-Passw0rd-456', code: codeFor(a) } })).status).toBe(401)
      expect((await call(changePassword, { method: 'POST', as: a, token: t1, body: { current: STAFF_PASSWORD, next: 'weak', code: codeFor(a) } })).status).toBe(400)
      expect((await call(changePassword, { method: 'POST', as: a, token: t1, body: { current: STAFF_PASSWORD, next: 'New-Passw0rd-456', code: codeFor(a) } })).status).toBe(200)
      expect((await call(overview, { as: a, token: t1 })).status).toBe(200)
      expect((await call(overview, { as: a, token: t2 })).status).toBe(401)
      expect((await call(login, { method: 'POST', as: a, body: { password: STAFF_PASSWORD, code: codeFor(a) } })).status).toBe(401)
      await q(`update admin_credentials set failed_attempts=0, locked_until=null`)
      expect((await call(login, { method: 'POST', as: a, body: { password: 'New-Passw0rd-456', code: codeFor(a) } })).status).toBe(200)
    })

    it('works from an SSO session without disturbing it', async () => {
      const a = await makeStaff('a@x.com', 'admin', { sso: true })
      expect((await call(changePassword, { method: 'POST', as: a, body: { current: STAFF_PASSWORD, next: 'New-Passw0rd-456', code: codeFor(a) } })).status).toBe(200)
      expect((await call(overview, { as: a })).status).toBe(200)
    })
  })

  describe('biometric unlock', () => {
    const SECRET = 'a'.repeat(64)
    const hash = sha(SECRET)

    it('cannot be enrolled without an unlocked session, but can be from an SSO session', async () => {
      const a = await makeStaff('a@x.com', 'viewer')
      expect((await call(addDevice, { method: 'POST', as: a, body: { secretHash: hash } })).status).toBe(401)
      await q(`update admin_credentials set sso_enabled = true`)
      expect((await call(addDevice, { method: 'POST', as: a, body: { secretHash: hash, platform: 'android' } })).status).toBe(200)
    })

    it('unlocks the portal when SSO is off, from a fresh app session (native unlock screen path)', async () => {
      const a = await makeStaff('a@x.com', 'viewer', { sso: true })
      const headers = { 'x-buddget-device-id': 'pixel-1' }
      await call(addDevice, { method: 'POST', as: a, headers, body: { secretHash: hash } })
      await call(sso, { method: 'POST', as: a, body: { enabled: false } })
      expect((await call(overview, { as: a })).body.code).toBe('locked')
      expect((await call(status, { as: a, headers })).body).toMatchObject({ biometricEnrolled: true, session: null })
      const ok = await call(biometric, { method: 'POST', as: a, headers, body: { secret: SECRET } })
      expect(ok.status).toBe(200)
      expect((await call(overview, { as: a, token: ok.body.token })).status).toBe(200)
    })

    it('unlocks with the enrolled device secret, and only for that account and device', async () => {
      const a = await makeStaff('a@x.com', 'viewer')
      const b = await makeStaff('b@x.com', 'viewer')
      const t = await unlock(login, a)
      const headers = { 'x-buddget-device-id': 'iphone-1' }
      expect((await call(addDevice, { method: 'POST', as: a, token: t, headers, body: { secretHash: 'short' } })).status).toBe(400)
      expect((await call(addDevice, { method: 'POST', as: a, token: t, headers, body: { secretHash: hash, platform: 'ios' } })).status).toBe(200)
      expect((await call(status, { as: a, headers })).body.biometricEnrolled).toBe(true)

      const ok = await call(biometric, { method: 'POST', as: a, headers, body: { secret: SECRET } })
      expect(ok.status).toBe(200)
      expect((await q<{ method: string }>(`select method from admin_sessions order by created_at desc limit 1`))[0]!.method).toBe('biometric')
      expect((await call(overview, { as: a, token: ok.body.token })).status).toBe(200)
      // a biometric unlock is held to a shorter session than password + code
      const [life] = await q<{ hours: number; method: string }>(`select method, round(extract(epoch from expires_at - created_at)/3600)::int hours from admin_sessions order by created_at`)
      expect(life!.hours).toBe(12)
      expect((await q<{ hours: number }>(`select round(extract(epoch from expires_at - created_at)/3600)::int hours from admin_sessions where method='biometric'`))[0]!.hours).toBe(4)

      expect((await call(biometric, { method: 'POST', as: a, headers, body: { secret: 'b'.repeat(64) } })).status).toBe(401)
      expect((await call(biometric, { method: 'POST', as: b, headers, body: { secret: SECRET } })).status).toBe(401)
      expect((await call(biometric, { method: 'POST', as: a, headers: { 'x-buddget-device-id': 'other' }, body: { secret: SECRET } })).status).toBe(401)
      expect((await call(biometric, { method: 'POST', as: a, headers })).status).toBe(400)
    })

    it('is refused while the account is locked out, and after the device is removed', async () => {
      const a = await makeStaff('a@x.com', 'viewer')
      const t = await unlock(login, a)
      const headers = { 'x-buddget-device-id': 'iphone-1' }
      await call(addDevice, { method: 'POST', as: a, token: t, headers, body: { secretHash: hash } })
      await q(`update admin_credentials set locked_until = now() + interval '10 minutes'`)
      expect((await call(biometric, { method: 'POST', as: a, headers, body: { secret: SECRET } })).status).toBe(429)
      await q(`update admin_credentials set locked_until = null`)
      expect((await call(delDevice, { method: 'DELETE', as: a, token: t, headers })).status).toBe(200)
      expect((await call(biometric, { method: 'POST', as: a, headers, body: { secret: SECRET } })).status).toBe(401)
    })

    it('cannot remove another account’s device', async () => {
      const a = await makeStaff('a@x.com', 'viewer')
      const b = await makeStaff('b@x.com', 'viewer')
      const ta = await unlock(login, a)
      const tb = await unlock(login, b)
      await call(addDevice, { method: 'POST', as: a, token: ta, headers: { 'x-buddget-device-id': 'dev-a' }, body: { secretHash: hash } })
      await call(delDevice, { method: 'DELETE', as: b, token: tb, query: { deviceId: 'dev-a' } })
      expect(await q(`select 1 from admin_biometric_devices where device_id='dev-a'`)).toHaveLength(1)
    })
  })

  describe('audit trail', () => {
    it('records logins, failures and setup — and never a secret', async () => {
      const a = await makeStaff('a@x.com', 'viewer')
      await call(login, { method: 'POST', as: a, body: { password: 'bad-Passw0rd', code: '000000' } })
      await call(login, { method: 'POST', as: a, body: { password: STAFF_PASSWORD, code: codeFor(a) } })
      const rows = await q<{ action: string }>(`select action from admin_audit_log order by id`)
      expect(rows.map((r) => r.action)).toEqual(['auth.login_failed', 'auth.login'])
      const dump = JSON.stringify(await q(`select * from admin_audit_log`))
      expect(dump).not.toContain(STAFF_PASSWORD)
    })
  })
})
