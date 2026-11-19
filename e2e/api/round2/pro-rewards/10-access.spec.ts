// Access: EXECUTE grants per 0315 (anon nothing on the rewards layer, admin_* service only), RLS and cross-user IDOR, the
// invite link route, user routes without a session, admin routes with a user JWT, the loyalty cron without CRON_SECRET.
import { expect, test } from '@playwright/test'
import { app, dropUser, makeUser, mask, rest, rpc, svc, svcRpc, type QaUser } from './lib'

let A: QaUser, B: QaUser
test.beforeAll(async () => { A = await makeUser('acc-a'); B = await makeUser('acc-b') })
test.afterAll(async () => { for (const u of [A, B]) if (u) await dropUser(u) })

const USER_RPCS: Array<[string, object]> = [
  ['loyalty_record_week_check', { p_week: '2026-11-15' }], ['loyalty_week_summary', {}], ['loyalty_shop_buy', { p_item: 'streak_freeze' }],
  ['loyalty_apply_cosmetic', { p_kind: 'card_finish', p_key: 'standard' }], ['referral_my_summary', {}],
  ['loyalty_credits', {}], ['loyalty_request_credit_name', { p_name: 'x' }],
]
const SERVICE_RPCS: Array<[string, object]> = [
  ['spark_grant_reward', { p_user: '00000000-0000-4000-8000-000000000000', p_sparks: 1, p_ref: 'x', p_reason: 'x' }],
  ['spark_pack_grant', { p_user: '00000000-0000-4000-8000-000000000000', p_store: 'admin', p_txn: 'x', p_product: 'sparks_60', p_price_micros: 0, p_currency: 'EGP', p_at: '2026-11-19T00:00:00Z' }],
  ['spark_pack_bonus_percent', { p_user: '00000000-0000-4000-8000-000000000000' }],
  ['loyalty_award', { p_user: '00000000-0000-4000-8000-000000000000', p_points: 1, p_reason: 'x', p_ref: 'x' }],
  ['loyalty_refresh_tier', { p_user: '00000000-0000-4000-8000-000000000000' }],
  ['referral_reward', { p_id: 1 }], ['referral_evaluate', {}], ['referral_clawback', { p_id: 1 }], ['promo_apply_banked', { p_user: '00000000-0000-4000-8000-000000000000' }],
  ['rewards_touch', { p_user: '00000000-0000-4000-8000-000000000000' }], ['entitlements_state', { p_user: '00000000-0000-4000-8000-000000000000' }], ['rewards_daily', {}],
  ['trial_claim', { p_user: '00000000-0000-4000-8000-000000000000', p_email_key: 'xxx' }], ['stay_offer_state', { p_user: '00000000-0000-4000-8000-000000000000' }],
  ['billing_apply', { p_user: '00000000-0000-4000-8000-000000000000', p_event_id: 'x', p_type: 'x', p_event_ms: 0, p_effect: {} }],
  ['admin_rewards_sparks_adjust', { p_actor: '00000000-0000-4000-8000-000000000000', p_user: '00000000-0000-4000-8000-000000000000', p_amount: 1, p_bucket: 'reward', p_reason: 'x' }],
  ['admin_rewards_platform_switch', { p_actor: '00000000-0000-4000-8000-000000000000', p_key: 'nope', p_enabled: true }],
  ['admin_rewards_founder_set', { p_actor: '00000000-0000-4000-8000-000000000000', p_user: '00000000-0000-4000-8000-000000000000' }],
  ['loyalty_close_periods', {}], ['loyalty_grant_founders', {}], ['loyalty_refresh_pro_tiers', {}], ['referral_ensure_code', { p_user: '00000000-0000-4000-8000-000000000000' }],
  // 0330: redeem runs only through POST /api/referrals/redeem; the stay-offer claim, session check and founder bar are server-only.
  ['referral_redeem', { p_user: '00000000-0000-4000-8000-000000000000', p_code: 'AB-123' }], ['stay_offer_claim', { p_user: '00000000-0000-4000-8000-000000000000' }],
  ['session_is_live', { p_session: '00000000-0000-4000-8000-000000000000' }], ['loyalty_founder_bar', { p_users: [] }],
]

test('G1 anon gets no EXECUTE on any user or service rewards RPC', async () => {
  for (const [fn, body] of [...USER_RPCS, ...SERVICE_RPCS]) {
    const r = await rpc(null, fn, body)
    expect.soft([401, 403, 404], `${fn} anon -> ${r.status} ${mask(r.text)}`).toContain(r.status)
  }
})

test('G2 a user JWT cannot run any service-only rewards, billing or admin RPC', async () => {
  for (const [fn, body] of SERVICE_RPCS) {
    const r = await rpc(A.token, fn, body)
    expect.soft([401, 403, 404], `${fn} user -> ${r.status} ${mask(r.text)}`).toContain(r.status)
  }
})

