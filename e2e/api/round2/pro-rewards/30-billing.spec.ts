// Pro, Sparks packs and the trial: the pack bonus by state (never stacked), the RevenueCat webhook (auth, signature, bad bodies,
// replay, out-of-order, pack purchase and refund), the 30-day trial once per account and per mailbox (also in parallel), the
// stay offer, paywall-view, seen-resets and the /me read for every state. No real purchase: webhook events are signed locally
// with the dev server's own test secrets and name synthetic users only.
import { createHash, randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { app, dropUser, FREE, hasRcSecrets, makeUser, mask, PRO_ACTIVE, PRO_LAPSED, rcPost, rcSign, setEntitlement, setLoyalty, svc, svcRpc, TRIAL, type QaUser } from './lib'

const made: QaUser[] = []
const user = async (tag: string) => { const u = await makeUser(tag); made.push(u); return u }
test.afterAll(async () => { for (const u of made) await dropUser(u) })
const bonus = async (u: QaUser) => (await svcRpc('spark_pack_bonus_percent', { p_user: u.id })).json as number

test.describe('pack bonus', () => {
  test('B1 Free 0, trial 0, Pro +15, Pro at Diamond +20 (never 35), lapsed Pro 0', async () => {
    const u = await user('b1')
    expect(await bonus(u)).toBe(0)
    await setEntitlement(u.id, TRIAL())
    expect(await bonus(u)).toBe(0)
    await setEntitlement(u.id, PRO_ACTIVE())
    expect(await bonus(u)).toBe(15)
    await setLoyalty(u.id, { lifetime_points: 800, points_balance: 800, tier_key: 'diamond', gifted_rank: 2 })
    expect(await bonus(u)).toBe(20)
    await setEntitlement(u.id, PRO_LAPSED())
    expect(await bonus(u)).toBe(0)
  })
  test('B2 the /me bonus matches the database for each state', async () => {
    const u = await user('b2')
    await setEntitlement(u.id, PRO_ACTIVE())
    const me = await app('/api/entitlements/me', { token: u.token })
    expect(me.json.rewards.packBonusPercent).toBe(15)
  })
})

test.describe('RevenueCat webhook', () => {
  test.skip(!hasRcSecrets(), 'local webhook test secrets not set')
  const ev = (u: QaUser, over: Record<string, unknown> = {}) => ({ id: `qa-s8g-${randomUUID()}`, type: 'INITIAL_PURCHASE', app_user_id: u.id, product_id: 'pro_monthly', store: 'APP_STORE', event_timestamp_ms: Date.now(), purchased_at_ms: Date.now(), expiration_at_ms: Date.now() + 30 * 86_400_000, original_transaction_id: `qa-otx-${randomUUID()}`, transaction_id: `qa-tx-${randomUUID()}`, price_in_purchased_currency: 69.99, currency: 'EGP', country_code: 'EG', ...over })

  test('H1 auth: no headers, wrong Authorization, bad or missing signature, a stale stamp all get 401 and write nothing', async () => {
    const u = await user('h1')
    const raw = JSON.stringify({ event: ev(u) })
    const good = rcSign(raw)
    const cases: Record<string, string>[] = [{}, { ...good, authorization: 'Bearer wrong' }, { authorization: good.authorization }, { ...good, 'x-revenuecat-webhook-signature': 't=1,v1=00' },
      { ...good, 'x-revenuecat-webhook-signature': good['x-revenuecat-webhook-signature'].replace(/v1=./, 'v1=0') }, rcSign(raw, Date.now() - 10 * 60_000), rcSign(raw, Date.now() + 10 * 60_000), rcSign(raw.replace('pro_monthly', 'pro_annual'))]
    for (const h of cases) expect.soft((await rcPost({}, { raw, headers: h })).status).toBe(401)
    expect((await svc(`billing_events?user_id=eq.${u.id}&select=id`)).json).toEqual([])
  })

  test('H2 bad bodies: not JSON 400, no event 400, missing id/type/timestamp 400; signed but for an unknown user is acknowledged, no row', async () => {
    for (const raw of ['not json', '{}', JSON.stringify({ event: { type: 'RENEWAL' } }), JSON.stringify({ event: { id: 'x', type: 'RENEWAL', event_timestamp_ms: 'soon' } }), '[]', 'null']) {
      const r = await rcPost({}, { raw })
      expect.soft(r.status, raw).toBe(400)
    }
    const ghost = { id: randomUUID(), email: 'qa-e2e-pr-ghost@buddget-qa.test', token: '' }
    const r = await rcPost(ev(ghost as QaUser))
    expect(r.status).toBe(200)
    expect(r.json.outcome).toBe('unknown_user')
  })

  test('H3 purchase then replay: applied once (duplicate), Pro active, Egypt country stored', async () => {
    const u = await user('h3')
    const e = ev(u)
    const r1 = await rcPost(e)
    expect(r1.json.outcome, mask(r1.text)).toBe('applied')
    const r2 = await rcPost(e)
    expect(r2.json.outcome).toBe('duplicate')
    const par = await Promise.all(Array.from({ length: 5 }, () => rcPost(e)))
    expect(par.every((r) => r.json?.outcome === 'duplicate')).toBe(true)
    const ent = (await svc(`user_entitlements?user_id=eq.${u.id}&select=plan_key,status,source,store_country`)).json[0]
    expect(ent).toEqual({ plan_key: 'plus', status: 'active', source: 'apple', store_country: 'EG' })
    expect((await svc(`billing_events?user_id=eq.${u.id}&select=id`)).json.length).toBe(1)
  })

  test('H4 out of order: an older EXPIRATION after a newer RENEWAL is stale and does not end Pro', async () => {
    const u = await user('h4')
    const now = Date.now()
    expect((await rcPost(ev(u, { type: 'RENEWAL', event_timestamp_ms: now }))).json.outcome).toBe('applied')
    expect((await rcPost(ev(u, { type: 'EXPIRATION', event_timestamp_ms: now - 3_600_000 }))).json.outcome).toBe('stale')
    expect((await svc(`user_entitlements?user_id=eq.${u.id}&select=status`)).json[0].status).toBe('active')
  })

  test('H8 a SANDBOX purchase (TestFlight, App Review, license tester) never gives Pro in production', async () => {
    test.fail(true, 'S8A B-1: the webhook never reads event.environment')
    const u = await user('h8')
    await rcPost(ev(u, { environment: 'SANDBOX' }))
    const ent = (await svc(`user_entitlements?user_id=eq.${u.id}&select=plan_key`)).json[0]
    expect(ent?.plan_key ?? 'free').not.toBe('plus')
  })

  test('H5 a Sparks pack: Free buyer gets 650, Pro buyer 650 + 97 (15%); a replayed or reused transaction pays nothing more', async () => {
    const f = await user('h5f')
    const txn = `qa-tx-${randomUUID()}`
    const buy = (u: QaUser, t: string) => rcPost(ev(u, { type: 'NON_RENEWING_PURCHASE', product_id: 'sparks_650', transaction_id: t }))
    const first = ev(f, { type: 'NON_RENEWING_PURCHASE', product_id: 'sparks_650', transaction_id: txn })
    expect((await rcPost(first)).json.outcome).toBe('applied')
    expect((await rcPost(first)).json.outcome).toBe('duplicate')
    expect((await buy(f, txn)).json.outcome).toBe('applied')
    const p = await user('h5p')
    await setEntitlement(p.id, PRO_ACTIVE())
    expect((await buy(p, `qa-tx-${randomUUID()}`)).json.outcome).toBe('applied')
    expect((await buy(p, txn)).json.outcome).toBe('applied')
    const rowsF = (await svc(`spark_purchases?user_id=eq.${f.id}&select=sparks,bonus_sparks`)).json
    const rowsP = (await svc(`spark_purchases?user_id=eq.${p.id}&select=sparks,bonus_sparks`)).json
    expect(rowsF).toEqual([{ sparks: 650, bonus_sparks: 0 }])
    expect(rowsP).toEqual([{ sparks: 747, bonus_sparks: 97 }])
  })

  test('H6 a pack refund after use zeroes what is left (bonus included); spent Sparks are not clawed back', async () => {
    const u = await user('h6')
    await setEntitlement(u.id, PRO_ACTIVE())
    const txn = `qa-tx-${randomUUID()}`
    await rcPost(ev(u, { type: 'NON_RENEWING_PURCHASE', product_id: 'sparks_320', transaction_id: txn }))
    await svcRpc('spark_charge', { p_user: u.id, p_sparks: 100, p_reservation: null, p_feature: 'chat' })
    expect((await rcPost(ev(u, { type: 'CANCELLATION', product_id: 'sparks_320', transaction_id: txn, cancel_reason: 'CUSTOMER_SUPPORT' }))).json.outcome).toBe('applied')
    const row = (await svc(`spark_purchases?user_id=eq.${u.id}&select=sparks,remaining,refunded_at`)).json[0]
    expect(row.sparks).toBe(368)
    expect(row.remaining).toBe(0)
    expect(row.refunded_at).not.toBeNull()
  })

  test('H7 absurd but signed values answer 4xx, not a 500 that RevenueCat retries for days', async () => {
    const u = await user('h7')
    const r1 = await rcPost(ev(u, { price_in_purchased_currency: 1e30 }))
    const r2 = await rcPost(ev(u, { event_timestamp_ms: 1e20 }))
    expect(r1.status).toBe(400)
    expect(r2.status).toBe(400)
  })
})

test.describe('trial', () => {
  test('X1 a fresh account gets one 30-day trial; a second claim says already entitled', async () => {
    const u = await user('x1')
    const r = await app('/api/entitlements/trial', { method: 'POST', token: u.token })
    expect(r.json.status).toBe('granted')
    const days = (Date.parse(r.json.trialEndsAt) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThan(30.1)
    expect((await app('/api/entitlements/trial', { method: 'POST', token: u.token })).json.status).toBe('already_claimed')
    const me = await app('/api/entitlements/me', { token: u.token })
    expect(me.json.trialDays).toBe(30)
    expect(me.json.rewards.proActive).toBe(true)
  })

  test('X2 race: 10 parallel claims grant exactly one trial', async () => {
    const u = await user('x2')
    const all = await Promise.all(Array.from({ length: 10 }, () => app('/api/entitlements/trial', { method: 'POST', token: u.token })))
    const st = all.map((r) => r.json?.status ?? r.status)
    expect(st.filter((s) => s === 'granted').length, st.join(',')).toBe(1)
    expect((await svc(`trial_claims?user_id=eq.${u.id}&select=claimed_at`)).json.length).toBe(1)
  })

  test('X3 the same mailbox after deleting the account cannot claim again (gmail dots and +tags count as one)', async () => {
    const u = await user('x3')
    expect((await app('/api/entitlements/trial', { method: 'POST', token: u.token })).json.status).toBe('granted')
    const key = createHash('sha256').update(u.email.toLowerCase()).digest('hex')
    // Delete only the auth user so the claim row survives, as a real deletion would.
    const { ENV, SB_URL, signIn } = await import('./lib')
    await fetch(`${SB_URL}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: { apikey: ENV.SUPABASE_SECRET_KEY, Authorization: `Bearer ${ENV.SUPABASE_SECRET_KEY}` } })
    const again = await fetch(`${SB_URL}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: ENV.SUPABASE_SECRET_KEY, Authorization: `Bearer ${ENV.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: ENV.QA_PW, email_confirm: true }) }).then((r) => r.json())
    const u2 = { id: again.id as string, email: u.email, token: await signIn(u.email) }
    made.push(u2)
    try {
      expect((await app('/api/entitlements/trial', { method: 'POST', token: u2.token })).json.status).toBe('already_claimed')
    } finally {
      await svc(`trial_claims?email_key=eq.${key}`, { method: 'DELETE' })
    }
  })

  test('X4 Pro, lapsed-in-grace and canceled-in-period accounts cannot start a trial', async () => {
    const u = await user('x4')
    await setEntitlement(u.id, PRO_ACTIVE())
    expect((await app('/api/entitlements/trial', { method: 'POST', token: u.token })).json.status).toBe('already_entitled')
    await setEntitlement(u.id, { ...PRO_ACTIVE(), status: 'canceled' })
    expect((await app('/api/entitlements/trial', { method: 'POST', token: u.token })).json.status).toBe('already_entitled')
  })

  test('X5 S8G-03 (fixed 0332) a lapsed store member, or an account with a past Pro purchase, cannot take the new-member trial', async () => {
    const u = await user('x5')
    await setEntitlement(u.id, { ...PRO_LAPSED(), source: 'apple' })
    const r = await app('/api/entitlements/trial', { method: 'POST', token: u.token })
    expect(r.json.status).toBe('already_claimed')
    // The plan row was later reset to Free, but the store purchase is on record.
    const v = await user('x5b')
    await setEntitlement(v.id, FREE())
    await svc('billing_events', { method: 'POST', body: JSON.stringify({ provider: 'revenuecat', event_id: `qa-s8g-${randomUUID()}`, type: 'EXPIRATION', user_id: v.id, product_id: 'pro_monthly', event_at: new Date(Date.now() - 40 * 86_400_000).toISOString(), outcome: 'applied' }) })
    expect((await app('/api/entitlements/trial', { method: 'POST', token: v.token })).json.status).toBe('already_claimed')
    // A Sparks pack buyer was never a member: still offered the trial.
    const w = await user('x5c')
    await svc('billing_events', { method: 'POST', body: JSON.stringify({ provider: 'revenuecat', event_id: `qa-s8g-${randomUUID()}`, type: 'NON_RENEWING_PURCHASE', user_id: w.id, product_id: 'sparks_650', event_at: new Date().toISOString(), outcome: 'applied' }) })
    expect((await app('/api/entitlements/trial', { method: 'POST', token: w.token })).json.status).toBe('granted')
  })

  test('X6 an account whose trial ended cannot take another by changing its email', async () => {
    test.fail(true, 'S8A B-17: trial_claim is keyed only on the mailbox; an ended trial row is source default')
    const u = await user('x6')
    expect((await app('/api/entitlements/trial', { method: 'POST', token: u.token })).json.status).toBe('granted')
    await setEntitlement(u.id, { ...TRIAL(), status: 'expired', trial_ends_at: new Date(Date.now() - 86_400_000).toISOString() })
    const { ENV, SB_URL, signIn } = await import('./lib')
    const email = u.email.replace('x6-', 'x6b-')
    await fetch(`${SB_URL}/auth/v1/admin/users/${u.id}`, { method: 'PUT', headers: { apikey: ENV.SUPABASE_SECRET_KEY, Authorization: `Bearer ${ENV.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, email_confirm: true }) })
    made.push({ id: u.id, email, token: '' })
    const token = await signIn(email)
    expect((await app('/api/entitlements/trial', { method: 'POST', token })).json.status).toBe('already_claimed')
  })
})

