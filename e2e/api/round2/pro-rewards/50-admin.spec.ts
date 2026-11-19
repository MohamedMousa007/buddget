// Admin data layer (admin_rewards_*), exercised with the service role because an admin portal session cannot be made here.
// The actor is a temporary staff row on a synthetic user (deleted at the end). Never calls admin_rewards_platform_switch with a
// real key: the switches stay as they are on live.
import { expect, test } from '@playwright/test'
import { account, dropUser, freeFounderNumber, makeStaff, makeUser, mask, rewardSparks, svc, svcRpc, type QaUser } from './lib'

let staff: QaUser, T: QaUser, nobody: QaUser
test.beforeAll(async () => { staff = await makeUser('adm-staff'); await makeStaff(staff); T = await makeUser('adm-target'); nobody = await makeUser('adm-nobody') })
test.afterAll(async () => {
  for (const u of [staff, T, nobody]) if (u) await svc(`admin_audit_log?actor_id=eq.${u.id}`, { method: 'DELETE' })
  for (const u of [T, nobody, staff]) if (u) await dropUser(u)
})
const adm = (fn: string, body: Record<string, unknown>) => svcRpc(fn, { p_actor: staff.id, ...body })

test('D1 a non-staff actor is refused by every audited write', async () => {
  const calls: Array<[string, Record<string, unknown>]> = [['admin_rewards_sparks_adjust', { p_user: T.id, p_amount: 10, p_bucket: 'reward', p_reason: 'qa' }],
    ['admin_rewards_pro_grant', { p_user: T.id }], ['admin_rewards_set_tier', { p_user: T.id, p_tier: 'elite', p_locked: true }], ['admin_rewards_founder_set', { p_user: T.id, p_number: 100 }],
    ['admin_rewards_bank_pro_days', { p_user: T.id, p_days: 7 }], ['admin_rewards_loyalty_reset', { p_user: T.id }], ['admin_rewards_platform_switch', { p_key: 'billing', p_enabled: true }]]
  for (const [fn, body] of calls) {
    const r = await svcRpc(fn, { p_actor: nobody.id, ...body })
    expect.soft(r.status, `${fn} ${mask(r.text)}`).toBeGreaterThanOrEqual(400)
    expect.soft(r.text, fn).toContain('not_staff')
  }
  expect((await rewardSparks(T.id)).length).toBe(0)
  expect((await svc(`user_entitlements?user_id=eq.${T.id}&select=plan_key`)).json[0]?.plan_key ?? 'free').toBe('free')
})

test('D2 Sparks adjust: bad input is invalid; add 50 reward, remove 30 (reward first), removing more than held never goes negative', async () => {
  for (const body of [{ p_amount: 0 }, { p_amount: null }, { p_amount: 100001 }, { p_amount: -100001 }, { p_bucket: 'gift' }, { p_reason: '  ' }]) {
    const r = await adm('admin_rewards_sparks_adjust', { p_user: T.id, p_amount: 10, p_bucket: 'reward', p_reason: 'qa', ...body })
    expect.soft(r.json?.status, JSON.stringify(body)).toBe('invalid')
  }
  const nan = await adm('admin_rewards_sparks_adjust', { p_user: T.id, p_amount: 'NaN', p_bucket: 'reward', p_reason: 'qa' })
  expect(nan.status).toBeGreaterThanOrEqual(400)
  expect((await adm('admin_rewards_sparks_adjust', { p_user: T.id, p_amount: 50, p_bucket: 'reward', p_reason: 'qa' })).json).toMatchObject({ status: 'ok' })
  expect((await adm('admin_rewards_sparks_adjust', { p_user: T.id, p_amount: 20, p_bucket: 'purchased', p_reason: 'qa' })).json.status).toBe('ok')
  const r = await adm('admin_rewards_sparks_adjust', { p_user: T.id, p_amount: -30, p_bucket: 'reward', p_reason: 'qa' })
  const reward = (await rewardSparks(T.id)).reduce((a, x) => a + x.granted, 0)
  const bought = (await svc(`spark_purchases?user_id=eq.${T.id}&select=remaining`)).json[0].remaining
  expect([reward, bought]).toEqual([20, 20])
  const over = await adm('admin_rewards_sparks_adjust', { p_user: T.id, p_amount: -5000, p_bucket: 'reward', p_reason: 'qa' })
  expect(over.json.status).toBe('ok')
  const av = (await svcRpc('admin_rewards_sparks_ledger', { p_user: T.id })).json.available
  expect(JSON.stringify(av)).not.toContain('-')
  expect(r.json.status).toBe('ok')
})

test('D3 tier: unknown tier refused; a lock pins it (even Elite without Pro); unlock recomputes from points', async () => {
  expect((await adm('admin_rewards_set_tier', { p_user: T.id, p_tier: 'platinum', p_locked: true })).json.status).toBe('unknown_tier')
  expect((await adm('admin_rewards_set_tier', { p_user: T.id, p_tier: 'diamond', p_locked: true })).json).toEqual({ status: 'ok', tier: 'diamond' })
  await svcRpc('loyalty_award', { p_user: T.id, p_points: 10, p_reason: 'qa', p_ref: 'd3' })
  expect((await account(T.id)).tier_key).toBe('diamond')
  expect((await adm('admin_rewards_set_tier', { p_user: T.id, p_tier: null, p_locked: false })).json.tier).toBe('silver')
})