test('G3 S8G-10 (fixed 0330) anon holds EXECUTE on no rewards helper (0315: anon must hold nothing)', async () => {
  // PostgREST answers 404 for a function the role cannot execute, so the helpers that answer anon are exactly the ones granted.
  const helpers: Array<[string, object]> = [['entitlement_grants', { p_status: 'active', p_trial_ends: null, p_period_end: null, p_grace_ends: null, p_now: '2026-11-19T00:00:00Z' }],
    ['loyalty_local_day', { p_ts: '2026-11-19T00:00:00Z', p_tz: 'Africa/Cairo' }], ['loyalty_week_start', { p_day: '2026-11-19', p_week_start: 6 }]]
  const open: string[] = []
  for (const [fn, body] of helpers) if ((await rpc(null, fn, body)).status === 200) open.push(fn)
  test.info().annotations.push({ type: 'S8G-10', description: `anon can execute: ${open.join(', ') || 'none'}` })
  expect(open, 'S8G-10: pure helpers still executable by anon').toEqual([])
})

test('R1 RLS: B cannot read A\'s loyalty, referral, promo, member number, owned items or Sparks rows', async () => {
  await rpc(A.token, 'referral_my_summary')
  for (const t of ['loyalty_accounts', 'referral_codes', 'pro_promo_grants', 'member_numbers', 'loyalty_owned_items', 'spark_allowances', 'spark_purchases', 'user_entitlements', 'referrals', 'founders', 'loyalty_ledger', 'loyalty_events', 'trial_claims', 'billing_events']) {
    const r = await rest(B.token, `${t}?user_id=eq.${A.id}&select=*&limit=5`)
    const rows = Array.isArray(r.json) ? r.json.length : 0
    expect.soft(rows, `${t}: B read ${rows} of A's rows (${r.status})`).toBe(0)
  }
  const ref = await rest(B.token, `referrals?inviter_id=eq.${A.id}&select=id&limit=5`)
  expect(Array.isArray(ref.json) ? ref.json.length : 0).toBe(0)
})

test('R2 RLS: a user cannot write their own points, tier, Sparks or entitlement directly', async () => {
  const tries: Array<[string, string, string, object]> = [
    ['loyalty_accounts', 'PATCH', `user_id=eq.${A.id}`, { lifetime_points: 99999, tier_key: 'elite' }],
    ['loyalty_accounts', 'POST', '', { user_id: A.id, lifetime_points: 99999 }],
    ['spark_allowances', 'POST', '', { user_id: A.id, kind: 'reward', granted: 9999, period_start: '2026-11-01T00:00:00Z', period_end: '2027-11-01T00:00:00Z', ref: 'qa' }],
    ['spark_purchases', 'POST', '', { user_id: A.id, store: 'admin', store_txn: 'qa-self', product_id: 'sparks_60', sparks: 999, remaining: 999 }],
    ['user_entitlements', 'PATCH', `user_id=eq.${A.id}`, { plan_key: 'plus', status: 'active', source: 'promo' }],
    ['referral_codes', 'PATCH', `user_id=eq.${A.id}`, { rewards_count: 99, code: 'QA-ZZZ' }],
    ['pro_promo_grants', 'POST', '', { user_id: A.id, days: 365, source: 'admin' }],
    ['founders', 'POST', '', { number: 999, user_id: A.id, cohort: 'public', qualified_at: '2026-11-19T00:00:00Z' }],
    ['loyalty_owned_items', 'POST', '', { user_id: A.id, kind: 'card_finish', item_key: 'aurora', source: 'shop' }],
  ]
  for (const [t, method, filter, body] of tries) {
    const r = await rest(A.token, `${t}${filter ? `?${filter}` : ''}`, { method, body: JSON.stringify(body) })
    const changed = r.status < 300 && Array.isArray(r.json) && r.json.length > 0
    expect.soft(changed, `${t} ${method} -> ${r.status} ${mask(r.text)}`).toBe(false)
  }
  const acc = (await svc(`loyalty_accounts?user_id=eq.${A.id}&select=lifetime_points,tier_key`)).json?.[0]
  expect(acc?.lifetime_points ?? 0).toBe(0)
  const ent = (await svc(`user_entitlements?user_id=eq.${A.id}&select=plan_key`)).json?.[0]
  expect(ent?.plan_key ?? 'free').not.toBe('plus')
})

test('R3 IDOR: user RPCs act on auth.uid() only (no user argument reaches another account)', async () => {
  // referral_my_summary and the week RPCs take no user id; a smuggled p_user is rejected by PostgREST (no such signature).
  for (const fn of ['referral_my_summary', 'loyalty_week_summary']) {
    const r = await rpc(A.token, fn, { p_user: B.id })
    expect.soft(r.status, `${fn} with p_user -> ${r.status}`).not.toBe(200)
  }
  const mine = await rpc(A.token, 'referral_my_summary')
  const theirs = await rpc(B.token, 'referral_my_summary')
  expect(mine.json.code).not.toBe(theirs.json.code)
})

