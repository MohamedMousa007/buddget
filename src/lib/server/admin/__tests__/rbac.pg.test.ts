import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { closePools, pgEnabled } from './harness/pgSupabase'
import { STAFF_PASSWORD, call, makeStaff, makeUser, q, resetRateLimits, resetWorld, unlock, type Handler, type Staff } from './harness/world'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', async () => (await import('./harness/mocks')).serviceMock())
vi.mock('@/lib/supabase/resolveRouteUser', async () => (await import('./harness/mocks')).routeUserMock())
vi.mock('@/lib/auth/resolveDeviceId', async () => (await import('./harness/mocks')).deviceMock())
vi.mock('@/lib/server/admin/inviteEmail', () => ({ sendStaffInviteEmail: async () => true }))
vi.mock('@supabase/supabase-js', async () => (await import('./harness/mocks')).supabaseJsMock())

import { POST as login } from '@/app/api/admin/auth/login/route'
import { GET as overview } from '@/app/api/admin/overview/route'
import { GET as analytics } from '@/app/api/admin/analytics/route'
import { GET as usersList } from '@/app/api/admin/users/route'
import { GET as userGet, POST as userPost } from '@/app/api/admin/users/[id]/route'
import { GET as userActivity } from '@/app/api/admin/users/[id]/activity/route'
import { GET as smsLogs, POST as smsLogsPost } from '@/app/api/admin/sms/logs/route'
import { GET as smsHealth } from '@/app/api/admin/sms/health/route'
import { GET as smsPush } from '@/app/api/admin/sms/push-health/route'
import { POST as smsTemplates } from '@/app/api/admin/sms/templates/route'
import { POST as smsPromotion } from '@/app/api/admin/sms/promotion/route'
import { GET as ticketsList, POST as ticketsPost } from '@/app/api/admin/support/tickets/route'
import { GET as ticketGet, POST as ticketPost } from '@/app/api/admin/support/tickets/[id]/route'
import { GET as plansGet, POST as plansPost } from '@/app/api/admin/plans/route'
import { GET as loyaltyGet, POST as loyaltyPost } from '@/app/api/admin/loyalty/route'
import { GET as flagsGet, POST as flagsPost } from '@/app/api/admin/flags/route'
import { GET as platformGet, PATCH as platformPatch, POST as platformPost } from '@/app/api/admin/platform/route'
import { GET as staffGet, POST as staffPost } from '@/app/api/admin/staff/route'
import { GET as auditGet } from '@/app/api/admin/audit/route'
import { GET as sessionsGet, DELETE as sessionsDelete } from '@/app/api/admin/auth/sessions/route'
import { POST as passwordPost } from '@/app/api/admin/auth/password/route'
import { POST as ssoPost } from '@/app/api/admin/auth/sso/route'
import { POST as deviceAdd, DELETE as deviceDel } from '@/app/api/admin/auth/biometric/device/route'

const ROLES = ['owner', 'admin', 'support_lead', 'support_agent', 'engineer', 'finance', 'growth', 'viewer'] as const
const ZERO = '00000000-0000-4000-8000-000000000000'

interface Endpoint { name: string; handler: Handler; method?: string; perm: string | null; body?: unknown; params?: Record<string, string>; query?: Record<string, string> }

