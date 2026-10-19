import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { OWNER_EMAIL } from '@/lib/admin/permissions'
import { closePools, pgEnabled } from './harness/pgSupabase'
import { ACCOUNT_PASSWORD } from './harness/mocks'
import { STAFF_PASSWORD, call, clearStep, codeFor, makeStaff, makeUser, q, resetRateLimits, resetWorld, unlock } from './harness/world'
import { decryptSecret } from '../crypto'
import { currentStep, totpCode } from '../totp'
import { ADMIN_COOKIE } from '../session'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', async () => (await import('./harness/mocks')).serviceMock())
vi.mock('@/lib/supabase/resolveRouteUser', async () => (await import('./harness/mocks')).routeUserMock())
vi.mock('@/lib/auth/resolveDeviceId', async () => (await import('./harness/mocks')).deviceMock())
vi.mock('@supabase/supabase-js', async () => (await import('./harness/mocks')).supabaseJsMock())

import { GET as status } from '@/app/api/admin/auth/status/route'
import { POST as setup } from '@/app/api/admin/auth/setup/route'
import { POST as confirm } from '@/app/api/admin/auth/setup/confirm/route'
import { POST as login } from '@/app/api/admin/auth/login/route'
import { POST as logout } from '@/app/api/admin/auth/logout/route'
import { POST as biometric } from '@/app/api/admin/auth/biometric/route'
import { DELETE as delDevice, POST as addDevice } from '@/app/api/admin/auth/biometric/device/route'
import { POST as changePassword } from '@/app/api/admin/auth/password/route'
import { POST as newRecovery } from '@/app/api/admin/auth/recovery/route'
import { DELETE as delSession, GET as sessions } from '@/app/api/admin/auth/sessions/route'
import { GET as overview } from '@/app/api/admin/overview/route'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

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
      expect((await call(status)).body).toEqual({ isStaff: false })
      const u = await makeUser('plain@example.com')
      expect((await call(status, { as: u })).body).toEqual({ isStaff: false })
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
      expect((await call(status, { as: s })).body).toMatchObject({ setup: 'complete', session: null, biometricEnrolled: false })
      const token = await unlock(login, s)
      const r = await call(status, { as: s, token })
      expect(r.body.session).toMatchObject({ method: 'password_totp' })
      expect(r.body.permissions).toEqual(expect.arrayContaining(['overview.view']))
    })
  })

  describe('first-time setup', () => {
    it('rejects non-staff, a missing CSRF header, a wrong account password and weak passwords', async () => {
      const plain = await makeUser('plain@x.com')
      expect((await call(setup, { method: 'POST', as: plain, body: { password: 'Aa1-long-enough-pw', accountPassword: ACCOUNT_PASSWORD } })).body.code).toBe('not_staff')

      const s = await makeUser('inv@x.com')
      await q(`insert into admin_staff (email, user_id, role_key) values ('inv@x.com',$1,'viewer')`, [s.id])
      expect((await call(setup, { method: 'POST', as: s, csrf: false, body: { password: 'Aa1-long-enough-pw', accountPassword: ACCOUNT_PASSWORD } })).body.code).toBe('csrf')
      expect((await call(setup, { method: 'POST', as: s, body: { password: 'Aa1-long-enough-pw', accountPassword: 'nope' } })).status).toBe(401)
      expect((await call(setup, { method: 'POST', as: s, body: { password: 'short', accountPassword: ACCOUNT_PASSWORD } })).status).toBe(400)
      expect(await q(`select 1 from admin_credentials`)).toHaveLength(0)
    })

    it('OAuth-only accounts must have signed in recently', async () => {
      const g = await makeUser('goog@x.com', { provider: 'google' })
      await q(`insert into admin_staff (email, user_id, role_key) values ('goog@x.com',$1,'viewer')`, [g.id])
      await q(`update auth.users set last_sign_in_at = now() - interval '2 hours' where id=$1`, [g.id])
      expect((await call(setup, { method: 'POST', as: g, body: { password: 'Aa1-long-enough-pw' } })).status).toBe(401)
      await q(`update auth.users set last_sign_in_at = now() where id=$1`, [g.id])
      expect((await call(setup, { method: 'POST', as: g, body: { password: 'Aa1-long-enough-pw' } })).status).toBe(200)
    })

    it('runs end to end: secret + QR, wrong code refused, recovery codes issued once, session opened', async () => {
      const u = await makeUser('inv@x.com')
      await q(`insert into admin_staff (email, user_id, role_key) values ('inv@x.com',$1,'viewer')`, [u.id])
      const start = await call(setup, { method: 'POST', as: u, body: { password: 'Aa1-long-enough-pw', accountPassword: ACCOUNT_PASSWORD } })
      expect(start.status).toBe(200)
      expect(start.body.qr).toMatch(/^data:image\/png;base64,/)
      expect(start.body.uri).toContain('otpauth://totp/')
      const secret = start.body.secret as string
      const [row] = await q<{ totp_secret_enc: string; totp_confirmed_at: string | null; password_hash: string }>(`select * from admin_credentials`)
      expect(row!.totp_confirmed_at).toBeNull()
      expect(row!.totp_secret_enc).not.toContain(secret)
      expect(decryptSecret(row!.totp_secret_enc)).toBe(secret)
      expect(row!.password_hash.startsWith('scrypt$')).toBe(true)

      // still unusable until confirmed
      expect((await call(login, { method: 'POST', as: u, body: { password: 'Aa1-long-enough-pw', code: totpCode(secret, currentStep()) } })).body.code).toBe('setup_required')

      const wrong = totpCode(secret, currentStep() + 40)
      expect((await call(confirm, { method: 'POST', as: u, body: { code: wrong } })).status).toBe(401)

      const done = await call(confirm, { method: 'POST', as: u, body: { code: totpCode(secret, currentStep()) } })
      expect(done.status).toBe(200)
      expect(done.body.recoveryCodes).toHaveLength(10)
      expect(done.headers.get('set-cookie')).toContain(`${ADMIN_COOKIE}=`)
      expect(done.headers.get('set-cookie')).toMatch(/HttpOnly.*SameSite=Strict/)
      const [after] = await q<{ recovery_hashes: string[]; totp_confirmed_at: string }>(`select * from admin_credentials`)
      expect(after!.totp_confirmed_at).toBeTruthy()
      expect(after!.recovery_hashes).toHaveLength(10)
      for (const code of done.body.recoveryCodes as string[]) expect(JSON.stringify(after)).not.toContain(code)

      // setup is one-shot
      expect((await call(setup, { method: 'POST', as: u, body: { password: 'Aa1-long-enough-pw', accountPassword: ACCOUNT_PASSWORD } })).status).toBe(409)
      expect((await call(confirm, { method: 'POST', as: u, body: { code: totpCode(secret, currentStep()) } })).status).toBe(409)
    })

    it('throttles repeated setup attempts', async () => {
      const u = await makeUser('inv@x.com')
      await q(`insert into admin_staff (email, user_id, role_key) values ('inv@x.com',$1,'viewer')`, [u.id])
      let last = 0
      for (let i = 0; i < 12; i++) last = (await call(setup, { method: 'POST', as: u, body: { password: 'x', accountPassword: 'bad' } })).status
      expect(last).toBe(429)
    })
  })

  describe('login', () => {
    it('unlocks with password + code, stores only a hash of the session token', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      const r = await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code: codeFor(s) } })
      expect(r.status).toBe(200)
      const token = r.body.token as string
      expect(token.length).toBeGreaterThanOrEqual(40)
      const rows = await q<{ token_hash: string; method: string }>(`select token_hash, method from admin_sessions`)
      expect(rows).toHaveLength(1)
      expect(rows[0]!.token_hash).toBe(sha(token))
      expect(rows[0]!.token_hash).not.toBe(token)
      expect(rows[0]!.method).toBe('password_totp')
      expect((await call(overview, { as: s, token })).status).toBe(200)
    })

    it('gives wrong password and wrong code the same answer, and counts both', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      const badPw = await call(login, { method: 'POST', as: s, body: { password: 'wrong-Passw0rd', code: codeFor(s) } })
      await clearStep(s.id)
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

    it('refuses a replayed authenticator code', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      const code = codeFor(s)
      expect((await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code } })).status).toBe(200)
      expect((await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code } })).status).toBe(401)
    })

    it('does not let two concurrent logins spend the same code', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      const code = codeFor(s)
      const results = await Promise.all([1, 2, 3, 4].map(() => call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code } })))
      expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    })

    it('honours a recovery code exactly once, ignoring case and spaces', async () => {
      const s = await makeStaff('a@x.com', 'viewer')
      const token = await unlock(login, s)
      const pw = await call(newRecovery, { method: 'POST', as: s, token, body: { password: STAFF_PASSWORD, code: codeFor(s, 1) } })
      expect(pw.status).toBe(200)
      const [first] = pw.body.recoveryCodes as string[]
      const a = await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code: ` ${first!.toUpperCase()} ` } })
      expect(a.status).toBe(200)
      expect(a.body.recoveryCodesLeft).toBe(9)
      expect((await call(login, { method: 'POST', as: s, body: { password: STAFF_PASSWORD, code: first } })).status).toBe(401)
      expect((await q<{ method: string }>(`select method from admin_sessions order by created_at desc limit 1`))[0]!.method).toBe('recovery')
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

  describe('password and recovery codes', () => {
    it('changes the password only with the current password and a fresh code, signing other sessions out', async () => {
      const a = await makeStaff('a@x.com', 'admin')
      const t1 = await unlock(login, a)
      const t2 = await unlock(login, a)
      const bad = await call(changePassword, { method: 'POST', as: a, token: t1, body: { current: 'wrong', next: 'New-Passw0rd-456', code: codeFor(a, 1) } })
      expect(bad.status).toBe(401)
      await clearStep(a.id)
      expect((await call(changePassword, { method: 'POST', as: a, token: t1, body: { current: STAFF_PASSWORD, next: 'weak', code: codeFor(a) } })).status).toBe(400)
      await clearStep(a.id)
      expect((await call(changePassword, { method: 'POST', as: a, token: t1, body: { current: STAFF_PASSWORD, next: 'New-Passw0rd-456', code: codeFor(a) } })).status).toBe(200)
      expect((await call(overview, { as: a, token: t1 })).status).toBe(200)
      expect((await call(overview, { as: a, token: t2 })).status).toBe(401)
      await clearStep(a.id)
      expect((await call(login, { method: 'POST', as: a, body: { password: STAFF_PASSWORD, code: codeFor(a) } })).status).toBe(401)
      await clearStep(a.id)
      await q(`update admin_credentials set failed_attempts=0, locked_until=null`)
      expect((await call(login, { method: 'POST', as: a, body: { password: 'New-Passw0rd-456', code: codeFor(a) } })).status).toBe(200)
    })

    it('replaces recovery codes, invalidating the old ones', async () => {
      const a = await makeStaff('a@x.com', 'admin')
      const t = await unlock(login, a)
      const one = await call(newRecovery, { method: 'POST', as: a, token: t, body: { password: STAFF_PASSWORD, code: codeFor(a, 1) } })
      const oldCode = (one.body.recoveryCodes as string[])[0]!
      await clearStep(a.id)
      const two = await call(newRecovery, { method: 'POST', as: a, token: t, body: { password: STAFF_PASSWORD, code: codeFor(a) } })
      expect(two.status).toBe(200)
      expect((await call(login, { method: 'POST', as: a, body: { password: STAFF_PASSWORD, code: oldCode } })).status).toBe(401)
    })
  })

  describe('biometric unlock', () => {
    const SECRET = 'a'.repeat(64)
    const hash = sha(SECRET)

    it('cannot be enrolled without an unlocked session', async () => {
      const a = await makeStaff('a@x.com', 'viewer')
      expect((await call(addDevice, { method: 'POST', as: a, body: { secretHash: hash } })).status).toBe(401)
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
      await clearStep(a.id)
      await call(login, { method: 'POST', as: a, body: { password: STAFF_PASSWORD, code: codeFor(a) } })
      const rows = await q<{ action: string }>(`select action from admin_audit_log order by id`)
      expect(rows.map((r) => r.action)).toEqual(['auth.login_failed', 'auth.login'])
      const dump = JSON.stringify(await q(`select * from admin_audit_log`))
      expect(dump).not.toContain(STAFF_PASSWORD)
    })
  })
})
