import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { OWNER_EMAIL } from '@/lib/admin/permissions'
import { closePools, pgEnabled } from './harness/pgSupabase'
import { call, makeStaff, makeUser, q, resetRateLimits, resetWorld, unlock, type Staff, type TestUser } from './harness/world'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', async () => (await import('./harness/mocks')).serviceMock())
vi.mock('@/lib/supabase/resolveRouteUser', async () => (await import('./harness/mocks')).routeUserMock())
vi.mock('@/lib/auth/resolveDeviceId', async () => (await import('./harness/mocks')).deviceMock())
vi.mock('@/lib/server/admin/inviteEmail', () => ({ sendStaffInviteEmail: async () => true }))
vi.mock('@supabase/supabase-js', async () => (await import('./harness/mocks')).supabaseJsMock())
vi.mock('@/lib/server/firebaseAdmin', () => ({ getFirebaseAdmin: () => null }))
vi.mock('@/lib/sms/promotionChecker', () => ({ invalidateConfigCache: () => undefined }))
vi.mock('@/lib/server/aiRuntimeConfig', () => {
  let stored = { rateLimitingEnabled: false, rateLimitMaxRequests: 15, rateLimitWindowMs: 60000 }
  return {
    getStoredAiRuntimeConfig: () => stored,
    getEffectiveAiRuntimeConfig: () => stored,
    hasPersistedRuntimeConfigFile: () => false,
    saveAiRuntimeConfig: (patch: Partial<typeof stored>) => (stored = { ...stored, ...patch }),
  }
})

import { POST as login } from '@/app/api/admin/auth/login/route'
import { GET as ticketsList, POST as ticketsPost } from '@/app/api/admin/support/tickets/route'
import { GET as ticketGet, POST as ticketPost } from '@/app/api/admin/support/tickets/[id]/route'
import { GET as plansGet, POST as plansPost } from '@/app/api/admin/plans/route'
import { GET as loyaltyGet, POST as loyaltyPost } from '@/app/api/admin/loyalty/route'
import { GET as flagsGet, POST as flagsPost } from '@/app/api/admin/flags/route'
import { GET as platformGet, PATCH as platformPatch, POST as platformPost } from '@/app/api/admin/platform/route'
import { GET as smsLogs, POST as smsLogsPost } from '@/app/api/admin/sms/logs/route'
import { GET as smsHealth } from '@/app/api/admin/sms/health/route'
import { POST as smsTemplates } from '@/app/api/admin/sms/templates/route'
import { POST as smsPromotion } from '@/app/api/admin/sms/promotion/route'
import { GET as auditGet } from '@/app/api/admin/audit/route'
import { GET as overview } from '@/app/api/admin/overview/route'
import { GET as analytics } from '@/app/api/admin/analytics/route'

const ZERO = '00000000-0000-4000-8000-000000000000'