test('I1 /i/<code>: a valid code sets the cookie and 307s to /flow; junk and injection-shaped codes just open the app', async () => {
  const ok = await app('/i/layla-7k2')
  expect(ok.status).toBe(307)
  expect(ok.headers.get('location')).toContain('/flow')
  const cookie = ok.headers.get('set-cookie') ?? ''
  expect(cookie).toContain('buddget_invite=LAYLA-7K2')
  expect(cookie.toLowerCase()).toContain('max-age=2592000')
  expect(cookie.toLowerCase()).toContain('samesite=lax')
  expect(ok.headers.get('cache-control')).toContain('no-store')
  expect(ok.headers.get('x-robots-tag')).toBe('noindex')
  for (const bad of ['nocode', '%3Cscript%3E-123', 'A-B', 'AAAAAAAAAAAAA-123', 'AB-123%0d%0aSet-Cookie:%20x=1', '..%2F..%2Fadmin', 'AB-123;x=1']) {
    const r = await app(`/i/${bad}`)
    expect.soft(r.status, bad).toBe(307)
    expect.soft(r.headers.get('set-cookie') ?? '', bad).not.toContain('buddget_invite')
    expect.soft(new URL(r.headers.get('location') ?? '/', 'http://x').pathname, bad).toBe('/')
  }
})

test('A1 user routes refuse no token and a garbage token', async () => {
  const routes: Array<[string, string]> = [['GET', '/api/entitlements/me'], ['POST', '/api/entitlements/trial'], ['POST', '/api/entitlements/seen-resets'],
    ['POST', '/api/billing/paywall-view'], ['GET', '/api/billing/stay-offer'], ['POST', '/api/billing/stay-offer']]
  for (const [method, path] of routes) {
    for (const token of [null, 'garbage.token.value']) {
      const r = await app(path, { method, token, body: method === 'POST' ? '{}' : undefined })
      expect.soft(r.status, `${method} ${path} token=${token ? 'garbage' : 'none'}`).toBe(401)
    }
  }
})

test('A2 admin routes refuse a plain user JWT (with and without the CSRF header) and no session', async () => {
  const routes: Array<[string, string, object?]> = [['GET', '/api/admin/loyalty'], ['POST', '/api/admin/loyalty', { op: 'adjust' }], ['GET', '/api/admin/rewards/switches'],
    ['POST', '/api/admin/rewards/switches', { key: 'billing', enabled: false }], ['GET', `/api/admin/users/${A.id}/rewards`], ['POST', `/api/admin/users/${A.id}/rewards`, { op: 'sparks', amount: 100 }]]
  for (const [method, path, body] of routes) {
    for (const extra of [{}, { 'x-admin-csrf': '1', 'x-buddget-admin': '1' }]) {
      const r = await app(path, { method, token: A.token, headers: extra, body: body ? JSON.stringify(body) : undefined })
      expect.soft([401, 403], `${method} ${mask(path)} -> ${r.status}`).toContain(r.status)
    }
    const anon = await app(path, { method, body: body ? JSON.stringify(body) : undefined })
    expect.soft([401, 403], `${method} ${mask(path)} anon -> ${anon.status}`).toContain(anon.status)
  }
  // Nothing moved for A.
  expect((await svc(`spark_allowances?user_id=eq.${A.id}&kind=eq.reward&select=id`)).json).toEqual([])
})

test('C1 /api/cron/loyalty refuses no secret, a wrong secret, a user JWT and the secret without Bearer', async () => {
  for (const h of [{}, { authorization: 'Bearer wrong' }, { authorization: `Bearer ${A.token}` }, { authorization: process.env.CRON_SECRET ?? 'x' }]) {
    const r = await app('/api/cron/loyalty', { headers: h as Record<string, string> })
    expect.soft(r.status).toBe(401)
  }
})

test('C2 the cron RPC set is bounded: rewards_daily steps use indexes (EXPLAIN, no ANALYZE) - see report', async () => {
  // EXPLAIN is run from the report session through the SQL tool (not via PostgREST); this test pins that the service role can call
  // the scoped per-user upkeep twice with no change the second time (idempotent).
  const s1 = await svcRpc('rewards_touch', { p_user: A.id })
  const acc1 = (await svc(`loyalty_accounts?user_id=eq.${A.id}&select=*`)).json?.[0]
  const s2 = await svcRpc('rewards_touch', { p_user: A.id })
  const acc2 = (await svc(`loyalty_accounts?user_id=eq.${A.id}&select=*`)).json?.[0]
  expect(s1.status).toBeLessThan(300)
  expect(s2.status).toBeLessThan(300)
  expect({ ...acc2, updated_at: null }).toEqual({ ...acc1, updated_at: null })
})
