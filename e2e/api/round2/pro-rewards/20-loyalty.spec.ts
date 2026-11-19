// Loyalty: the weekly check (3 records, unconfirmed items, window), the streak multiplier and a miss, freezes, tiers by lifetime
// points with the Pro gate and the founder tier, Spark gifts once (also under parallel calls), the points shop and cosmetics.
// Expected values come from docs/launch/PRO_REWARDS_SPEC.md (which overrides the build plan); the plan's own numbers are pinned
// in P1 as a known conflict (S8G-01).
import { expect, test } from '@playwright/test'
import { account, freeFounderNumber, addDays, addExpenses, dropUser, FREE, makeUser, mask, PRO_ACTIVE, PRO_LAPSED, rewardSparks, rpc, setEntitlement, setLoyalty, svc, svcRpc, TRIAL, weekStarts, type QaUser } from './lib'

const made: QaUser[] = []
const user = async (tag: string) => { const u = await makeUser(tag); made.push(u); return u }
test.afterAll(async () => { for (const u of made) await dropUser(u) })

const award = (u: QaUser, points: number, ref: string, reason = 'qa_award') => svcRpc('loyalty_award', { p_user: u.id, p_points: points, p_reason: reason, p_ref: ref })
const check = (u: QaUser, week: string) => rpc(u.token, 'loyalty_record_week_check', { p_week: week })