describe.skipIf(!pgEnabled)('admin domain routes (real Postgres)', () => {
  let owner: Staff, admin: Staff, agent: Staff, lead: Staff, finance: Staff, viewer: Staff
  let t: Record<string, string>
  let u: TestUser

  const as = (who: Staff) => ({ as: who, token: t[who.email] })
  const post = (h: Parameters<typeof call>[0], who: Staff, body: unknown, extra: Record<string, unknown> = {}) => call(h, { method: 'POST', ...as(who), body, ...extra })

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
    finance = await makeStaff('fin@x.com', 'finance')
    viewer = await makeStaff('viewer@x.com', 'viewer')
    t = {}
    for (const s of [owner, admin, lead, agent, finance, viewer]) t[s.email] = await unlock(login, s)
    u = await makeUser('sara@example.com', { name: 'Sara' })
  })

  describe('support desk', () => {
    const create = async (body: Record<string, unknown> = {}) => {
      const r = await post(ticketsPost, agent, { subject: 'Cannot sign in', message: 'Face ID loop', userId: u.id, category: 'account', priority: 'high', ...body })
      expect(r.status, JSON.stringify(r.body)).toBe(200)
      return r.body as { id: string; number: number }
    }

    it('creates a ticket linked to a user with the opening message as an internal note, assigned to the creator', async () => {
      const tk = await create()
      expect(tk.number).toBeGreaterThan(0)
      const [row] = await q<{ user_id: string; requester_email: string; assignee_id: string; source: string; category: string; priority: string; status: string }>(`select * from support_tickets`)
      expect(row).toMatchObject({ user_id: u.id, requester_email: 'sara@example.com', assignee_id: agent.staffId, source: 'admin', category: 'account', priority: 'high', status: 'open' })
      expect((await q<{ internal: boolean }>(`select internal from support_ticket_messages`))[0]!.internal).toBe(true)
    })

    it('validates input and falls back to safe defaults', async () => {
      expect((await post(ticketsPost, agent, { subject: 'x', message: 'm' })).status).toBe(400)
      expect((await post(ticketsPost, agent, { subject: 'Valid subject', message: '  ' })).status).toBe(400)
      expect((await post(ticketsPost, agent, { subject: 'Valid subject', message: 'm', userId: 'bad' })).status).toBe(400)
      expect((await post(ticketsPost, agent, { subject: 'Valid subject', message: 'm', userId: ZERO })).status).toBe(404)
      const ok = await post(ticketsPost, agent, { subject: 'Valid subject', message: 'm', category: 'weird', priority: 'nuclear' })
      expect(ok.status).toBe(200)
      expect((await q(`select category, priority from support_tickets`))[0]).toMatchObject({ category: 'general', priority: 'normal' })
    })

    it('replies to the user (notifying them, setting first response, moving open→pending) and keeps internal notes private', async () => {
      const tk = await create()
      const note = await post(ticketPost, agent, { op: 'reply', message: 'checking logs', internal: true }, { params: { id: tk.id } })
      expect(note.status).toBe(200)
      expect(await q(`select 1 from notifications where user_id=$1`, [u.id])).toHaveLength(0)
      expect((await q(`select status, first_response_at from support_tickets`))[0]).toMatchObject({ status: 'open', first_response_at: null })

      const reply = await post(ticketPost, agent, { op: 'reply', message: 'Please update the app' }, { params: { id: tk.id } })
      expect(reply.status).toBe(200)
      expect((await q(`select status, first_response_at from support_tickets`))[0]!.status).toBe('pending')
      expect((await q(`select first_response_at from support_tickets`))[0]!.first_response_at).toBeTruthy()
      const n = await q<{ title: string; message: string; metadata: { ticketNumber: number } }>(`select title, message, metadata from notifications where user_id=$1`, [u.id])
      expect(n).toHaveLength(1)
      expect(n[0]).toMatchObject({ message: 'Please update the app' })
      expect(n[0]!.title).toContain('Support')
      const detail = await call(ticketGet, { ...as(agent), params: { id: tk.id } })
      expect(detail.body.messages).toHaveLength(3)
      expect(await post(ticketPost, agent, { op: 'reply', message: '' }, { params: { id: tk.id } }).then((r) => r.status)).toBe(400)
    })

    it('updates fields with validation, resolves with a timestamp and reopens clearing it', async () => {
      const tk = await create()
      const upd = (body: Record<string, unknown>) => post(ticketPost, agent, { op: 'update', ...body }, { params: { id: tk.id } })
      expect((await upd({ status: 'bogus' })).status).toBe(400)
      expect((await upd({ priority: 'bogus' })).status).toBe(400)
      expect((await upd({ category: 'bogus' })).status).toBe(400)
      expect((await upd({})).status).toBe(400)
      expect((await upd({ status: 'resolved' })).status).toBe(200)
      expect((await q(`select resolved_at from support_tickets`))[0]!.resolved_at).toBeTruthy()
      expect((await upd({ status: 'open', tags: [' VIP ', 'Billing', ...Array(20).fill('x')] })).status).toBe(200)
      const [row] = await q<{ resolved_at: string | null; tags: string[] }>(`select resolved_at, tags from support_tickets`)
      expect(row!.resolved_at).toBeNull()
      expect(row!.tags.slice(0, 2)).toEqual(['vip', 'billing'])
      expect(row!.tags.length).toBeLessThanOrEqual(10)
    })

    it('lets agents assign only to themselves; leads can assign anyone', async () => {
      const tk = await create()
      const other = lead.staffId
      expect((await post(ticketPost, agent, { op: 'update', assigneeId: other }, { params: { id: tk.id } })).status).toBe(403)
      expect((await post(ticketPost, agent, { op: 'update', assigneeId: agent.staffId }, { params: { id: tk.id } })).status).toBe(200)
      expect((await post(ticketPost, lead, { op: 'update', assigneeId: other }, { params: { id: tk.id } })).status).toBe(200)
      expect((await post(ticketPost, lead, { op: 'update', assigneeId: null }, { params: { id: tk.id } })).status).toBe(200)
      expect((await post(ticketPost, lead, { op: 'update', assigneeId: 'nope' }, { params: { id: tk.id } })).status).toBe(400)
    })

    it('only managers delete tickets', async () => {
      const tk = await create()
      expect((await post(ticketPost, agent, { op: 'delete' }, { params: { id: tk.id } })).status).toBe(403)
      expect((await post(ticketPost, lead, { op: 'delete' }, { params: { id: tk.id } })).status).toBe(200)
      expect(await q(`select 1 from support_tickets`)).toHaveLength(0)
      expect(await q(`select 1 from support_ticket_messages`)).toHaveLength(0)
    })

    it('lists with views, search and counts, masking requester email for staff without PII', async () => {
      const a = await create({ subject: 'Alpha broken', priority: 'urgent' })
      const b = await create({ subject: 'Beta slow' })
      await post(ticketPost, agent, { op: 'update', status: 'resolved' }, { params: { id: b.id } })
      const list = (query: Record<string, string>, who = lead) => call(ticketsList, { ...as(who), query })
      expect((await list({})).body.tickets.map((x: { id: string }) => x.id)).toEqual([a.id])
      expect((await list({ view: 'resolved' })).body.tickets.map((x: { id: string }) => x.id)).toEqual([b.id])
      expect((await list({ view: 'unassigned' })).body.tickets).toHaveLength(0)
      expect((await list({ view: 'mine' }, agent)).body.tickets).toHaveLength(1)
      expect((await list({ q: 'alpha' })).body.tickets).toHaveLength(1)
      expect((await list({ q: "%'),status.eq.open,(" })).status).toBe(200)
      expect((await list({ priority: 'urgent', view: 'active' })).body.tickets).toHaveLength(1)
      expect((await list({})).body.counts).toMatchObject({ active: 1, mine: 0, urgent: 1, resolved: 1 })
      expect((await list({}, agent)).body.tickets[0].requester_email).toContain('***')
      expect((await list({}, lead)).body.tickets[0].requester_email).toBe('sara@example.com')
    })

    it('turns a failing SMS into a ticket carrying its raw text internally', async () => {
      const [{ id }] = await q<{ id: string }>(`insert into sms_parse_log (user_id, source, raw_body, status, sender, failure_code) values ($1,'x','Your CIB card ending 1234 was charged EGP 55','failed','CIB','null_amount') returning id`, [u.id])
      const r = await post(smsLogsPost, lead, { op: 'create_ticket', id })
      expect(r.status).toBe(200)
      const [tk] = await q<{ source: string; category: string; subject: string; tags: string[]; user_id: string }>(`select * from support_tickets`)
      expect(tk).toMatchObject({ source: 'sms_queue', category: 'sms', user_id: u.id, tags: ['null_amount'] })
      expect(tk!.subject).toContain('CIB')
      const [m] = await q<{ internal: boolean; body: string }>(`select * from support_ticket_messages`)
      expect(m!.internal).toBe(true)
      expect(m!.body).toContain('charged EGP 55')
      expect((await post(smsLogsPost, agent, { op: 'create_ticket', id: ZERO })).status).toBe(404)
      expect((await post(smsLogsPost, agent, { op: 'other', id })).status).toBe(400)
    })

    it('404s and 400s on bad ticket ids', async () => {
      expect((await call(ticketGet, { ...as(agent), params: { id: ZERO } })).status).toBe(404)
      expect((await call(ticketGet, { ...as(agent), params: { id: 'bad' } })).status).toBe(400)
    })
  })

  describe('plans', () => {
    const plan = { key: 'plus', name: 'Plus', description: 'Power users', status: 'active', priceMonthlyCents: 499, priceYearlyCents: 3999, currency: 'usd', trialDays: 14, limits: { ai_budget_per_hour: 60, receipt_scans_per_month: null }, features: ['ai_assistant', 'not_a_feature'], sortOrder: 10 }

    it('creates and edits a plan, normalising currency and dropping unknown features', async () => {
      expect((await post(plansPost, finance, { op: 'upsert', plan })).status).toBe(200)
      const [row] = await q<Record<string, unknown>>(`select * from plans where key='plus'`)
      expect(row).toMatchObject({ currency: 'USD', trial_days: 14, price_monthly_cents: 499, features: ['ai_assistant'] })
      expect(row!.limits).toEqual({ ai_budget_per_hour: 60, receipt_scans_per_month: null })
      expect((await post(plansPost, finance, { op: 'upsert', plan: { ...plan, name: 'Plus+' } })).status).toBe(200)
      expect((await q(`select name from plans where key='plus'`))[0]).toMatchObject({ name: 'Plus+' })
    })

    it.each([
      ['a bad key', { key: 'Bad Key' }],
      ['no name', { name: ' ' }],
      ['an unknown limit', { limits: { nope: 1 } }],
      ['a negative limit', { limits: { ai_budget_per_hour: -3 } }],
    ])('refuses %s', async (_n, over) => {
      expect((await post(plansPost, finance, { op: 'upsert', plan: { ...plan, ...over } })).status).toBe(400)
    })

    it('clamps trial length and prices, and defaults new plans to draft', async () => {
      await post(plansPost, finance, { op: 'upsert', plan: { key: 'zz', name: 'Z', trialDays: 9999, priceMonthlyCents: -5 } })
      expect((await q(`select trial_days, price_monthly_cents, status from plans where key='zz'`))[0]).toMatchObject({ trial_days: 365, price_monthly_cents: 0, status: 'draft' })
    })

    it('keeps exactly one default plan, and it must stay active', async () => {
      await post(plansPost, finance, { op: 'upsert', plan })
      expect((await post(plansPost, finance, { op: 'set_default', key: 'zz' })).status).toBe(400)
      expect((await post(plansPost, finance, { op: 'upsert', plan: { key: 'free', name: 'Free', status: 'archived' } })).status).toBe(400)
      expect((await post(plansPost, finance, { op: 'set_default', key: 'plus' })).status).toBe(200)
      expect((await q<{ key: string }>(`select key from plans where is_default`)).map((r) => r.key)).toEqual(['plus'])
      expect((await post(plansPost, finance, { op: 'delete', key: 'plus' })).status).toBe(400)
    })

    it('refuses to delete a plan that has members, and reports membership counts', async () => {
      await post(plansPost, finance, { op: 'upsert', plan })
      await q(`insert into user_entitlements (user_id, plan_key, status) values ($1,'plus','trialing')`, [u.id])
      expect((await post(plansPost, finance, { op: 'delete', key: 'plus' })).status).toBe(400)
      const r = await call(plansGet, as(finance))
      expect(r.body.members.plus).toMatchObject({ trialing: 1 })
      expect(r.body.members.free.implicit).toBeGreaterThanOrEqual(1)
      expect(r.body.billingLive).toBe(false)
      expect(r.body.catalog.limits.ai_budget_per_hour.enforced).toBe(true)
      await q(`delete from user_entitlements`)
      expect((await post(plansPost, finance, { op: 'delete', key: 'plus' })).status).toBe(200)
    })

    it('only billing managers write; everyone with billing.view reads', async () => {
      expect((await post(plansPost, lead, { op: 'upsert', plan })).status).toBe(403)
      expect((await call(plansGet, as(lead))).status).toBe(200)
      expect((await call(plansGet, as(viewer))).status).toBe(403)
    })
  })

  describe('loyalty', () => {
    const tier = (k: string, min: number, status = 'active') => ({ key: k, name: k, minPoints: min, status, perks: ['x'] })

    it('manages tiers and recomputes a member’s tier from lifetime points', async () => {
      for (const [k, m] of [['bronze', 0], ['silver', 500], ['gold', 2000]] as const) expect((await post(loyaltyPost, admin, { op: 'upsert_tier', tier: tier(k, m) })).status).toBe(200)
      await post(loyaltyPost, admin, { op: 'upsert_tier', tier: tier('platinum', 9000, 'draft') })
      const give = (delta: number, reason = 'campaign') => post(loyaltyPost, admin, { op: 'adjust_points', userId: u.id, delta, reason })
      expect((await give(600)).body).toMatchObject({ balance: 600, tier: 'silver' })
      expect((await give(-100)).body).toMatchObject({ balance: 500, tier: 'silver' }) // spending points never lowers lifetime tier
      expect((await give(2000)).body).toMatchObject({ balance: 2500, tier: 'gold' })
      expect((await give(9999)).body.tier).toBe('gold') // draft tiers are not awarded
      const [acc] = await q<{ points_balance: number; lifetime_points: number }>(`select * from loyalty_accounts`)
      expect(acc).toMatchObject({ points_balance: 12499, lifetime_points: 12599 })
      expect(await q(`select 1 from loyalty_ledger where user_id=$1`, [u.id])).toHaveLength(4)
    })

    it('rejects bad adjustments', async () => {
      await post(loyaltyPost, admin, { op: 'upsert_tier', tier: tier('bronze', 0) })
      const give = (body: Record<string, unknown>) => post(loyaltyPost, admin, { op: 'adjust_points', userId: u.id, reason: 'r', ...body })
      expect((await give({ delta: 0 })).status).toBe(400)
      expect((await give({ delta: 5_000_000 })).status).toBe(400)
      expect((await give({ delta: 'abc' })).status).toBe(400)
      expect((await give({ delta: 5, reason: ' ' })).status).toBe(400)
      expect((await give({ delta: 5, userId: 'bad' })).status).toBe(400)
      expect((await give({ delta: -5 })).status).toBe(400) // would go below zero
      expect(await q(`select 1 from loyalty_accounts`)).toHaveLength(0)
    })

    it('honours a locked tier', async () => {
      await post(loyaltyPost, admin, { op: 'upsert_tier', tier: tier('bronze', 0) })
      await post(loyaltyPost, admin, { op: 'upsert_tier', tier: tier('vip', 99999) })
      await q(`insert into loyalty_accounts (user_id, tier_key, tier_locked) values ($1,'vip',true)`, [u.id])
      expect((await post(loyaltyPost, admin, { op: 'adjust_points', userId: u.id, delta: 10, reason: 'r' })).body.tier).toBe('vip')
    })

    it('refuses to delete a tier with members and summarises the program', async () => {
      await post(loyaltyPost, admin, { op: 'upsert_tier', tier: tier('bronze', 0) })
      await post(loyaltyPost, admin, { op: 'adjust_points', userId: u.id, delta: 5, reason: 'r' })
      expect((await post(loyaltyPost, admin, { op: 'delete_tier', key: 'bronze' })).status).toBe(400)
      const r = await call(loyaltyGet, as(admin))
      expect(r.body).toMatchObject({ members: 1, outstandingPoints: 5, programLive: false })
      expect(r.body.byTier.bronze).toBe(1)
      expect((await post(loyaltyPost, admin, { op: 'upsert_tier', tier: { key: 'BAD KEY', name: 'x' } })).status).toBe(400)
    })

    it('is read-only for finance (view) and closed to viewers', async () => {
      expect((await post(loyaltyPost, finance, { op: 'upsert_tier', tier: tier('x1', 1) })).status).toBe(403)
      expect((await call(loyaltyGet, as(finance))).status).toBe(200)
      expect((await call(loyaltyGet, as(viewer))).status).toBe(403)
    })
  })

  describe('feature flags', () => {
    it('creates, toggles, clamps rollout and filters platforms', async () => {
      const flag = { key: 'premium.reports', description: 'd', enabled: true, rolloutPct: 250, planKeys: ['free'], platforms: ['ios', 'toaster'] }
      expect((await post(flagsPost, admin, { op: 'upsert', flag })).status).toBe(200)
      expect((await q(`select enabled, rollout_pct, platforms, plan_keys, updated_by from feature_flags`))[0]).toMatchObject({ enabled: true, rollout_pct: 100, platforms: ['ios'], plan_keys: ['free'], updated_by: admin.staffId })
      await post(flagsPost, admin, { op: 'upsert', flag: { ...flag, enabled: false, rolloutPct: -4 } })
      expect((await q(`select enabled, rollout_pct from feature_flags`))[0]).toMatchObject({ enabled: false, rollout_pct: 0 })
      expect((await call(flagsGet, as(admin))).body.flags).toHaveLength(1)
      expect((await post(flagsPost, admin, { op: 'upsert', flag: { key: 'Bad Key!' } })).status).toBe(400)
      expect((await post(flagsPost, admin, { op: 'delete', key: 'premium.reports' })).status).toBe(200)
      expect(await q(`select 1 from feature_flags`)).toHaveLength(0)
    })

    it('records before/after in the audit trail and closes writes to read-only roles', async () => {
      await post(flagsPost, admin, { op: 'upsert', flag: { key: 'a.b', enabled: true } })
      await post(flagsPost, admin, { op: 'upsert', flag: { key: 'a.b', enabled: false } })
      const rows = await q<{ summary: string; metadata: { before: { enabled: boolean } | null } }>(`select summary, metadata from admin_audit_log where action='flags.upsert' order by id`)
      expect(rows[0]!.summary).toContain('Created')
      expect(rows[1]!.metadata.before).toMatchObject({ enabled: true })
      expect((await post(flagsPost, lead, { op: 'upsert', flag: { key: 'x.y' } })).status).toBe(403)
    })
  })

  describe('platform', () => {
    it('reports service connectivity without ever exposing a secret', async () => {
      process.env.GEMINI_API_KEY = 'AIza-super-secret-value'
      process.env.SUPABASE_SECRET_KEY = 'sb_secret_value'
      const r = await call(platformGet, as(admin))
      expect(r.status).toBe(200)
      expect(JSON.stringify(r.body)).not.toContain('super-secret')
      expect(JSON.stringify(r.body)).not.toContain('sb_secret_value')
      expect(r.body.services.find((s: { name: string }) => s.name.startsWith('Gemini')).ok).toBe(true)
      delete process.env.GEMINI_API_KEY
    })

    it('stores validated settings and rejects unknown keys and malformed versions', async () => {
      const set = (key: string, value: Record<string, unknown>) => post(platformPost, admin, { op: 'set_setting', key, value })
      expect((await set('maintenance', { enabled: true, message: ' Back soon '.padEnd(500, '!') })).status).toBe(200)
      const [m] = await q<{ value: { enabled: boolean; message: string } }>(`select value from platform_settings where key='maintenance'`)
      expect(m!.value.enabled).toBe(true)
      expect(m!.value.message.length).toBeLessThanOrEqual(300)
      expect((await set('announcement', { enabled: true, text: 'Hi', tone: 'evil' })).status).toBe(200)
      expect((await q<{ value: { tone: string } }>(`select value from platform_settings where key='announcement'`))[0]!.value.tone).toBe('info')
      expect((await set('min_app_version', { ios: '1.2.3', android: '' })).status).toBe(200)
      expect((await set('min_app_version', { ios: '1.2.x' })).status).toBe(400)
      expect((await set('secret_backdoor', { enabled: true })).status).toBe(400)
      expect((await post(platformPost, admin, { op: 'set_setting', key: 'maintenance' })).status).toBe(400)
    })

    it('updates the AI throttle with validation and permission', async () => {
      const patch = (aiRuntime: unknown, who = admin) => call(platformPatch, { method: 'PATCH', ...as(who), body: { aiRuntime } })
      expect((await patch({ rateLimitingEnabled: true, rateLimitMaxRequests: 30 })).status).toBe(200)
      expect((await patch({ rateLimitMaxRequests: 'lots' })).status).toBe(400)
      expect((await patch({})).status).toBe(400)
      expect((await patch(null)).status).toBe(400)
      expect((await patch({ rateLimitingEnabled: true }, lead)).status).toBe(403)
    })
  })

  describe('SMS pipeline', () => {
    beforeEach(async () => {
      await q(`insert into sms_parse_log (user_id, source, raw_body, status, sender, parsed_ok, failure_code, received_at) values
        ($1,'x','ok 1','confirmed','CIB',true,null, now() - interval '1 hour'),
        ($1,'x','bad','failed','CIB',false,'null_amount', now() - interval '2 hours'),
        ($1,'x','addfail','add_failed','NBE',false,null, now() - interval '3 hours'),
        ($1,'x','stuck','logged','NBE',true,null, now() - interval '10 minutes'),
        ($1,'x','fresh','logged','NBE',true,null, now() - interval '10 seconds'),
        ($1,'x','promo','rejected','AD',false,'not_transaction', now() - interval '4 hours')`, [u.id])
    })

    it('the error queue holds failures and logged-but-never-delivered messages, not fresh or rejected ones', async () => {
      const r = await call(smsLogs, { ...as(lead), query: { queue: 'errors' } })
      expect(r.status).toBe(200)
      expect(r.body.rows.map((x: { raw_body: string }) => x.raw_body).sort()).toEqual(['addfail', 'bad', 'stuck'])
    })

    it('hides raw message bodies from staff without users.pii', async () => {
      const r = await call(smsLogs, { ...as(agent), query: { queue: 'errors' } })
      expect(r.body.rows.length).toBeGreaterThan(0)
      for (const row of r.body.rows) expect(row.raw_body).toBeNull()
    })

    it('filters, paginates by cursor, and joins the user’s email (masked without PII)', async () => {
      const all = await call(smsLogs, { ...as(agent), query: { limit: '2' } })
      expect(all.body.rows).toHaveLength(2)
      expect(all.body.nextCursor).toBeTruthy()
      const next = await call(smsLogs, { ...as(agent), query: { limit: '50', cursor: all.body.nextCursor } })
      expect(next.body.rows.every((x: { received_at: string }) => x.received_at < all.body.nextCursor)).toBe(true)
      expect((await call(smsLogs, { ...as(agent), query: { queue: 'unparsed' } })).body.rows).toHaveLength(2)
      expect((await call(smsLogs, { ...as(agent), query: { sender: 'cib' } })).body.rows).toHaveLength(2)
      expect((await call(smsLogs, { ...as(agent), query: { status: 'rejected' } })).body.rows).toHaveLength(1)
      expect((await call(smsLogs, { ...as(agent), query: { userId: u.id } })).body.rows).toHaveLength(6)
      expect((await call(smsLogs, { ...as(agent), query: { userId: ZERO } })).body.rows).toHaveLength(0)
      expect((await call(smsLogs, { ...as(agent), query: { sender: "x%'--" } })).status).toBe(200)
      expect(all.body.rows[0].email).toContain('***')
      expect((await call(smsLogs, { ...as(lead) })).body.rows[0].email).toBe('sara@example.com')
    })

    it('summarises health over a window', async () => {
      const r = await call(smsHealth, { ...as(agent), query: { days: '7' } })
      expect(r.body.health).toMatchObject({ total: 6, parsed: 3, failed: 2, rejected: 1, users: 1 })
      expect(r.body.health.undelivered).toBe(1)
      expect(r.body.health.failure_codes).toEqual(expect.arrayContaining([{ code: 'null_amount', count: 1 }, { code: 'not_transaction', count: 1 }]))
      expect(r.body.health.top_failing_senders[0]).toMatchObject({ sender: 'CIB' })
      expect((await call(smsHealth, { ...as(agent), query: { days: '9999' } })).status).toBe(200)
    })

    it('templates: list/update/promote/demote/delete with validation, bulk toggle and audit', async () => {
      const [{ id }] = await q<{ id: string }>(`insert into sms_tracking_templates_ai (sender, regex_pattern, template_sample, mapping_rules) values ('CIB','(\\d+)','s','{}') returning id`)
      const tp = (body: Record<string, unknown>, who = admin) => post(smsTemplates, who, body)
      expect((await tp({ op: 'list' }, agent)).body.templates).toHaveLength(1)
      expect((await tp({ op: 'update', id, patch: { regex_pattern: '([' } })).status).toBe(400)
      expect((await tp({ op: 'update', id, patch: {} })).status).toBe(400)
      expect((await tp({ op: 'update', id, patch: { regex_pattern: '(\\d+) EGP', ai_enabled: false } })).status).toBe(200)
      expect((await q(`select regex_pattern, ai_enabled from sms_tracking_templates_ai`))[0]).toMatchObject({ regex_pattern: '(\\d+) EGP', ai_enabled: false })
      expect((await tp({ op: 'promote', id, sender: 'CIB' })).status).toBe(200)
      expect((await q(`select tier, auto_promoted from sms_tracking_templates_ai`))[0]).toMatchObject({ tier: 'curated_db', auto_promoted: false })
      expect((await tp({ op: 'demote', id, sender: 'CIB' })).status).toBe(200)
      expect((await tp({ op: 'bulk_toggle', patch: { ai_enabled: true } })).status).toBe(200)
      expect((await q(`select ai_enabled from sms_tracking_templates_ai`))[0]).toMatchObject({ ai_enabled: true })
      expect((await tp({ op: 'update', id, patch: { ai_enabled: false } }, agent)).status).toBe(403)
      expect((await tp({ op: 'delete', id })).status).toBe(200)
      expect(await q(`select 1 from sms_tracking_templates_ai`)).toHaveLength(0)
      expect((await tp({ op: 'wat' })).status).toBe(400)
      const actions = (await q<{ action: string }>(`select action from admin_audit_log where action like 'sms.%'`)).map((r) => r.action)
      expect(actions).toEqual(expect.arrayContaining(['sms.template_update', 'sms.template_promote', 'sms.template_demote', 'sms.template_bulk_toggle', 'sms.template_delete']))
    })

    it('promotion config: reads, clamps writes and resets', async () => {
      await q(`insert into sms_promotion_config (id, min_match_count, min_unique_users, min_age_days, max_failure_rate, min_avg_confidence) values (1, 50, 3, 7, 0.05, 0.9) on conflict do nothing`)
      const pc = (body: Record<string, unknown>, who = admin) => post(smsPromotion, who, body)
      expect((await pc({ op: 'get' }, agent)).body.config).toMatchObject({ min_match_count: 50 })
      const saved = await pc({ op: 'save', config: { min_match_count: -9, max_failure_rate: 7, min_avg_confidence: -1, min_unique_users: 2.9, evil: 1 } })
      expect(saved.status).toBe(200)
      expect(saved.body.config).toMatchObject({ min_match_count: 1, max_failure_rate: 1, min_avg_confidence: 0, min_unique_users: 2 })
      expect((await pc({ op: 'reset_defaults' })).body.config).toMatchObject({ min_match_count: 50, min_unique_users: 3 })
      expect((await pc({ op: 'save', config: { min_match_count: 5 } }, agent)).status).toBe(403)
      expect((await pc({ op: 'run_auto_promote' })).body).toMatchObject({ ok: true, promoted: 0, eligible: 0 })
    })
  })

  describe('overview & analytics', () => {
    it('aggregates real data into the dashboard payload', async () => {
      const b = await makeUser('bob@example.com')
      await q(`insert into app_analytics_events (user_id, event_type) values ($1,'session_start'), ($2,'session_start'), ($1,'heartbeat')`, [u.id, b.id])
      await q(`insert into expenses (user_id, amount) values ($1,1), ($1,2)`, [u.id])
      await q(`insert into push_tokens (user_id, token, platform) values ($1,'a','ios'), ($2,'b','android'), ($2,'c','android')`, [u.id, b.id])
      await q(`insert into sms_parse_log (user_id, source, raw_body, status, parsed_ok) values ($1,'x','a','confirmed',true), ($1,'x','b','failed',false)`, [u.id])
      await q(`update user_settings set sms_tracking_enabled=true where user_id=$1`, [u.id])
      await post(ticketsPost, agent, { subject: 'Urgent thing', message: 'm', priority: 'urgent' })
      const r = await call(overview, as(admin))
      expect(r.status, JSON.stringify(r.body)).toBe(200)
      const o = r.body.overview
      expect(o).toMatchObject({ users_total: 8, dau: 2, expenses_total: 2, sms_enabled_users: 1, push_devices: 3 })
      expect(o.platforms).toEqual({ ios: 1, android: 1 })
      expect(o.sms_24h).toMatchObject({ total: 2, parsed: 1, failed: 1 })
      expect(o.tickets).toMatchObject({ open: 1, urgent: 1 })
      expect(r.body.signups).toHaveLength(30)
      expect(r.body.signups.reduce((n: number, d: { signups: number }) => n + d.signups, 0)).toBe(8)
      expect(r.body.activity).toHaveLength(30)
      expect(r.body.adoption).toMatchObject({ total_users: 8, expenses: 1, push: 2, sms: 1 })
    })

    it('returns retention cohorts and honours the day window', async () => {
      const r = await call(analytics, { ...as(admin), query: { days: '14' } })
      expect(r.status).toBe(200)
      expect(r.body.signups).toHaveLength(14)
      expect(r.body.retention).toHaveLength(10)
      const thisWeek = r.body.retention[r.body.retention.length - 1]
      expect(thisWeek.size).toBe(7)
      expect((await call(analytics, { ...as(admin), query: { days: '1' } })).body.signups).toHaveLength(7) // minimum 7
      expect((await call(analytics, { ...as(admin), query: { days: '99999' } })).body.signups).toHaveLength(180) // maximum 180
    })
  })

  describe('input hardening', () => {
    it('does not treat inherited object keys as catalog entries', async () => {
      const lim = (k: string) => post(plansPost, finance, { op: 'upsert', plan: { key: 'hz', name: 'H', limits: { [k]: 1 } } })
      for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) expect((await lim(k)).status, k).toBe(400)
      await post(plansPost, finance, { op: 'upsert', plan: { key: 'hz', name: 'H', features: ['constructor', 'toString', 'ai_assistant'] } })
      expect((await q<{ features: string[] }>(`select features from plans where key='hz'`))[0]!.features).toEqual(['ai_assistant'])
      const { POST: userPost } = await import('@/app/api/admin/users/[id]/route')
      expect((await call(userPost, { method: 'POST', ...as(lead), params: { id: u.id }, body: { op: 'set_limits', limits: { constructor: 5 } } })).status).toBe(400)
      await call(userPost, { method: 'POST', ...as(lead), params: { id: u.id }, body: { op: 'set_limits', limits: {}, features: { toString: true, ai_assistant: true } } })
      expect((await q<{ feature_overrides: Record<string, boolean> }>(`select feature_overrides from user_entitlements`))[0]!.feature_overrides).toEqual({ ai_assistant: true })
      const { POST: staffPost } = await import('@/app/api/admin/staff/route')
      const r = await call(staffPost, { method: 'POST', ...as(owner), body: { op: 'invite', email: 'p@x.com', roleKey: 'viewer', extraPermissions: ['toString', 'constructor', 'audit.view'] } })
      expect(r.status).toBe(200)
      expect((await q<{ extra_permissions: string[] }>(`select extra_permissions from admin_staff where email='p@x.com'`))[0]!.extra_permissions).toEqual(['audit.view'])
    })

    it('answers nonsense paging parameters with a normal page, never a 500', async () => {
      await q(`insert into sms_parse_log (user_id, source, raw_body, status) values ($1,'x','b','failed')`, [u.id])
      for (const query of [{ limit: '-1' }, { limit: '0' }, { limit: 'abc' }, { limit: '1e9' }, { cursor: 'not-a-date' }, { cursor: "'; select 1;--" }] as Record<string, string>[]) {
        const r = await call(smsLogs, { ...as(agent), query })
        expect(r.status, JSON.stringify(query)).toBe(200)
      }
      for (const query of [{ limit: '-1' }, { cursor: 'abc' }, { cursor: '-5' }, { cursor: '1e99' }] as Record<string, string>[]) {
        expect((await call(auditGet, { ...as(owner), query })).status, JSON.stringify(query)).toBe(200)
      }
      const { GET: usersList } = await import('@/app/api/admin/users/route')
      for (const query of [{ limit: '-1' }, { offset: '-9' }, { limit: 'x', offset: 'y' }] as Record<string, string>[]) {
        expect((await call(usersList, { ...as(admin), query })).status, JSON.stringify(query)).toBe(200)
      }
    })

    it('rejects invalid enum values with a 400 instead of surfacing a database error', async () => {
      expect((await post(plansPost, finance, { op: 'upsert', plan: { key: 'st', name: 'S', status: 'live' } })).status).toBe(400)
      expect((await post(loyaltyPost, admin, { op: 'upsert_tier', tier: { key: 'st', name: 'S', status: 'live' } })).status).toBe(400)
    })

    it('stores plan limits as whole numbers so SQL and TypeScript resolve them identically', async () => {
      expect((await post(plansPost, finance, { op: 'upsert', plan: { key: 'frac', name: 'F', limits: { ai_units_5h: 1000.9 } } })).status).toBe(200)
      expect((await q<{ v: number }>(`select (limits->>'ai_units_5h')::numeric v from plans where key='frac'`))[0]!.v).toBe(1000)
    })

    it('refuses an oversized SMS regex', async () => {
      const [{ id }] = await q<{ id: string }>(`insert into sms_tracking_templates_ai (sender, regex_pattern, template_sample, mapping_rules) values ('CIB','a','s','{}') returning id`)
      expect((await post(smsTemplates, admin, { op: 'update', id, patch: { regex_pattern: 'a'.repeat(2001) } })).status).toBe(400)
    })
  })

  describe('audit log', () => {
    it('lists newest first with filters and cursor, and is append-only', async () => {
      for (let i = 0; i < 5; i++) await post(flagsPost, admin, { op: 'upsert', flag: { key: `f.${i}` } })
      await post(plansPost, finance, { op: 'upsert', plan: { key: 'zz', name: 'Z' } })
      const page = await call(auditGet, { ...as(owner), query: { limit: '3' } })
      expect(page.body.rows).toHaveLength(3)
      const ids = page.body.rows.map((r: { id: number }) => r.id)
      expect([...ids].sort((a, b) => b - a)).toEqual(ids)
      const next = await call(auditGet, { ...as(owner), query: { limit: '50', cursor: String(page.body.nextCursor) } })
      expect(next.body.rows.every((r: { id: number }) => r.id < page.body.nextCursor)).toBe(true)
      expect((await call(auditGet, { ...as(owner), query: { action: 'flags.' } })).body.rows.length).toBe(5)
      expect((await call(auditGet, { ...as(owner), query: { actor: 'FIN@' } })).body.rows.length).toBeGreaterThan(0)
      expect((await call(auditGet, { ...as(owner), query: { action: "x%'" } })).status).toBe(200)
      await expect(q(`update admin_audit_log set action='x'`)).rejects.toThrow(/append-only/)
      await expect(q(`delete from admin_audit_log`)).rejects.toThrow(/append-only/)
    })
  })
})