test('D4 streak and freezes: out-of-range input is invalid; freezes clamp to 0..2', async () => {
  for (const b of [{ p_weeks: -1 }, { p_weeks: 521 }, { p_weeks: 5, p_step: 3 }, { p_weeks: null }]) expect.soft((await adm('admin_rewards_set_streak', { p_user: T.id, ...b })).json?.status, JSON.stringify(b)).toBe('invalid')
  expect((await adm('admin_rewards_set_streak', { p_user: T.id, p_weeks: 8 })).json.status).toBe('ok')
  expect((await account(T.id))).toMatchObject({ streak_weeks: 8, multiplier_step: 2 })
  expect((await adm('admin_rewards_add_freezes', { p_user: T.id, p_count: 99 })).json.freezes).toBe(2)
  expect((await adm('admin_rewards_add_freezes', { p_user: T.id, p_count: -99 })).json.freezes).toBe(0)
})

test('D5 founders: a taken number and numbers outside 1..100 are refused; set then remove; a second remove says not_founder', async () => {
  expect((await adm('admin_rewards_founder_set', { p_user: T.id, p_number: 1 })).json.status).toBe('number_taken')
  expect((await adm('admin_rewards_founder_set', { p_user: T.id, p_number: 101 })).json.status).toBe('cap_reached')
  expect((await adm('admin_rewards_founder_set', { p_user: T.id, p_number: 0 })).json.status).toBe('cap_reached')
  const n = await freeFounderNumber()
  expect((await adm('admin_rewards_founder_set', { p_user: T.id, p_number: n })).json).toEqual({ status: 'ok', number: n })
  expect((await adm('admin_rewards_founder_remove', { p_user: T.id })).json.status).toBe('ok')
  expect((await adm('admin_rewards_founder_remove', { p_user: T.id })).json.status).toBe('not_founder')
})

test('D6 Pro tools: bank days outside 1..366 invalid; 10 banked days start now for a Free user; trial length clamps to 1..90', async () => {
  for (const d of [0, -3, 367, null]) expect.soft((await adm('admin_rewards_bank_pro_days', { p_user: T.id, p_days: d })).json?.status, String(d)).toBe('invalid')
  expect((await adm('admin_rewards_bank_pro_days', { p_user: T.id, p_days: 10 })).json).toEqual({ status: 'ok', startedDays: 10 })
  const e = (await svc(`user_entitlements?user_id=eq.${T.id}&select=plan_key,source,current_period_end`)).json[0]
  expect(e.source).toBe('promo')
  expect(Math.round((Date.parse(e.current_period_end) - Date.now()) / 86_400_000)).toBe(10)
  const t = await adm('admin_rewards_trial_start', { p_user: nobody.id, p_days: 1000 })
  expect(Math.round((Date.parse(t.json.trialEndsAt) - Date.now()) / 86_400_000)).toBe(90)
  expect((await adm('admin_rewards_trial_end', { p_user: nobody.id })).json.status).toBe('ok')
  expect((await adm('admin_rewards_trial_end', { p_user: nobody.id })).json.status).toBe('not_trialing')
})

test('D7 platform switch: an unknown key or a null value is refused and nothing is written', async () => {
  const before = (await svc('platform_settings?key=in.(billing,tiers,referrals,spark_gifts)&select=key,value')).json
  expect((await adm('admin_rewards_platform_switch', { p_key: 'everything', p_enabled: false })).json.status).toBe('invalid')
  expect((await adm('admin_rewards_platform_switch', { p_key: 'billing', p_enabled: null })).json.status).toBe('invalid')
  expect((await svc('platform_settings?key=in.(billing,tiers,referrals,spark_gifts)&select=key,value')).json).toEqual(before)
})

test('D8 every write is audit-logged with the staff actor', async () => {
  const rows = (await svc(`admin_audit_log?actor_id=eq.${staff.id}&select=action&limit=100`)).json as Array<{ action: string }>
  const acts = new Set(rows.map((r) => r.action))
  for (const a of ['sparks.adjust', 'loyalty.set_tier', 'loyalty.set_streak', 'loyalty.add_freezes', 'loyalty.founder_set', 'loyalty.founder_remove', 'billing.bank_pro_days', 'billing.start_trial', 'billing.end_trial']) expect.soft(acts.has(a), a).toBe(true)
  expect(acts.has('platform.switch')).toBe(false)
})

test('D9 loyalty reset clears points, streak, tier and owned items for test data', async () => {
  await svcRpc('loyalty_award', { p_user: T.id, p_points: 400, p_reason: 'qa', p_ref: 'd9' })
  expect((await adm('admin_rewards_loyalty_reset', { p_user: T.id })).json.status).toBe('ok')
  expect(await account(T.id)).toMatchObject({ points_balance: 0, lifetime_points: 0, streak_weeks: 0, tier_key: 'silver', gifted_rank: 0 })
})