test.describe('weekly check', () => {
  test('W1 two records do not keep the week; the third does (+10, streak 1, x1)', async () => {
    const u = await user('w1')
    const w = await weekStarts(u.token)
    await addExpenses(u, w.thisWeek, 2)
    const few = await check(u, w.thisWeek)
    expect(few.json).toMatchObject({ status: 'too_few_records', records: 2, needed: 3 })
    await addExpenses(u, addDays(w.thisWeek, 1), 1)
    const kept = await check(u, w.thisWeek)
    expect(kept.json).toMatchObject({ status: 'kept', streak: 1, points: 10, multiplier: 1 })
    expect(await account(u.id)).toMatchObject({ points_balance: 10, lifetime_points: 10, streak_weeks: 1 })
  })

  test('W2 double tap: 6 parallel checks of the same week pay once', async () => {
    const u = await user('w2')
    const w = await weekStarts(u.token)
    await addExpenses(u, w.thisWeek, 3)
    const all = await Promise.all(Array.from({ length: 6 }, () => check(u, w.thisWeek)))
    const kept = all.filter((r) => r.json?.status === 'kept').length
    expect(kept, all.map((r) => r.json?.status ?? r.status).join(',')).toBe(1)
    expect((await account(u.id)).lifetime_points).toBe(10)
    expect((await check(u, w.thisWeek)).json.status).toBe('already_kept')
  })

  test('W3 an SMS still waiting for review blocks the week', async () => {
    const u = await user('w3')
    const w = await weekStarts(u.token)
    await addExpenses(u, w.thisWeek, 3)
    const ins = await svc('sms_parse_log', { method: 'POST', body: JSON.stringify({ user_id: u.id, source: 'manual', status: 'rendered', parse_method: 'static', payment_instrument: 'account', awaiting_confirmation: true, received_at: new Date().toISOString() }) })
    expect(ins.status, mask(ins.text)).toBeLessThan(300)
    expect((await check(u, w.thisWeek)).json.status).toBe('unconfirmed_items')
  })

  test('W4 window: two weeks ago, a future week and a non-date are refused', async () => {
    const u = await user('w4')
    const w = await weekStarts(u.token)
    expect((await check(u, addDays(w.thisWeek, -14))).json.status).toBe('out_of_window')
    expect((await check(u, addDays(w.thisWeek, 7))).json.status).toBe('out_of_window')
    expect((await check(u, addDays(w.thisWeek, 1))).json.status).toBe('out_of_window')
    expect((await check(u, 'NaN')).json.status).toBe('invalid_week')
    expect((await check(u, "2026-11-15'; drop table x;--")).json.status).toBe('invalid_week')
  })

  test('W5 multiplier: week 4 pays x1.5 (15), week 8 pays x2 (20)', async () => {
    const u = await user('w5')
    const w = await weekStarts(u.token)
    await setLoyalty(u.id, { streak_weeks: 3, multiplier_step: 0, last_kept_week: w.lastWeek, kept_weeks_total: 3 })
    await addExpenses(u, w.thisWeek, 3)
    expect((await check(u, w.thisWeek)).json).toMatchObject({ status: 'kept', streak: 4, multiplier: 1.5, points: 15 })
    const v = await user('w5b')
    await setLoyalty(v.id, { streak_weeks: 7, multiplier_step: 1, last_kept_week: w.lastWeek, kept_weeks_total: 7 })
    await addExpenses(v, w.thisWeek, 3)
    expect((await check(v, w.thisWeek)).json).toMatchObject({ status: 'kept', streak: 8, multiplier: 2, points: 20 })
  })

  test('W6 one missed week without a freeze drops one step (x2 to x1.5), streak restarts at 1', async () => {
    const u = await user('w6')
    const w = await weekStarts(u.token)
    // Last kept two weeks before this one: last week is the miss (this test runs outside the 3-day grace or with last week closed).
    await setLoyalty(u.id, { streak_weeks: 10, multiplier_step: 2, last_kept_week: addDays(w.thisWeek, -14), kept_weeks_total: 10, freezes_banked: 0 })
    await addExpenses(u, w.thisWeek, 3)
    const r = await check(u, w.thisWeek)
    expect(r.json).toMatchObject({ status: 'kept', streak: 1, multiplier: 1.5, points: 15 })
    expect((await account(u.id)).multiplier_step).toBe(1)
  })

  test('W7 a banked freeze covers the miss: the streak and x2 carry on, the freeze is spent', async () => {
    const u = await user('w7')
    const w = await weekStarts(u.token)
    await setLoyalty(u.id, { streak_weeks: 10, multiplier_step: 2, last_kept_week: addDays(w.thisWeek, -14), kept_weeks_total: 10, freezes_banked: 1 })
    await addExpenses(u, w.thisWeek, 3)
    expect((await check(u, w.thisWeek)).json).toMatchObject({ status: 'kept', streak: 11, multiplier: 2, points: 20, freezes: 0 })
  })

  test('W8 freezes: one per 8 kept weeks for Silver, one per 4 from Emerald, never more than 2', async () => {
    const s = await user('w8s')
    const w = await weekStarts(s.token)
    await setLoyalty(s.id, { streak_weeks: 3, last_kept_week: w.lastWeek, kept_weeks_total: 3, tier_key: 'silver' })
    await addExpenses(s, w.thisWeek, 3)
    expect((await check(s, w.thisWeek)).json.freezes).toBe(0)
    const e = await user('w8e')
    await setLoyalty(e.id, { streak_weeks: 3, last_kept_week: w.lastWeek, kept_weeks_total: 3, tier_key: 'emerald', lifetime_points: 300, gifted_rank: 1 })
    await addExpenses(e, w.thisWeek, 3)
    expect((await check(e, w.thisWeek)).json.freezes).toBe(1)
    const f = await user('w8f')
    await setLoyalty(f.id, { streak_weeks: 7, last_kept_week: w.lastWeek, kept_weeks_total: 7, freezes_banked: 2, multiplier_step: 1 })
    await addExpenses(f, w.thisWeek, 3)
    expect((await check(f, w.thisWeek)).json.freezes).toBe(2)
  })

  test('W9 streak gift at 12 weeks: 10 reward Sparks once (spec); none at 4 weeks', async () => {
    const u = await user('w9')
    const w = await weekStarts(u.token)
    await setLoyalty(u.id, { streak_weeks: 11, multiplier_step: 2, last_kept_week: w.lastWeek, kept_weeks_total: 11 })
    await addExpenses(u, w.thisWeek, 3)
    expect((await check(u, w.thisWeek)).json).toMatchObject({ status: 'kept', streak: 12, sparksGift: 10 })
    expect((await rewardSparks(u.id)).filter((x) => x.ref === 'streak:12').map((x) => x.granted)).toEqual([10])
    const v = await user('w9b')
    await setLoyalty(v.id, { streak_weeks: 3, last_kept_week: w.lastWeek, kept_weeks_total: 3 })
    await addExpenses(v, w.thisWeek, 3)
    expect((await check(v, w.thisWeek)).json.sparksGift).toBe(0)
  })
})