test.describe('stay offer, paywall view, seen resets', () => {
  test('O1 eligibility: Free and trial no; store Pro monthly yes (stay30_2m), annual stay_annual_20; after the stamp no', async () => {
    const u = await user('o1')
    expect((await app('/api/billing/stay-offer', { token: u.token })).json).toEqual({ eligible: false })
    await setEntitlement(u.id, TRIAL())
    expect((await app('/api/billing/stay-offer', { token: u.token })).json).toEqual({ eligible: false })
    await setEntitlement(u.id, PRO_ACTIVE())
    expect((await app('/api/billing/stay-offer', { token: u.token })).json).toEqual({ eligible: true, offerId: 'stay30_2m', productId: 'pro_monthly' })
    await setEntitlement(u.id, { ...PRO_ACTIVE(), product_id: 'pro_annual' })
    expect((await app('/api/billing/stay-offer', { token: u.token })).json).toMatchObject({ eligible: true, offerId: 'stay_annual_20' })
    await setEntitlement(u.id, { ...PRO_ACTIVE(), source: 'promo' })
    expect((await app('/api/billing/stay-offer', { token: u.token })).json.eligible).toBe(false)
    await setEntitlement(u.id, PRO_ACTIVE())
    // S8G-04: the claim spends the offer only next to a real store purchase.
    await svc('billing_events', { method: 'POST', body: JSON.stringify({ provider: 'revenuecat', event_id: `qa-s8g-${randomUUID()}`, type: 'RENEWAL', user_id: u.id, product_id: 'pro_monthly', event_at: new Date().toISOString(), outcome: 'applied' }) })
    const stamps = await Promise.all([1, 2, 3].map(() => app('/api/billing/stay-offer', { method: 'POST', token: u.token })))
    expect(stamps.every((s) => s.json.ok)).toBe(true)
    expect((await app('/api/billing/stay-offer', { token: u.token })).json.eligible).toBe(false)
  })

  test('O2 no stay offer within 30 days of a lapse', async () => {
    const u = await user('o2')
    await setEntitlement(u.id, PRO_ACTIVE())
    await svc('billing_events', { method: 'POST', body: JSON.stringify({ provider: 'revenuecat', event_id: `qa-s8g-${randomUUID()}`, type: 'EXPIRATION', user_id: u.id, event_at: new Date(Date.now() - 5 * 86_400_000).toISOString(), outcome: 'applied' }) })
    expect((await app('/api/billing/stay-offer', { token: u.token })).json.eligible).toBe(false)
  })

  test('O3 S8G-04 (fixed 0332) a stay-offer POST with no purchase behind it keeps the once-only offer', async () => {
    const u = await user('o3')
    await setEntitlement(u.id, PRO_ACTIVE())
    await app('/api/billing/stay-offer', { method: 'POST', token: u.token })
    expect((await app('/api/billing/stay-offer', { token: u.token })).json.eligible).toBe(true)
  })

  test('O4 paywall-view records with selling on; odd bodies never 500; seen-resets answers ok', async () => {
    const u = await user('o4')
    expect((await app('/api/billing/paywall-view', { method: 'POST', token: u.token, body: JSON.stringify({ platform: 'web', source: 'pro' }) })).json).toEqual({ ok: true, recorded: true })
    for (const body of ['[]', '"x"', 'null', '{"platform":{"a":1},"source":' + JSON.stringify('x'.repeat(5000)) + '}', 'not json']) {
      const r = await app('/api/billing/paywall-view', { method: 'POST', token: u.token, body })
      expect.soft(r.status, body.slice(0, 20)).toBe(200)
    }
    const rows = (await svc(`paywall_views?user_id=eq.${u.id}&select=platform,source&limit=20`)).json as Array<{ platform: string | null; source: string | null }>
    expect(rows.every((r) => (r.source ?? '').length <= 40)).toBe(true)
    expect((await app('/api/entitlements/seen-resets', { method: 'POST', token: u.token })).json).toEqual({ ok: true })
  })
})