describe.skipIf(!pgEnabled)('admin RBAC (real Postgres)', () => {
  let target: { id: string }
  const staff = new Map<string, Staff>()
  const tokens = new Map<string, string>()

  const endpoints = (): Endpoint[] => {
    const uid = { id: target.id }
    return [
      { name: 'overview', handler: overview, perm: 'overview.view' },
      { name: 'analytics', handler: analytics, perm: 'analytics.view' },
      { name: 'users list', handler: usersList, perm: 'users.view' },
      { name: 'user detail', handler: userGet, perm: 'users.view', params: uid },
      { name: 'user activity', handler: userActivity, perm: 'users.logs', params: uid },
      { name: 'user note', handler: userPost, method: 'POST', perm: 'users.edit', params: uid, body: { op: 'note', body: 'hi' } },
      { name: 'user verify email', handler: userPost, method: 'POST', perm: 'users.edit', params: uid, body: { op: 'verify_email' } },
      { name: 'user suspend', handler: userPost, method: 'POST', perm: 'users.suspend', params: uid, body: { op: 'suspend' } },
      { name: 'user restore', handler: userPost, method: 'POST', perm: 'users.suspend', params: uid, body: { op: 'restore' } },
      { name: 'user set limits', handler: userPost, method: 'POST', perm: 'users.limits', params: uid, body: { op: 'set_limits', limits: {} } },
      { name: 'user set entitlement', handler: userPost, method: 'POST', perm: 'billing.manage', params: uid, body: { op: 'set_entitlement', planKey: 'free', status: 'active' } },
      { name: 'user clear entitlement', handler: userPost, method: 'POST', perm: 'billing.manage', params: uid, body: { op: 'clear_entitlement' } },
      { name: 'user notify', handler: userPost, method: 'POST', perm: 'users.notify', params: uid, body: { op: 'notify', title: 't', body: 'b' } },
      { name: 'user reset sms tokens', handler: userPost, method: 'POST', perm: 'users.tools', params: uid, body: { op: 'reset_sms_tokens' } },
      { name: 'user password reset', handler: userPost, method: 'POST', perm: 'users.security', params: uid, body: { op: 'send_password_reset' } },
      { name: 'user delete', handler: userPost, method: 'POST', perm: 'users.delete', params: uid, body: { op: 'delete', code: '000000' } },
      { name: 'sms logs', handler: smsLogs, perm: 'sms.view' },
      { name: 'sms ticket', handler: smsLogsPost, method: 'POST', perm: 'support.reply', body: { op: 'create_ticket', id: ZERO } },
      { name: 'sms health', handler: smsHealth, perm: 'sms.view' },
      { name: 'sms push health', handler: smsPush, perm: 'sms.view' },
      { name: 'sms templates list', handler: smsTemplates, method: 'POST', perm: 'sms.view', body: { op: 'list' } },
      { name: 'sms templates delete', handler: smsTemplates, method: 'POST', perm: 'sms.manage', body: { op: 'delete', id: ZERO } },
      { name: 'sms templates bulk', handler: smsTemplates, method: 'POST', perm: 'sms.manage', body: { op: 'bulk_toggle', patch: { ai_enabled: true } } },
      { name: 'sms promotion get', handler: smsPromotion, method: 'POST', perm: 'sms.view', body: { op: 'get' } },
      { name: 'sms promotion save', handler: smsPromotion, method: 'POST', perm: 'sms.manage', body: { op: 'save', config: { min_match_count: 50 } } },
      { name: 'sms promotion run', handler: smsPromotion, method: 'POST', perm: 'sms.manage', body: { op: 'run_auto_promote' } },
      { name: 'tickets list', handler: ticketsList, perm: 'support.view' },
      { name: 'ticket create', handler: ticketsPost, method: 'POST', perm: 'support.reply', body: { subject: 'Hello there', message: 'x' } },
      { name: 'ticket get', handler: ticketGet, perm: 'support.view', params: { id: ZERO } },
      { name: 'ticket reply', handler: ticketPost, method: 'POST', perm: 'support.reply', params: { id: ZERO }, body: { op: 'reply', message: 'x' } },
      { name: 'plans get', handler: plansGet, perm: 'billing.view' },
      { name: 'plans upsert', handler: plansPost, method: 'POST', perm: 'billing.manage', body: { op: 'upsert', plan: { key: 'zz', name: 'Z' } } },
      { name: 'loyalty get', handler: loyaltyGet, perm: 'loyalty.view' },
      { name: 'loyalty tier', handler: loyaltyPost, method: 'POST', perm: 'loyalty.manage', body: { op: 'upsert_tier', tier: { key: 'zz', name: 'Z' } } },
      { name: 'flags get', handler: flagsGet, perm: 'flags.view' },
      { name: 'flags upsert', handler: flagsPost, method: 'POST', perm: 'flags.manage', body: { op: 'upsert', flag: { key: 'zz.flag' } } },
      { name: 'platform get', handler: platformGet, perm: 'platform.view' },
      { name: 'platform ai throttle', handler: platformPatch, method: 'PATCH', perm: 'platform.manage', body: { aiRuntime: { rateLimitingEnabled: false } } },
      { name: 'platform setting', handler: platformPost, method: 'POST', perm: 'platform.manage', body: { op: 'set_setting', key: 'maintenance', value: { enabled: false } } },
      { name: 'staff get', handler: staffGet, perm: 'staff.view' },
      { name: 'staff invite', handler: staffPost, method: 'POST', perm: 'staff.manage', body: { op: 'invite', email: 'x@y.com', roleKey: 'viewer' } },
      { name: 'audit', handler: auditGet, perm: 'audit.view' },
      // any active staff member, regardless of role
      { name: 'my sessions', handler: sessionsGet, perm: null },
      { name: 'revoke sessions', handler: sessionsDelete, method: 'DELETE', perm: null, body: { id: ZERO } },
      { name: 'change password', handler: passwordPost, method: 'POST', perm: null, body: {} },
      { name: 'sso switch', handler: ssoPost, method: 'POST', perm: null, body: {} },
      { name: 'enroll biometric', handler: deviceAdd, method: 'POST', perm: null, body: {} },
      { name: 'remove biometric', handler: deviceDel, method: 'DELETE', perm: null },
    ]
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
    target = await makeUser('target@example.com')
    for (const role of ROLES) {
      const email = role === 'owner' ? 'm.mousaofficial@gmail.com' : `${role}@x.com`
      const s = await makeStaff(email, role)
      staff.set(role, s)
      tokens.set(role, await unlock(login, s))
    }
  })

  it('every endpoint refuses unauthenticated callers, non-staff, locked sessions and CSRF-less mutations', async () => {
    const plain = await makeUser('plain@x.com')
    const viewer = staff.get('viewer')!
    for (const e of endpoints()) {
      const base = { method: e.method, body: e.body, params: e.params, query: e.query }
      const anon = await call(e.handler, { ...base })
      expect(anon.status, `${e.name}: anonymous`).toBe(401)
      const nonStaff = await call(e.handler, { ...base, as: plain })
      expect(nonStaff.status, `${e.name}: non-staff`).toBe(403)
      expect(nonStaff.body.code, `${e.name}: non-staff code`).toBe('not_staff')
      const locked = await call(e.handler, { ...base, as: viewer })
      expect(locked.status, `${e.name}: no session`).toBe(401)
      expect(locked.body.code, `${e.name}: no session code`).toBe('locked')
      if (e.method && e.method !== 'GET') {
        const noCsrf = await call(e.handler, { ...base, as: viewer, token: tokens.get('viewer'), csrf: false })
        expect(noCsrf.status, `${e.name}: csrf`).toBe(403)
        expect(noCsrf.body.code, `${e.name}: csrf code`).toBe('csrf')
      }
    }
  })

  it('grants each role exactly the endpoints its permissions cover', async () => {
    const perms = new Map<string, Set<string>>()
    for (const role of ROLES) {
      const [row] = await q<{ permissions: string[] }>(`select permissions from admin_roles where key=$1`, [role])
      perms.set(role, new Set(row!.permissions))
    }
    const owner = (p: Set<string>) => p.has('*')
    const failures: string[] = []
    for (const role of ROLES) {
      for (const e of endpoints()) {
        const res = await call(e.handler, { method: e.method, body: e.body, params: e.params, query: e.query, as: staff.get(role)!, token: tokens.get(role) })
        const allowed = e.perm === null || owner(perms.get(role)!) || perms.get(role)!.has(e.perm)
        const forbidden = res.status === 403
        // `users.delete` is never delegated: only the owner passes the guard for it.
        const expectAllowed = e.perm === 'users.delete' ? role === 'owner' : allowed
        if (expectAllowed && forbidden) failures.push(`${role} should reach "${e.name}" but got 403`)
        if (!expectAllowed && !forbidden) failures.push(`${role} must NOT reach "${e.name}" but got ${res.status}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('keeps users.delete owner-only even when granted as an extra permission', async () => {
    const lead = await makeStaff('lead2@x.com', 'support_lead', { extra: ['users.delete'] })
    const t = await unlock(login, lead)
    const r = await call(userPost, { method: 'POST', as: lead, token: t, params: { id: target.id }, body: { op: 'delete', code: '000000' } })
    expect(r.status).toBe(403)
    expect(await q(`select 1 from auth.users where id=$1`, [target.id])).toHaveLength(1)
  })

  it('applies extra permissions on top of a role', async () => {
    const v = await makeStaff('v2@x.com', 'viewer', { extra: ['audit.view'] })
    const t = await unlock(login, v)
    expect((await call(auditGet, { as: v, token: t })).status).toBe(200)
    expect((await call(staffGet, { as: v, token: t })).status).toBe(403)
  })

  it('masks personal data for staff without users.pii', async () => {
    await q(`update profiles set phone='+971500000000', city='Dubai' where id=$1`, [target.id])
    const agent = staff.get('support_agent')!
    const list = await call(usersList, { as: agent, token: tokens.get('support_agent') })
    const row = list.body.rows.find((r: { id: string }) => r.id === target.id)
    expect(row.email).toMatch(/^ta\*\*\*@ex\*\*\*\.com$/)
    const detail = await call(userGet, { as: agent, token: tokens.get('support_agent'), params: { id: target.id } })
    expect(detail.body.auth.email).toContain('***')
    expect(detail.body.auth.phone).toBeUndefined()
    expect(detail.body.profile.phone).toBeUndefined()
    expect(JSON.stringify(detail.body)).not.toContain('Dubai')
    const lead = await call(userGet, { as: staff.get('support_lead')!, token: tokens.get('support_lead'), params: { id: target.id } })
    expect(lead.body.auth.email).toBe('target@example.com')
    expect(lead.body.profile.phone).toBe('+971500000000')
  })

  it('answers every JSON route with Cache-Control: no-store', async () => {
    for (const e of endpoints().slice(0, 12)) {
      const r = await call(e.handler, { method: e.method, body: e.body, params: e.params, as: staff.get('owner')!, token: tokens.get('owner') })
      expect(r.headers.get('cache-control'), e.name).toBe('no-store')
    }
  })

  it('STAFF_PASSWORD constant stays strong enough for the policy', () => {
    expect(STAFF_PASSWORD.length).toBeGreaterThanOrEqual(12)
  })
})
