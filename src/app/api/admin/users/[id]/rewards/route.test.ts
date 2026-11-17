import { beforeEach, describe, expect, it, vi } from 'vitest'

const USER = '11111111-1111-4111-8111-111111111111'
const ACTOR = '22222222-2222-4222-8222-222222222222'
const h = vi.hoisted(() => ({ guard: vi.fn(), blocked: vi.fn(), rpc: vi.fn(), from: vi.fn(), admin: {} as Record<string, ReturnType<typeof vi.fn>>, factory: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/admin/guard', async (orig) => ({ ...(await orig<typeof import('@/lib/server/admin/guard')>()), guardAdmin: h.guard }))
vi.mock('@/lib/server/admin/targets', async (orig) => ({ ...(await orig<typeof import('@/lib/server/admin/targets')>()), blockedTarget: h.blocked }))
vi.mock('@/lib/server/rewardsAdmin', () => ({ rewardsAdmin: h.factory }))

import { GET, POST } from './route'

const METHODS = ['grantPro', 'removePro', 'startTrial', 'endTrial', 'bankProDays', 'adjustSparks', 'sparksLedger', 'setTier', 'addFreezes', 'setStreak', 'setFounder', 'removeFounder', 'resetLoyalty', 'referralsFor', 'approveReferral', 'revokeReferral', 'markReferralActivated']
const params = { params: Promise.resolve({ id: USER }) }
const post = (body: unknown) => POST(new Request(`http://x/api/admin/users/${USER}/rewards`, { method: 'POST', body: JSON.stringify(body) }), params)

/** A chainable query builder whose terminal call resolves to `result`. */
function query(result: unknown) {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'or', 'order', 'limit', 'in']) q[m] = vi.fn(() => q)
  q.maybeSingle = vi.fn(() => Promise.resolve(result))
  q.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
  return q
}

function withPermissions(...perms: string[]) {
  h.guard.mockResolvedValue({ ok: true, ctx: { service: { rpc: h.rpc, from: h.from }, user: { id: ACTOR }, permissions: new Set(perms), role: { key: 'admin', rank: 10 } } })
}

beforeEach(() => {
  for (const m of METHODS) h.admin[m] = vi.fn().mockResolvedValue({ status: 'ok' })
  h.factory.mockReset().mockReturnValue(h.admin)
  h.blocked.mockReset().mockResolvedValue(null)
  h.rpc.mockReset().mockResolvedValue({ data: { status: 'ok', removedDays: 7 }, error: null })
  h.from.mockReset().mockImplementation(() => query({ data: { id: 5 }, error: null }))
  withPermissions('*')
})

describe('POST /api/admin/users/[id]/rewards', () => {
  it('stops at the guard, which needs one of the rewards permissions', async () => {
    h.guard.mockResolvedValue({ ok: false, res: new Response(null, { status: 403 }) })
    expect((await post({ op: 'end_trial' })).status).toBe(403)
    expect(h.guard).toHaveBeenCalledWith(expect.anything(), { permission: ['billing.grant', 'sparks.manage', 'loyalty.manage', 'referrals.manage'] })
    expect(h.factory).not.toHaveBeenCalled()
  })

  it.each([
    ['grant_pro', { op: 'grant_pro', endsAt: null }, 'billing.grant'],
    ['adjust_sparks', { op: 'adjust_sparks', amount: 5, bucket: 'reward', reason: 'test' }, 'sparks.manage'],
    ['set_streak', { op: 'set_streak', weeks: 4 }, 'loyalty.manage'],
    ['approve_referral', { op: 'approve_referral', referralId: 5 }, 'referrals.manage'],
  ])('%s needs %s', async (_op, body, needed) => {
    const others = ['billing.grant', 'sparks.manage', 'loyalty.manage', 'referrals.manage'].filter((p) => p !== needed)
    withPermissions(...others)
    expect((await post(body)).status).toBe(403)
    withPermissions(needed)
    expect((await post(body)).status).toBe(200)
  })

  it('refuses bad input before touching the database', async () => {
    for (const body of [
      { op: 'nope' }, { op: 'start_trial', days: 0 }, { op: 'start_trial', days: 91 }, { op: 'bank_days', days: 1.5 },
      { op: 'adjust_sparks', amount: 5, bucket: 'reward', reason: '  ' }, { op: 'adjust_sparks', amount: 0, bucket: 'reward', reason: 'x' },
      { op: 'adjust_sparks', amount: 5, bucket: 'gift', reason: 'x' }, { op: 'grant_pro', endsAt: '2000-01-01T00:00:00Z' },
      { op: 'set_tier', tier: 'DROP', locked: true }, { op: 'set_tier', tier: 'gold' }, { op: 'add_freezes', count: 3 },
      { op: 'set_streak', weeks: -1 }, { op: 'approve_referral', referralId: 'all' },
    ]) expect((await post(body)).status, JSON.stringify(body)).toBe(400)
    for (const m of METHODS) expect(h.admin[m]).not.toHaveBeenCalled()
  })

  it('refuses a staff target the actor does not outrank', async () => {
    h.blocked.mockResolvedValue('That account belongs to staff at or above your level.')
    expect((await post({ op: 'reset_loyalty' })).status).toBe(403)
    expect(h.blocked).toHaveBeenCalledWith(expect.anything(), USER, { allowSelf: true })
    expect(h.admin.resetLoyalty).not.toHaveBeenCalled()
  })

  it('calls the matching wrapper with the actor and parsed values', async () => {
    const ends = new Date(Date.now() + 86_400_000 * 10).toISOString()
    const cases: Array<[unknown, string, unknown[]]> = [
      [{ op: 'grant_pro', endsAt: ends, note: ' tester ' }, 'grantPro', [USER, ends, 'tester']],
      [{ op: 'grant_pro', endsAt: null }, 'grantPro', [USER, null, undefined]],
      [{ op: 'remove_pro', note: 'done' }, 'removePro', [USER, 'done']],
      [{ op: 'start_trial', days: 30 }, 'startTrial', [USER, 30]],
      [{ op: 'end_trial' }, 'endTrial', [USER]],
      [{ op: 'bank_days', days: 7 }, 'bankProDays', [USER, 7]],
      [{ op: 'adjust_sparks', amount: -20, bucket: 'purchased', reason: 'fix' }, 'adjustSparks', [USER, -20, 'purchased', 'fix']],
      [{ op: 'set_tier', tier: 'diamond', locked: true }, 'setTier', [USER, 'diamond', true]],
      [{ op: 'set_tier', tier: null, locked: false }, 'setTier', [USER, null, false]],
      [{ op: 'add_freezes', count: -1 }, 'addFreezes', [USER, -1]],
      [{ op: 'set_streak', weeks: 8 }, 'setStreak', [USER, 8]],
      [{ op: 'set_founder', number: 12 }, 'setFounder', [USER, 12]],
      [{ op: 'set_founder' }, 'setFounder', [USER, null]],
      [{ op: 'remove_founder' }, 'removeFounder', [USER]],
      [{ op: 'reset_loyalty' }, 'resetLoyalty', [USER]],
      [{ op: 'approve_referral', referralId: 5 }, 'approveReferral', [5]],
      [{ op: 'revoke_referral', referralId: 5 }, 'revokeReferral', [5]],
      [{ op: 'mark_referral_activated', referralId: 5 }, 'markReferralActivated', [5]],
    ]
    for (const [body, method, args] of cases) {
      h.admin[method]!.mockClear()
      expect((await post(body)).status, JSON.stringify(body)).toBe(200)
      expect(h.admin[method]).toHaveBeenCalledWith(...args)
    }
    expect(h.factory).toHaveBeenCalledWith(expect.anything(), ACTOR)
  })

  it('removes banked days through its audited SQL function', async () => {
    const res = await post({ op: 'unbank_days' })
    expect(res.status).toBe(200)
    expect(h.rpc).toHaveBeenCalledWith('admin_rewards_unbank_pro_days', { p_actor: ACTOR, p_user: USER })
  })

  it('only acts on an invite that belongs to this user', async () => {
    h.from.mockImplementation(() => query({ data: null, error: null }))
    expect((await post({ op: 'revoke_referral', referralId: 9 })).status).toBe(404)
    expect(h.admin.revokeReferral).not.toHaveBeenCalled()
  })

  it('answers a refusal with 409, an invite outcome with 200 and a database error with 500', async () => {
    h.admin.endTrial!.mockResolvedValueOnce({ status: 'not_trialing' })
    const refused = await post({ op: 'end_trial' })
    expect(refused.status).toBe(409)
    expect((await refused.json()).error).toMatch(/not on a trial/)
    h.admin.approveReferral!.mockResolvedValueOnce({ status: 'rewarded' })
    expect(await (await post({ op: 'approve_referral', referralId: 5 })).json()).toEqual({ ok: true, outcome: 'rewarded' })
    h.admin.markReferralActivated!.mockResolvedValueOnce({ status: 'not_pending' })
    expect((await post({ op: 'mark_referral_activated', referralId: 5 })).status).toBe(409)
    h.admin.resetLoyalty!.mockResolvedValueOnce({ status: 'error', message: 'boom' })
    expect((await post({ op: 'reset_loyalty' })).status).toBe(500)
  })
})

describe('GET /api/admin/users/[id]/rewards', () => {
  const get = () => GET(new Request(`http://x/api/admin/users/${USER}/rewards`), params)
  beforeEach(() => {
    h.from.mockImplementation((table: string) => query(table === 'pro_promo_grants' ? { data: [{ days: 7 }, { days: 3 }], error: null } : table === 'loyalty_tiers' ? { data: [], error: null } : { data: null, error: null }))
  })

  it('sums the banked Pro days that have not started', async () => {
    withPermissions('loyalty.view')
    expect((await (await get()).json()).bankedProDays).toBe(10)
  })

  it('loads Sparks and invites only for the staff who manage them', async () => {
    withPermissions('billing.view')
    const res = await get()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sparks).toBeNull()
    expect(body.referrals).toBeNull()
    expect(h.admin.sparksLedger).not.toHaveBeenCalled()
    expect(h.admin.referralsFor).not.toHaveBeenCalled()
  })

  it('returns Sparks by bucket when allowed', async () => {
    withPermissions('sparks.manage', 'referrals.manage')
    const now = Date.now()
    h.admin.sparksLedger!.mockResolvedValue({
      available: 30,
      allowances: [{ id: 'a', kind: 'reward', granted: 25, used: 5, period_start: new Date(now - 1000).toISOString(), period_end: new Date(now + 1e9).toISOString() }],
      purchases: [{ id: 'p', remaining: 10, refunded_at: null }],
      spend: [],
    })
    h.admin.referralsFor!.mockResolvedValue({ code: null, invites: [], invitedBy: null })
    const body = await (await get()).json()
    expect(body.sparks.buckets).toEqual({ reward: 20, purchased: 10 })
    expect(body.referrals).toEqual({ code: null, invites: [], invitedBy: null })
    expect(h.admin.sparksLedger).toHaveBeenCalledWith(USER, 20)
  })

  it('needs a rewards read permission', async () => {
    h.guard.mockResolvedValue({ ok: false, res: new Response(null, { status: 403 }) })
    expect((await get()).status).toBe(403)
    expect(h.guard).toHaveBeenCalledWith(expect.anything(), { permission: expect.arrayContaining(['billing.view', 'loyalty.view', 'sparks.manage', 'referrals.manage']) })
  })
})
