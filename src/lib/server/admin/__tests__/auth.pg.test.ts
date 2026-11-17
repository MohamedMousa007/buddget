import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { OWNER_EMAIL } from '@/lib/admin/permissions'
import { closePools, pgEnabled } from './harness/pgSupabase'
import { sentCodes } from './harness/mocks'
import { STAFF_PASSWORD, call, codeFor, makeStaff, makeUser, q, resetRateLimits, resetWorld, unlock, type Staff, type TestUser } from './harness/world'
import { ADMIN_COOKIE } from '../session'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', async () => (await import('./harness/mocks')).serviceMock())
vi.mock('@/lib/auth/resolveDeviceId', async () => (await import('./harness/mocks')).deviceMock())
vi.mock('@supabase/supabase-js', async () => (await import('./harness/mocks')).supabaseJsMock())

import { GET as status } from '@/app/api/admin/auth/status/route'
import { POST as setup } from '@/app/api/admin/auth/setup/route'
import { POST as confirm } from '@/app/api/admin/auth/setup/confirm/route'
import { POST as sendCode } from '@/app/api/admin/auth/code/route'
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
const post = (handler: Parameters<typeof call>[0], body: unknown, extra: Parameters<typeof call>[1] = {}) => call(handler, { method: 'POST', body, ...extra })
const signIn = (who: TestUser, password: string, code: string) => post(login, { email: who.email, password, code })