test.describe('tiers and gifts', () => {
  test('T1 thresholds: 299 Silver, 300 Emerald (+10 once), 800 Diamond (+20), 1,500 without Pro stays Diamond', async () => {
    const u = await user('t1')
    await award(u, 299, 'a')
    expect((await account(u.id)).tier_key).toBe('silver')
    await award(u, 1, 'b')
    expect((await account(u.id)).tier_key).toBe('emerald')
    await award(u, 500, 'c')
    expect((await account(u.id)).tier_key).toBe('diamond')
    await award(u, 700, 'd')
    expect((await account(u.id)).tier_key).toBe('diamond')
    const gifts = Object.fromEntries((await rewardSparks(u.id)).map((x) => [x.ref, x.granted]))
    expect(gifts).toEqual({ 'tier:emerald': 10, 'tier:diamond': 20 })
  })

  test('T2 Elite needs active Pro: Pro on -> Elite (+30 once); Pro lapses -> Diamond; Pro back -> Elite, no second gift', async () => {
    const u = await user('t2')
    await award(u, 1500, 'a')
    await setEntitlement(u.id, PRO_ACTIVE())
    expect((await account(u.id)).tier_key).toBe('elite')
    await setEntitlement(u.id, PRO_LAPSED())
    expect((await account(u.id)).tier_key).toBe('diamond')
    await setEntitlement(u.id, PRO_ACTIVE())
    expect((await account(u.id)).tier_key).toBe('elite')
    expect((await rewardSparks(u.id)).filter((x) => x.ref === 'tier:elite').length).toBe(1)
    const me = await svcRpc('entitlements_state', { p_user: u.id })
    expect(me.json.rewards.points.lifetime).toBe(1500)
  })

  test('T3 the trial counts as Pro for Elite (spec); Free does not', async () => {
    const u = await user('t3')
    await award(u, 1500, 'a')
    await setEntitlement(u.id, TRIAL())
    expect((await account(u.id)).tier_key).toBe('elite')
    await setEntitlement(u.id, FREE())
    expect((await account(u.id)).tier_key).toBe('diamond')
  })

  test('T4 Elite Founder: founder + 1,500 + Pro; the Elite gift is paid once, not twice', async () => {
    const u = await user('t4')
    const num = await freeFounderNumber()
    const f = await svc('founders', { method: 'POST', body: JSON.stringify({ number: num, user_id: u.id, cohort: 'public', qualified_at: new Date().toISOString() }) })
    expect(f.status, mask(f.text)).toBeLessThan(300)
    await award(u, 1500, 'a')
    expect((await account(u.id)).tier_key).toBe('diamond')
    await setEntitlement(u.id, PRO_ACTIVE())
    expect((await account(u.id)).tier_key).toBe('founder')
    const gifts = (await rewardSparks(u.id)).map((x) => x.ref).sort()
    expect(gifts).toEqual(['tier:diamond', 'tier:elite', 'tier:emerald'])
  })

  test('T5 a missed week or spending points never lowers the tier', async () => {
    const u = await user('t5')
    await award(u, 380, 'a')
    const w = await weekStarts(u.token)
    await setLoyalty(u.id, { streak_weeks: 5, last_kept_week: addDays(w.thisWeek, -28), multiplier_step: 1 })
    const buy = await rpc(u.token, 'loyalty_shop_buy', { p_item: 'streak_freeze' })
    expect(buy.json.status).toBe('ok')
    expect(await account(u.id)).toMatchObject({ tier_key: 'emerald', points_balance: 300, lifetime_points: 380 })
  })

  test('T6 parallel: 6 refreshes at the threshold pay the Emerald gift once; 6 identical awards pay once', async () => {
    const u = await user('t6')
    await setLoyalty(u.id, { lifetime_points: 300, points_balance: 300, gifted_rank: 0, tier_key: 'silver' })
    await Promise.all(Array.from({ length: 6 }, () => svcRpc('loyalty_refresh_tier', { p_user: u.id })))
    expect((await rewardSparks(u.id)).filter((x) => x.ref === 'tier:emerald').length).toBe(1)
    const v = await user('t6b')
    const res = await Promise.all(Array.from({ length: 6 }, () => award(v, 10, 'same-ref')))
    expect(res.map((r) => r.json).filter((n) => n === 10).length).toBe(1)
    expect((await account(v.id)).lifetime_points).toBe(10)
  })

  test('T7 bad amounts: zero and negative award nothing; an overflow fails without changing the account', async () => {
    const u = await user('t7')
    await award(u, 5, 'base')
    expect((await award(u, 0, 'z')).json).toBe(0)
    expect((await award(u, -50, 'n')).json).toBe(0)
    const big = await award(u, 2147483647, 'big')
    expect(big.status, mask(big.text)).toBeGreaterThanOrEqual(400)
    const nan = await award(u, Number.NaN, 'nan')
    expect(nan.status).toBeGreaterThanOrEqual(400)
    expect((await account(u.id)).lifetime_points).toBe(5)
  })

  test('T8 Spark gifts land in the reward bucket for 12 months (spec) and are spent before bought Sparks', async () => {
    const u = await user('t8')
    await award(u, 300, 'a')
    const g = (await rewardSparks(u.id)).find((x) => x.ref === 'tier:emerald')!
    const days = (Date.parse(g.period_end) - Date.parse(g.period_start)) / 86_400_000
    expect(days).toBeGreaterThan(360)
    await svc('spark_purchases', { method: 'POST', body: JSON.stringify({ user_id: u.id, store: 'admin', store_txn: `qa-s8g-${u.id}`, product_id: 'admin_grant', sparks: 50, remaining: 50 }) })
    const took = await svcRpc('spark_charge', { p_user: u.id, p_sparks: 12, p_reservation: null, p_feature: 'chat' })
    expect(took.json).toBe(12)
    const left = (await svc(`spark_allowances?user_id=eq.${u.id}&kind=eq.reward&select=used`)).json[0].used
    const bought = (await svc(`spark_purchases?user_id=eq.${u.id}&select=remaining`)).json[0].remaining
    expect([left, bought]).toEqual([10, 48])
  })

  test('P1 S8G-01 the build plan\'s numbers (gifts 30/60/150, streak gifts at 4 weeks, 60-day gifts, Free member pack bonus +5/+10%)', async () => {
    test.fail(true, 'S8G-01: code follows PRO_REWARDS_SPEC.md, not PRO_REWARDS_BUILD_PLAN.md; owner to confirm which doc is right')
    const tiers = (await svc('loyalty_tiers?select=key,sparks_gift&status=eq.active')).json as Array<{ key: string; sparks_gift: number }>
    const gift = Object.fromEntries(tiers.map((t) => [t.key, t.sparks_gift]))
    const u = await user('p1')
    await award(u, 800, 'a')
    const bonus = await svcRpc('spark_pack_bonus_percent', { p_user: u.id })
    expect({ emerald: gift.emerald, diamond: gift.diamond, elite: gift.elite, freeDiamondBonus: bonus.json }).toEqual({ emerald: 30, diamond: 60, elite: 150, freeDiamondBonus: 10 })
  })
})

