// Invite a friend: redeem statuses (invalid, self, too old, twice, parallel, device), loops and chains, the friend's 37-day trial,
// activation (3 days and 5 records in 14 days), the inviter's reward once (banked Pro week, or 500 Sparks for a store subscriber),
// caps, milestones, clawback when the friend deletes their account, and what the Invite page may show about a friend.
import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { account, app, dropUser, ENV, makeUser, mask, PRO_ACTIVE, rewardSparks, rpc, SB_URL, setEntitlement, signIn, svc, svcPatch, svcRpc, TRIAL, type QaUser } from './lib'

const made: QaUser[] = []
const user = async (tag: string) => { const u = await makeUser(tag); made.push(u); return u }
test.afterAll(async () => { for (const u of made) await dropUser(u).catch(() => undefined) })

const codeOf = async (u: QaUser) => (await rpc(u.token, 'referral_my_summary')).json.code as string
// 0330: redeem goes through the app route (mailbox, address and rate limits are server-side).
const redeem = (u: QaUser, code: string, device?: string) => app('/api/referrals/redeem', { method: 'POST', token: u.token, body: JSON.stringify({ code, deviceId: device ?? null }) })
/** The friend signs in on a phone: a native device row of their own (INVITE_ANTI_ABUSE: no inviter reward before that). */
const native = async (u: QaUser, device = `qa-dev-${randomUUID()}`) => {
  const r = await svc('user_devices', { method: 'POST', body: JSON.stringify({ user_id: u.id, device_id: device, platform: 'ios', name: 'qa' }) })
  expect(r.status, mask(r.text)).toBeLessThan(300)
  return device
}
const refOf = async (invitee: QaUser) => (await svc(`referrals?invitee_id=eq.${invitee.id}&select=id,status,reason,trial_bonus_applied,reward_kind,active_days,tx_count`)).json[0]
const ent = async (u: QaUser) => (await svc(`user_entitlements?user_id=eq.${u.id}&select=plan_key,status,source,current_period_end,trial_ends_at`)).json[0]
const svcHeaders = () => ({ apikey: ENV.SUPABASE_SECRET_KEY, Authorization: `Bearer ${ENV.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json' })

/** Makes a friend look active: signed up 5 days ago, `n` records created on `days` distinct days since. */
async function activity(friend: QaUser, n: number, days: number) {
  const r = await refOf(friend)
  await svcPatch('referrals', `id=eq.${r.id}`, { invitee_created_at: new Date(Date.now() - 5 * 86_400_000).toISOString() })
  const rows = Array.from({ length: n }, (_, i) => ({ id: randomUUID(), user_id: friend.id, amount: 5, currency: 'EGP', category: 'Food', description: 'qa pr act', expense_date: new Date().toISOString().slice(0, 10), created_at: new Date(Date.now() - (4 - (i % days)) * 86_400_000).toISOString() }))
  const ins = await svc('expenses', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) })
  expect(ins.status, mask(ins.text)).toBeLessThan(300)
  return r.id as number
}
const evaluate = (friend: QaUser) => svcRpc('referral_evaluate', { p_invitee: friend.id, p_limit: 1 })

test('F1 redeem: junk code invalid, own code self_invite, lower case with spaces ok, a second code already_redeemed', async () => {
  const inviter = await user('f1i'); const other = await user('f1o')
  const code = await codeOf(inviter); const otherCode = await codeOf(other)
  const friend = await user('f1f')
  expect((await redeem(friend, 'ZZ-ZZZ')).json.status).toBe('invalid_code')
  expect((await redeem(friend, "'; select 1;--")).json.status).toBe('invalid_code')
  expect((await redeem(inviter, code)).json.status).toBe('self_invite')
  expect((await redeem(friend, `  ${code.toLowerCase()} `)).json).toMatchObject({ status: 'ok', trialExtended: false })
  expect((await redeem(friend, otherCode)).json.status).toBe('already_redeemed')
  expect((await svc(`referral_codes?user_id=eq.${inviter.id}&select=invited_count`)).json[0].invited_count).toBe(1)
})

test('F2 only accounts created after the invite: a friend older than the code is refused', async () => {
  const old = await user('f2old')
  const inviter = await user('f2i')
  const code = await codeOf(inviter)
  expect((await redeem(old, code)).json.status).toBe('account_too_old')
})

test('F3 loops and chains: A invites B, B invites C; B cannot invite A back and C cannot also take A\'s code', async () => {
  const A = await user('f3a'); const codeA = await codeOf(A)
  const B = await user('f3b'); expect((await redeem(B, codeA)).json.status).toBe('ok')
  const codeB = await codeOf(B)
  const C = await user('f3c'); expect((await redeem(C, codeB)).json.status).toBe('ok')
  expect((await redeem(A, codeB)).json.status).toBe('account_too_old')
  expect((await redeem(C, codeA)).json.status).toBe('already_redeemed')
})

test('F4 double tap: 6 parallel redeems give one referral, one invite count and no 500', async () => {
  const inviter = await user('f4i'); const code = await codeOf(inviter)
  const friend = await user('f4f')
  const all = await Promise.all(Array.from({ length: 6 }, () => redeem(friend, code)))
  const st = all.map((r) => r.json?.status ?? `${r.status}:${r.json?.code ?? ''}`)
  expect(st.filter((s) => s === 'ok').length, st.join(',')).toBe(1)
  expect((await svc(`referrals?invitee_id=eq.${friend.id}&select=id`)).json.length).toBe(1)
  expect((await svc(`referral_codes?user_id=eq.${inviter.id}&select=invited_count`)).json[0].invited_count).toBe(1)
  })

test('F4b S8G-14 (fixed 0330) a double-tapped redeem answers the losing call with a clean status, not a 409', async () => {
  // A race: one round in four shows it, so try up to six rounds of ten parallel taps.
  const inviter = await user('f4bi'); const code = await codeOf(inviter)
  const seen: number[] = []
  for (let round = 0; round < 6 && !seen.some((s) => s !== 200); round++) {
    const friend = await user(`f4bf${round}`)
    seen.push(...(await Promise.all(Array.from({ length: 10 }, () => redeem(friend, code)))).map((r) => r.status))
  }
  expect(seen.filter((s) => s !== 200)).toEqual([])
})

test('F5 friend side: redeem then claim gives a 37-day trial; a friend already trialing gets +7 at once; /me says 37', async () => {
  const inviter = await user('f5i'); const code = await codeOf(inviter)
  const a = await user('f5a')
  await redeem(a, code)
  const t = await app('/api/entitlements/trial', { method: 'POST', token: a.token })
  expect(t.json.status).toBe('granted')
  expect(Math.round((Date.parse(t.json.trialEndsAt) - Date.now()) / 86_400_000)).toBe(37)
  expect((await app('/api/entitlements/me', { token: a.token })).json.trialDays).toBe(37)
  const b = await user('f5b')
  const t2 = await app('/api/entitlements/trial', { method: 'POST', token: b.token })
  expect(t2.json.status).toBe('granted')
  expect((await redeem(b, code)).json).toMatchObject({ status: 'ok', trialExtended: true })
  expect(Math.round((Date.parse((await ent(b)).trial_ends_at) - Date.now()) / 86_400_000)).toBe(37)
  // The bonus is not paid twice: a second claim cannot happen and the flag is set.
  expect((await refOf(b)).trial_bonus_applied).toBe(true)
})

test('F6 device guards: the inviter\'s own device is self_invite; a device that already brought a friend is device_used', async () => {
  const inviter = await user('f6i'); const code = await codeOf(inviter)
  const devI = `qa-dev-${randomUUID()}`
  await svc('user_devices', { method: 'POST', body: JSON.stringify({ user_id: inviter.id, device_id: devI, platform: 'android', name: 'qa' }) })
  const f1 = await user('f6a')
  expect((await redeem(f1, code, devI)).json.status).toBe('self_invite')
  const dev = `qa-dev-${randomUUID()}`
  const f2 = await user('f6b'); expect((await redeem(f2, code, dev)).json.status).toBe('ok')
  const f3 = await user('f6c'); expect((await redeem(f3, code, dev)).json.status).toBe('device_used')
  expect((await refOf(f3)).status).toBe('rejected')
})

test('F7 S8G-05 (fixed 0330) web friends earn nothing until they sign in on a phone; one phone, two accounts, one reward', async () => {
  const inviter = await user('f7i'); const code = await codeOf(inviter)
  const statuses: string[] = []
  const friends: QaUser[] = []
  for (const tag of ['f7a', 'f7b']) {
    const f = await user(tag)
    statuses.push((await redeem(f, code)).json.status)
    await activity(f, 5, 3)
    await evaluate(f)
    const r = await refOf(f)
    statuses.push(`${r.status}:${r.reason}`)
    friends.push(f)
  }
  expect(statuses).toEqual(['ok', 'activated:awaiting_native', 'ok', 'activated:awaiting_native'])
  expect((await svc(`pro_promo_grants?user_id=eq.${inviter.id}&select=id`)).json).toEqual([])
  // Both accounts sign in on the same phone: one of them is paid, the other is the same device.
  const phone = await native(friends[0]!)
  await native(friends[1]!, phone)
  await evaluate(friends[0]!)
  await evaluate(friends[1]!)
  const ends = await Promise.all(friends.map(async (f) => { const r = await refOf(f); return `${r.status}:${r.reason}` }))
  expect(ends.sort()).toEqual(['rejected:device_used', 'rewarded:null'])
  expect((await svc(`pro_promo_grants?user_id=eq.${inviter.id}&select=id`)).json.length).toBe(1)
})

test('F8 activation: 4 records or 1 day stays pending; 5 records on 3 days activates and pays the inviter one banked week, once', async () => {
  const inviter = await user('f8i'); const code = await codeOf(inviter)
  const f = await user('f8f'); await redeem(f, code); await native(f)
  await activity(f, 4, 3)
  await evaluate(f)
  expect((await refOf(f)).status).toBe('pending')
  const g = await user('f8g'); await redeem(g, code)
  await activity(g, 6, 1)
  await evaluate(g)
  expect((await refOf(g)).status).toBe('pending')
  await activity(f, 1, 1)
  await evaluate(f)
  await evaluate(f)
  const r = await refOf(f)
  expect(r).toMatchObject({ status: 'rewarded', reward_kind: 'pro_week' })
  const grants = (await svc(`pro_promo_grants?user_id=eq.${inviter.id}&select=days,started_at,source`)).json
  expect(grants.length).toBe(1)
  expect(grants[0].days).toBe(7)
  // A Free inviter starts the week now.
  const e = await ent(inviter)
  expect(e).toMatchObject({ plan_key: 'plus', status: 'active', source: 'promo' })
  expect(Math.round((Date.parse(e.current_period_end) - Date.now()) / 86_400_000)).toBe(7)
  // The friend's own /me upkeep does not pay again.
  await app('/api/entitlements/me', { token: f.token })
  expect((await svc(`pro_promo_grants?user_id=eq.${inviter.id}&select=id`)).json.length).toBe(1)
  expect((await svc(`referral_codes?user_id=eq.${inviter.id}&select=activated_count,rewards_count`)).json[0]).toEqual({ activated_count: 1, rewards_count: 1 })
})

test('F8b S8G-13 (fixed 0330) parallel activation checks pay the inviter once (the friend on two devices, or the cron at the same time)', async () => {
  const inviter = await user('f8bi'); const code = await codeOf(inviter)
  const f = await user('f8bf'); await redeem(f, code); await native(f)
  await activity(f, 5, 3)
  await Promise.all(Array.from({ length: 8 }, () => evaluate(f)))
  const grants = (await svc(`pro_promo_grants?user_id=eq.${inviter.id}&select=days`)).json
  const counts = (await svc(`referral_codes?user_id=eq.${inviter.id}&select=activated_count,rewards_count`)).json[0]
  test.info().annotations.push({ type: 'S8G-13', description: `grants ${grants.length}, counts ${JSON.stringify(counts)}` })
  expect({ grants: grants.length, ...counts }).toEqual({ grants: 1, activated_count: 1, rewards_count: 1 })
})

test('F9 a trialing inviter banks the week (starts after the trial); a store subscriber gets 500 reward Sparks instead', async () => {
  const t = await user('f9t'); await setEntitlement(t.id, TRIAL(10)); const ct = await codeOf(t)
  const s = await user('f9s'); await setEntitlement(s.id, PRO_ACTIVE()); const cs = await codeOf(s)
  const a = await user('f9a'); await redeem(a, ct); await native(a); await activity(a, 5, 3); await evaluate(a)
  const b = await user('f9b'); await redeem(b, cs); await native(b); await activity(b, 5, 3); await evaluate(b)
  const g = (await svc(`pro_promo_grants?user_id=eq.${t.id}&select=days,started_at`)).json
  expect(g).toEqual([{ days: 7, started_at: null }])
  expect((await ent(t)).plan_key).toBe('plus_trial')
  const me = await app('/api/entitlements/me', { token: t.token })
  expect(me.json.subscription.bankedProDays).toBe(7)
  expect((await rewardSparks(s.id)).filter((x) => x.ref.startsWith('referral:')).map((x) => x.granted)).toEqual([500])
  expect((await refOf(b)).reward_kind).toBe('sparks')
  // Trial ends -> the banked week starts on the next upkeep.
  await setEntitlement(t.id, { ...TRIAL(), trial_ends_at: new Date(Date.now() - 60_000).toISOString() })
  await svcRpc('rewards_touch', { p_user: t.id })
  expect(await ent(t)).toMatchObject({ plan_key: 'plus', source: 'promo', status: 'active' })
})

test('F10 caps: with 4 rewards this month the 5th activated friend is capped, not paid', async () => {
  const inviter = await user('f10i'); const code = await codeOf(inviter)
  const now = new Date().toISOString()
  const fake = Array.from({ length: 4 }, () => ({ inviter_id: inviter.id, invitee_id: null, code, invitee_created_at: now, status: 'rewarded', rewarded_at: now }))
  expect((await svc('referrals', { method: 'POST', body: JSON.stringify(fake) })).status).toBeLessThan(300)
  const f = await user('f10f'); await redeem(f, code); await native(f); await activity(f, 5, 3); await evaluate(f)
  expect((await refOf(f))).toMatchObject({ status: 'capped', reason: 'month_cap' })
  expect((await svc(`pro_promo_grants?user_id=eq.${inviter.id}&select=id`)).json).toEqual([])
})

test('F11 milestone: the 3rd activated friend pays +50 points once', async () => {
  const inviter = await user('f11i'); const code = await codeOf(inviter)
  await svcPatch('referral_codes', `user_id=eq.${inviter.id}`, { activated_count: 2 })
  const f = await user('f11f'); await redeem(f, code); await native(f); await activity(f, 5, 3); await evaluate(f); await evaluate(f)
  const led = (await svc(`loyalty_ledger?user_id=eq.${inviter.id}&reason=eq.referral_milestone&select=delta,ref`)).json
  expect(led).toEqual([{ delta: 50, ref: '3' }])
  expect((await account(inviter.id)).lifetime_points).toBe(50)
})

test('F12 clawback: the friend deletes their account within 30 days -> the inviter\'s week comes off and the referral is clawed back', async () => {
  const inviter = await user('f12i'); const code = await codeOf(inviter)
  const f = await user('f12f'); await redeem(f, code); await native(f); await activity(f, 5, 3); await evaluate(f)
  const refId = (await refOf(f)).id
  const before = Date.parse((await ent(inviter)).current_period_end)
  await fetch(`${SB_URL}/auth/v1/admin/users/${f.id}`, { method: 'DELETE', headers: svcHeaders() })
  const r = (await svc(`referrals?id=eq.${refId}&select=status,invitee_id`)).json[0]
  expect(r).toEqual({ status: 'clawed_back', invitee_id: null })
  const after = Date.parse((await ent(inviter)).current_period_end)
  expect(Math.round((before - after) / 86_400_000)).toBe(7)
  expect((await svc(`pro_promo_grants?user_id=eq.${inviter.id}&select=revoked_at`)).json[0].revoked_at).not.toBeNull()
  await svc(`referrals?id=eq.${refId}`, { method: 'DELETE' })
})

test('F13 S8G-06 (fixed 0330) the same person (same mailbox) is not counted again after deleting a pending friend account', async () => {
  const inviter = await user('f13i'); const code = await codeOf(inviter)
  const f = await user('f13f'); await redeem(f, code)
  await fetch(`${SB_URL}/auth/v1/admin/users/${f.id}`, { method: 'DELETE', headers: svcHeaders() })
  const again = await fetch(`${SB_URL}/auth/v1/admin/users`, { method: 'POST', headers: svcHeaders(), body: JSON.stringify({ email: f.email, password: ENV.QA_PW, email_confirm: true }) }).then((r) => r.json())
  const f2 = { id: again.id as string, email: f.email, token: await signIn(f.email) }
  made.push(f2)
  expect((await redeem(f2, code)).json.status).toBe('already_redeemed')
})

test('F14 the Invite page shows a friend by first name only, never their email or id; another user cannot see the list', async () => {
  const inviter = await user('f14i'); const code = await codeOf(inviter)
  const f = await user('f14f')
  await svcPatch('profiles', `id=eq.${f.id}`, { display_name: 'Layla Hassan Omar' })
  await redeem(f, code)
  const s = (await rpc(inviter.token, 'referral_my_summary')).json
  expect(s.friends.length).toBe(1)
  expect(s.friends[0].name).toBe('Layla')
  expect(JSON.stringify(s)).not.toContain(f.id)
  expect(JSON.stringify(s)).not.toContain(f.email)
  expect(s.counts).toEqual({ invited: 1, activated: 0, rewarded: 0 })
  expect(s.caps).toMatchObject({ month: 4, year: 12 })
  const other = await user('f14o')
  expect((await rpc(other.token, 'referral_my_summary')).json.friends).toEqual([])
})

test('F15 network review signals: a second friend of one inviter from the same /24 is held for review until staff approve', async () => {
  const inviter = await user('f15i'); const code = await codeOf(inviter)
  const viaIp = (u: QaUser, ip: string) => svcRpc('referral_redeem', { p_user: u.id, p_code: code, p_ip: ip, p_mailbox_key: `${u.id}@qa.test` })
  const a = await user('f15a'); expect((await viaIp(a, '41.33.10.7')).json.status).toBe('ok')
  const b = await user('f15b'); expect((await viaIp(b, '41.33.10.99')).json.status).toBe('ok')
  const c = await user('f15c'); expect((await viaIp(c, '197.32.4.1')).json.status).toBe('ok')
  const signals = async (u: QaUser) => (await svc(`referrals?invitee_id=eq.${u.id}&select=review_signals,invitee_net`)).json[0]
  expect((await signals(a)).review_signals).toBeNull()
  expect((await signals(b)).review_signals).toEqual(['repeat_network'])
  expect((await signals(c)).review_signals).toBeNull()
  expect((await signals(a)).invitee_net).toMatch(/^[0-9a-f]{64}$/)
  await native(b); await activity(b, 5, 3); await evaluate(b)
  expect(await refOf(b)).toMatchObject({ status: 'activated', reason: 'review' })
  expect((await svc(`pro_promo_grants?user_id=eq.${inviter.id}&select=id`)).json).toEqual([])
  expect((await svcRpc('referral_reward', { p_id: (await refOf(b)).id, p_force: true })).json).toBe('rewarded')
})

test('F16 the mailbox key: the same normalised person on two accounts is invited once', async () => {
  const inviter = await user('f16i'); const code = await codeOf(inviter)
  const a = await user('f16a'); const b = await user('f16b')
  const key = `qa-f16-${randomUUID()}@gmail.com`
  expect((await svcRpc('referral_redeem', { p_user: a.id, p_code: code, p_mailbox_key: key })).json.status).toBe('ok')
  expect((await svcRpc('referral_redeem', { p_user: b.id, p_code: code, p_mailbox_key: key })).json.status).toBe('already_redeemed')
  expect((await svc(`referral_codes?user_id=eq.${inviter.id}&select=invited_count`)).json[0].invited_count).toBe(1)
})

test('F17 redeem rate limit: past 20 tries in a 10-minute bucket one account gets 429 (retryable), never a 500', async () => {
  const f = await user('f17f')
  const seen = (await Promise.all(Array.from({ length: 45 }, () => redeem(f, 'ZZ-ZZZ')))).map((r) => r.status)
  expect(seen.filter((s) => s === 429).length).toBeGreaterThan(0)
  expect(seen.every((s) => s === 200 || s === 429)).toBe(true)
})