test.describe('/api/entitlements/me by state', () => {
  test('M0 S8G-02 (fixed 0332) a brand-new account starts at Silver (spec: "Everyone starts here")', async () => {
    const u = await user('m0')
    const me = (await app('/api/entitlements/me', { token: u.token })).json
    expect(me.rewards.tier?.key).toBe('silver')
  })

  test('M1 Free, trial, Pro, lapsed and founder all answer 200 with the shape each screen reads', async () => {
    const u = await user('m1')
    await setLoyalty(u.id, { tier_key: 'silver' })
    const read = async () => { const r = await app('/api/entitlements/me', { token: u.token }); expect(r.status).toBe(200); return r.json }
    let me = await read()
    expect(me.billingEnabled).toBe(true)
    expect(me.sparkProducts.map((p: { id: string }) => p.id)).toEqual(['sparks_60', 'sparks_125', 'sparks_320', 'sparks_650', 'sparks_2000'])
    expect(me.rewards.tier.key).toBe('silver')
    expect(me.rewards.invite.code).toMatch(/^[A-Z0-9]{2,8}-[A-Z0-9]{3,5}$/)
    expect(me.rewards.invite.link).toBe(`https://buddget.app/i/${me.rewards.invite.code}`)
    expect(me.rewards.memberNumber).toBeGreaterThan(0)
    expect(me.rewards.earn.map((e: { points: number }) => e.points)).toEqual([10, 10, 40])
    expect(me.rewards.tiers.map((t: { minPoints: number }) => t.minPoints)).toEqual([0, 300, 800, 1500, 1500])
    expect(me.headers).toBeUndefined()
    await setEntitlement(u.id, TRIAL())
    me = await read()
    expect(me.rewards.proActive).toBe(true)
    await setEntitlement(u.id, PRO_ACTIVE())
    me = await read()
    expect(me.subscription.fromStore).toBe(true)
    await setEntitlement(u.id, PRO_LAPSED())
    me = await read()
    expect(me.rewards.proActive).toBe(false)
    await setEntitlement(u.id, FREE())
    const { freeFounderNumber } = await import('./lib')
    const n = await freeFounderNumber()
    await svc('founders', { method: 'POST', body: JSON.stringify({ number: n, user_id: u.id, cohort: 'public', qualified_at: new Date().toISOString() }) })
    me = await read()
    expect(me.rewards.founder.number).toBe(n)
    expect(me.loyalty.founderNumber).toBe(n)
  })
})