test.describe('points shop and cosmetics', () => {
  test('S1 statuses: unknown item, not enough points, a freeze for 80, freezes full at 2, nothing to repair', async () => {
    const u = await user('s1')
    expect((await rpc(u.token, 'loyalty_shop_buy', { p_item: 'nope' })).json.status).toBe('unknown_item')
    expect((await rpc(u.token, 'loyalty_shop_buy', { p_item: 'streak_freeze' })).json.status).toBe('insufficient_points')
    await award(u, 250, 'a')
    expect((await rpc(u.token, 'loyalty_shop_buy', { p_item: 'streak_freeze' })).json).toMatchObject({ status: 'ok', balance: 170 })
    await setLoyalty(u.id, { freezes_banked: 2 })
    expect((await rpc(u.token, 'loyalty_shop_buy', { p_item: 'streak_freeze' })).json.status).toBe('freezes_full')
    expect((await rpc(u.token, 'loyalty_shop_buy', { p_item: 'repair_week' })).json.status).toBe('nothing_to_repair')
    const a = await account(u.id)
    expect([a.points_balance, a.lifetime_points]).toEqual([170, 250])
    const ledger = (await svc(`loyalty_ledger?user_id=eq.${u.id}&delta=lt.0&select=delta,reason`)).json
    expect(ledger).toEqual([{ delta: -80, reason: 'shop:streak_freeze' }])
  })

  test('S2 double tap: 5 parallel buys with points for one charge only once', async () => {
    const u = await user('s2')
    await award(u, 150, 'a')
    const res = await Promise.all(Array.from({ length: 5 }, () => rpc(u.token, 'loyalty_shop_buy', { p_item: 'card_finish_aurora' })))
    expect(res.filter((r) => r.json?.status === 'ok').length, res.map((r) => r.json?.status).join(',')).toBe(1)
    expect((await account(u.id)).points_balance).toBe(0)
    const v = await user('s2b')
    await award(v, 80, 'a')
    const fr = await Promise.all(Array.from({ length: 5 }, () => rpc(v.token, 'loyalty_shop_buy', { p_item: 'streak_freeze' })))
    expect(fr.filter((r) => r.json?.status === 'ok').length).toBe(1)
    expect((await account(v.id))).toMatchObject({ points_balance: 0, freezes_banked: 1 })
  })

  test('S3 cosmetics: only owned items apply; a second buy says already owned and costs nothing', async () => {
    const u = await user('s3')
    expect((await rpc(u.token, 'loyalty_apply_cosmetic', { p_kind: 'card_finish', p_key: 'aurora' })).json).toBe('not_owned')
    expect((await rpc(u.token, 'loyalty_apply_cosmetic', { p_kind: 'card_finish', p_key: 'connector' })).json).toBe('not_owned')
    expect((await rpc(u.token, 'loyalty_apply_cosmetic', { p_kind: 'badge', p_key: 'x' })).json).toBe('invalid')
    await award(u, 300, 'a')
    expect((await rpc(u.token, 'loyalty_shop_buy', { p_item: 'card_finish_aurora' })).json.status).toBe('ok')
    expect((await rpc(u.token, 'loyalty_shop_buy', { p_item: 'card_finish_aurora' })).json.status).toBe('already_owned')
    expect((await account(u.id)).points_balance).toBe(150)
    expect((await rpc(u.token, 'loyalty_apply_cosmetic', { p_kind: 'card_finish', p_key: 'aurora' })).json).toBe('ok')
    expect((await rpc(u.token, 'loyalty_apply_cosmetic', { p_kind: 'card_finish', p_key: 'standard' })).json).toBe('ok')
  })
})