describe.skipIf(!pgEnabled)('admin auth (real Postgres)', () => {
  beforeAll(async () => {
    process.env.ADMIN_AUTH_SECRET = 'qa-secret'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'qa-publishable'
  })
  afterAll(closePools)
  beforeEach(async () => { await resetWorld(); await resetRateLimits() })

  describe('the portal is separate from the app', () => {
    it('a buddget app sign-in opens nothing, even for the owner', async () => {
      const owner = await makeStaff(OWNER_EMAIL, 'owner')
      // The app's own credentials (cookie or Bearer) are simply not read.
      const appSession = { headers: { authorization: 'Bearer app-jwt', cookie: 'sb-x-auth-token=app-session' } }
      expect((await call(status, appSession)).body).toEqual({ isStaff: false, session: null, biometricEnrolled: false })
      expect((await call(overview, appSession)).body.code).toBe('locked')
      expect((await call(overview, { ...appSession, token: await unlock(login, owner) })).status).toBe(200)
    })

    it('status says who is signed in to the portal, and nothing about anyone else', async () => {
      const s = await makeStaff('st@x.com', 'viewer')
      expect((await call(status)).body).toEqual({ isStaff: false, session: null, biometricEnrolled: false })
      const r = await call(status, { token: await unlock(login, s) })
      expect(r.body).toMatchObject({ isStaff: true, staff: { email: 'st@x.com', role: 'viewer' }, session: { method: 'password_email' }, biometricEnrolled: false })
      expect(r.body.permissions).toEqual(expect.arrayContaining(['overview.view']))
    })
  })

  describe('sign-in, step 1: email and admin password', () => {
    it('emails the code only when the password is right, to the staff member’s own address', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      expect((await post(sendCode, { email: 'a@x.com', password: STAFF_PASSWORD })).status).toBe(200)
      expect((await post(sendCode, { email: ' A@X.com ', password: STAFF_PASSWORD })).status).toBe(200)
      expect(sentCodes()).toEqual([s.email, s.email])
    })

    it('answers a wrong password, an unknown address, a non-staff account and unfinished setup identically, mailing nobody', async () => {
      await makeStaff('a@x.com', 'viewer')
      await makeUser('plain@x.com')
      const pending = await makeUser('new@x.com')
      await q(`insert into admin_staff (email, user_id, role_key) values ('new@x.com',$1,'viewer')`, [pending.id])
      const answers = await Promise.all([
        post(sendCode, { email: 'a@x.com', password: 'Wrong-Passw0rd-1' }),
        post(sendCode, { email: 'nobody@x.com', password: STAFF_PASSWORD }),
        post(sendCode, { email: 'plain@x.com', password: STAFF_PASSWORD }),
        post(sendCode, { email: 'new@x.com', password: STAFF_PASSWORD }),
      ])
      for (const r of answers) expect({ status: r.status, body: r.body }).toEqual({ status: answers[0]!.status, body: answers[0]!.body })
      expect(answers[0]!.status).toBe(401)
      expect(sentCodes()).toHaveLength(0)
    })

    it('needs the CSRF header and both fields, and counts wrong passwords towards the lockout', async () => {
      await makeStaff('a@x.com', 'viewer')
      expect((await post(sendCode, { email: 'a@x.com', password: STAFF_PASSWORD }, { csrf: false })).body.code).toBe('csrf')
      expect((await post(sendCode, { email: 'a@x.com' })).status).toBe(400)
      for (let i = 0; i < 5; i++) await post(sendCode, { email: 'a@x.com', password: 'Wrong-Passw0rd-1' })
      expect((await post(sendCode, { email: 'a@x.com', password: STAFF_PASSWORD })).status).toBe(429)
      expect(sentCodes()).toHaveLength(0)
    })

    it('without an email it is the signed-in "send me a code", which needs a portal session', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      expect((await post(sendCode, {})).body.code).toBe('locked')
      expect((await post(sendCode, {}, { token: await unlock(login, s) })).status).toBe(200)
      expect(sentCodes()).toEqual([s.email])
    })
  })

  describe('sign-in, step 2: the emailed code', () => {
    it('opens a session, stores only a hash of its token and sets a host-only HttpOnly cookie', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      const r = await signIn(s, STAFF_PASSWORD, codeFor(s))
      expect(r.status).toBe(200)
      expect(r.headers.get('set-cookie')).toContain(`${ADMIN_COOKIE}=`)
      expect(r.headers.get('set-cookie')).toMatch(/HttpOnly.*SameSite=Strict/)
      const [row] = await q<{ token_hash: string; method: string }>(`select token_hash, method from admin_sessions`)
      expect(row).toEqual({ token_hash: sha(r.body.token), method: 'password_email' })
      expect((await call(overview, { token: r.body.token })).status).toBe(200)
    })

    it('gives a wrong password, a wrong code and an unknown address the same answer', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      const a = await signIn(s, 'Wrong-Passw0rd-1', codeFor(s))
      const b = await signIn(s, STAFF_PASSWORD, '000000')
      const c = await signIn({ id: '', email: 'nobody@x.com' }, STAFF_PASSWORD, '000000')
      expect(a.status).toBe(401)
      expect([b.status, b.body, c.status, c.body]).toEqual([a.status, a.body, a.status, a.body])
      expect(await q(`select 1 from admin_sessions`)).toHaveLength(0)
    })

    it('locks after 5 failures, refusing even the right details, and recovers when the lock lapses', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      for (let i = 0; i < 5; i++) await signIn(s, 'Wrong-Passw0rd-1', '000000')
      expect((await signIn(s, STAFF_PASSWORD, codeFor(s))).status).toBe(429)
      await q(`update admin_credentials set locked_until = now() - interval '1 second'`)
      expect((await signIn(s, STAFF_PASSWORD, codeFor(s))).status).toBe(200)
    })

    it('refuses a replayed code, another member’s code, suspended staff and a missing CSRF header', async () => {
      const a = await makeStaff('a@x.com', 'viewer')
      const b = await makeStaff('b@x.com', 'viewer')
      const code = codeFor(a)
      expect((await signIn(a, STAFF_PASSWORD, code)).status).toBe(200)
      expect((await signIn(a, STAFF_PASSWORD, code)).status).toBe(401)
      expect((await signIn(a, STAFF_PASSWORD, codeFor(b))).status).toBe(401)
      await q(`update admin_staff set status='suspended' where id=$1`, [b.staffId])
      expect((await signIn(b, STAFF_PASSWORD, codeFor(b))).status).toBe(401)
      expect((await post(login, { email: a.email, password: STAFF_PASSWORD, code: codeFor(a) }, { csrf: false })).body.code).toBe('csrf')
    })
  })

  describe('first-time setup', () => {
    const invite = async (email: string, bound = true, confirmed = true) => {
      const u = await makeUser(email, { confirmed })
      await q(`insert into admin_staff (email, user_id, role_key) values ($1,$2,'viewer')`, [email, bound ? u.id : null])
      return u
    }

    it('always answers the same, and mails only staff who have not finished setup', async () => {
      await invite('inv@x.com')
      await makeStaff('done@x.com', 'viewer')
      await makeUser('plain@x.com')
      for (const email of ['inv@x.com', 'done@x.com', 'plain@x.com', 'nobody@x.com']) {
        const r = await post(setup, { email })
        expect([r.status, r.body]).toEqual([200, { ok: true }])
      }
      expect(sentCodes()).toEqual(['inv@x.com'])
    })

    it('runs end to end: the code proves the mailbox, the password is chosen, the portal opens', async () => {
      const u = await invite('inv@x.com')
      await post(setup, { email: u.email })
      expect((await post(confirm, { email: u.email, code: codeFor(u), password: 'weak' })).status).toBe(400)
      expect((await post(confirm, { email: u.email, code: '000000', password: PW })).status).toBe(401)
      expect(await q(`select 1 from admin_credentials`)).toHaveLength(0)

      const done = await post(confirm, { email: u.email, code: codeFor(u), password: PW })
      expect(done.status).toBe(200)
      expect(done.headers.get('set-cookie')).toMatch(/HttpOnly.*SameSite=Strict/)
      expect((await call(overview, { token: done.body.token })).status).toBe(200)
      expect((await signIn(u, PW, codeFor(u))).status).toBe(200)
    })

    it('cannot be used to replace the password of someone who is already set up', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      expect((await post(confirm, { email: s.email, code: codeFor(s), password: PW })).status).toBe(401)
      expect((await signIn(s, PW, codeFor(s))).status).toBe(401)
      await q(`update admin_credentials set failed_attempts = 0`)
      expect((await signIn(s, STAFF_PASSWORD, codeFor(s))).status).toBe(200)
    })

    it('refuses another account’s code, an unverified email and a wildcard look-alike', async () => {
      const u = await invite('a_b@x.com', false)
      const other = await makeStaff('other@x.com', 'viewer')
      expect((await post(confirm, { email: u.email, code: codeFor(other), password: PW })).status).toBe(401)
      const impostor = await makeUser('axb@x.com')
      expect((await post(confirm, { email: impostor.email, code: codeFor(impostor), password: PW })).status).toBe(401)
      await invite('raw@x.com', false, false)
      expect((await post(confirm, { email: 'raw@x.com', code: codeFor({ id: '', email: 'raw@x.com' }), password: PW })).status).toBe(401)
      expect(await q(`select 1 from admin_credentials where user_id <> $1`, [other.id])).toHaveLength(0)
      // The real invitee is bound to the invitation on the way in.
      expect((await post(confirm, { email: u.email, code: codeFor(u), password: PW })).status).toBe(200)
      expect((await q(`select user_id from admin_staff where email='a_b@x.com'`))[0]!.user_id).toBe(u.id)
    })

    it('provisions the owner on first setup', async () => {
      const owner = await makeUser(OWNER_EMAIL)
      const done = await post(confirm, { email: OWNER_EMAIL, code: codeFor(owner), password: PW })
      expect(done.status).toBe(200)
      expect((await call(status, { token: done.body.token })).body).toMatchObject({ staff: { role: 'owner' }, permissions: ['*'] })
    })
  })

  describe('step-up for dangerous actions', () => {
    it('needs a fresh emailed code or the admin password inside a signed-in session, never nothing', async () => {
      const owner = await makeStaff(OWNER_EMAIL, 'owner')
      const victim = await makeStaff('v@x.com', 'viewer')
      const token = await unlock(login, owner)
      const reset = (proof: Record<string, unknown>) => post(staffPost, { op: 'reset_credentials', id: victim.staffId, ...proof }, { token })
      expect((await reset({})).status).toBe(401)
      expect((await reset({ code: codeFor(victim) })).status).toBe(401)
      await q(`update admin_credentials set failed_attempts = 0, locked_until = null`)
      const code = codeFor(owner)
      expect((await reset({ code })).status).toBe(200)
      expect((await reset({ code })).status).toBe(401)
      await q(`update admin_credentials set failed_attempts = 0, locked_until = null`)
      expect((await reset({ stepUpPassword: STAFF_PASSWORD })).status).toBe(200)
    })
  })

  describe('session lifecycle', () => {
    let a: Staff
    beforeEach(async () => { a = await makeStaff('a@x.com', 'admin') })

    it('refuses a missing, unknown, idle, expired or revoked session', async () => {
      expect((await call(overview)).body.code).toBe('locked')
      expect((await call(overview, { token: 'garbage' })).status).toBe(401)
      const idle = await unlock(login, a)
      await q(`update admin_sessions set last_seen_at = now() - interval '61 minutes' where token_hash = $1`, [sha(idle)])
      expect((await call(overview, { token: idle })).status).toBe(401)
      const expired = await unlock(login, a)
      await q(`update admin_sessions set expires_at = now() - interval '1 second' where token_hash = $1`, [sha(expired)])
      expect((await call(overview, { token: expired })).status).toBe(401)
      const revoked = await unlock(login, a)
      await q(`update admin_sessions set revoked_at = now() where token_hash = $1`, [sha(revoked)])
      expect((await call(overview, { token: revoked })).status).toBe(401)
    })

    it('accepts the token from the HttpOnly cookie and slides the idle clock', async () => {
      const token = await unlock(login, a)
      await q(`update admin_sessions set last_seen_at = now() - interval '30 minutes'`)
      expect((await call(overview, { headers: { cookie: `${ADMIN_COOKIE}=${token}` } })).status).toBe(200)
      expect((await q<{ age: number }>(`select extract(epoch from now() - last_seen_at) age from admin_sessions`))[0]!.age).toBeLessThan(60)
    })

    it('logout revokes the session and clears the cookie; a forged cross-site logout does neither', async () => {
      const token = await unlock(login, a)
      expect((await call(logout, { method: 'POST', token, csrf: false })).status).toBe(403)
      expect((await call(overview, { token })).status).toBe(200)
      expect((await call(logout, { method: 'POST', token })).headers.get('set-cookie')).toContain('Max-Age=0')
      expect((await call(overview, { token })).status).toBe(401)
    })

    it('a suspended account loses a live session on the next request', async () => {
      const token = await unlock(login, a)
      await q(`update admin_staff set status='suspended'`)
      expect((await call(status, { token })).body.isStaff).toBe(false)
      expect((await post(staffPost, { op: 'noop' }, { token })).status).toBe(403)
    })

    it('lists and revokes only the caller’s own sessions', async () => {
      const b = await makeStaff('b@x.com', 'admin')
      const ta = await unlock(login, a)
      const tb = await unlock(login, b)
      const ta2 = await unlock(login, a)
      const list = await call(sessions, { token: ta })
      expect(list.body.sessions).toHaveLength(2)
      expect(list.body.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1)
      const [bSession] = await q<{ id: string }>(`select id from admin_sessions where token_hash=$1`, [sha(tb)])
      expect((await call(delSession, { method: 'DELETE', token: ta, body: { id: bSession!.id } })).status).toBe(404)
      expect((await call(delSession, { method: 'DELETE', token: ta, body: { all: true } })).status).toBe(200)
      expect((await call(overview, { token: tb })).status).toBe(200)
      expect((await call(overview, { token: ta })).status).toBe(200)
      expect((await call(overview, { token: ta2 })).status).toBe(401)
    })

    it('changing the password needs the current one and a code, and signs other sessions out', async () => {
      const t1 = await unlock(login, a)
      const t2 = await unlock(login, a)
      const change = (current: string, next: string) => post(changePassword, { current, next, code: codeFor(a) }, { token: t1 })
      expect((await change('wrong', 'New-Passw0rd-456')).status).toBe(401)
      expect((await change(STAFF_PASSWORD, 'weak')).status).toBe(400)
      expect((await change(STAFF_PASSWORD, 'New-Passw0rd-456')).status).toBe(200)
      expect((await call(overview, { token: t1 })).status).toBe(200)
      expect((await call(overview, { token: t2 })).status).toBe(401)
      expect((await signIn(a, STAFF_PASSWORD, codeFor(a))).status).toBe(401)
      await q(`update admin_credentials set failed_attempts=0, locked_until=null`)
      expect((await signIn(a, 'New-Passw0rd-456', codeFor(a))).status).toBe(200)
    })
  })

  describe('biometric sign-in', () => {
    const SECRET = 'a'.repeat(64)
    const hash = sha(SECRET)
    const phone = { 'x-buddget-device-id': 'iphone-1' }
    const bio = (headers: Record<string, string>, secret?: string) => post(biometric, secret ? { secret } : undefined, { headers })

    it('is enrolled only from a signed-in portal session', async () => {
      const a = await makeStaff('a@x.com', 'viewer')
      expect((await post(addDevice, { secretHash: hash }, { headers: phone })).status).toBe(401)
      const token = await unlock(login, a)
      expect((await post(addDevice, { secretHash: 'short' }, { headers: phone, token })).status).toBe(400)
      expect((await post(addDevice, { secretHash: hash, platform: 'ios' }, { headers: phone, token })).status).toBe(200)
    })

    it('opens a shorter session with the enrolled secret on that device, and with nothing else', async () => {
      const a = await makeStaff('a@x.com', 'viewer')
      await post(addDevice, { secretHash: hash }, { headers: phone, token: await unlock(login, a) })
      expect((await call(status, { headers: phone })).body).toEqual({ isStaff: false, session: null, biometricEnrolled: true })

      const ok = await bio(phone, SECRET)
      expect(ok.status).toBe(200)
      expect((await call(overview, { token: ok.body.token })).status).toBe(200)
      expect((await q<{ hours: number }>(`select round(extract(epoch from expires_at - created_at)/3600)::int hours from admin_sessions where method='biometric'`))[0]!.hours).toBe(4)

      expect((await bio(phone, 'b'.repeat(64))).status).toBe(401)
      expect((await bio({ 'x-buddget-device-id': 'other' }, SECRET)).status).toBe(401)
      expect((await bio(phone)).status).toBe(400)
    })

    it('is refused while locked out, for suspended staff, and after the device is removed', async () => {
      const a = await makeStaff('a@x.com', 'viewer')
      const token = await unlock(login, a)
      await post(addDevice, { secretHash: hash }, { headers: phone, token })
      await q(`update admin_credentials set locked_until = now() + interval '10 minutes'`)
      expect((await bio(phone, SECRET)).status).toBe(429)
      await q(`update admin_credentials set locked_until = null`)
      expect((await call(delDevice, { method: 'DELETE', token, headers: phone })).status).toBe(200)
      expect((await bio(phone, SECRET)).status).toBe(401)
      await post(addDevice, { secretHash: hash }, { headers: phone, token })
      await q(`update admin_staff set status='suspended'`)
      expect((await bio(phone, SECRET)).status).toBe(401)
    })

    it('cannot remove another account’s device', async () => {
      const a = await makeStaff('a@x.com', 'viewer')
      const b = await makeStaff('b@x.com', 'viewer')
      await post(addDevice, { secretHash: hash }, { headers: { 'x-buddget-device-id': 'dev-a' }, token: await unlock(login, a) })
      await call(delDevice, { method: 'DELETE', token: await unlock(login, b), query: { deviceId: 'dev-a' } })
      expect(await q(`select 1 from admin_biometric_devices where device_id='dev-a'`)).toHaveLength(1)
    })
  })

  describe('audit trail', () => {
    it('records sign-ins and failures, and never a secret', async () => {
      const a = await makeStaff('a@x.com', 'viewer')
      await signIn(a, 'bad-Passw0rd', '000000')
      await signIn(a, STAFF_PASSWORD, codeFor(a))
      expect((await q<{ action: string }>(`select action from admin_audit_log order by id`)).map((r) => r.action)).toEqual(['auth.login_failed', 'auth.login'])
      expect(JSON.stringify(await q(`select * from admin_audit_log`))).not.toContain(STAFF_PASSWORD)
    })
  })
})
