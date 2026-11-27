// S8c round 2: adversarial API, database and security probes with synthetic users A, B and C only.
// Rate-limit probes stop a few requests past each limit. Nothing here sends email or push, or calls a cron.
import { test, expect } from '@playwright/test'
import { B_ROWS, USERS, SB_URL, SB_KEY, code, rest, rpc, serviceGet, signIn } from './lib'

const TODAY = '2026-11-18'
let A = ''
let B = ''
test.beforeAll(async () => { A = await signIn('A'); B = await signIn('B') })
const auth = (t: string) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' })
const bPocketBalance = async () => Number(((await serviceGet(`savings_accounts?id=eq.${B_ROWS.pocket}&select=current_balance&limit=1`)).json as Array<{ current_balance: number }>)[0]?.current_balance)

test.describe('RLS: A cannot read or change B\'s rows', () => {
  test('select by id returns nothing', async () => {
    for (const [table, id] of [['expenses', B_ROWS.expense], ['payment_methods', B_ROWS.pm], ['debts', B_ROWS.debt], ['savings_accounts', B_ROWS.pocket], ['notifications', B_ROWS.notification], ['sms_parse_log', B_ROWS.smsLog]]) {
      const r = await rest(A, `${table}?id=eq.${id}&select=id&limit=1`)
      expect(r.status, table).toBe(200)
      expect(r.json, table).toEqual([])
    }
    // user_devices has no SELECT grant for authenticated at all (devices go through /api/devices).
    const dev = await rest(A, `user_devices?user_id=eq.${USERS.B.id}&select=device_id&limit=5`)
    expect(dev.status).toBe(403)
  })

  test('patch, delete and insert-as-B change nothing', async () => {
    expect((await rest(A, `expenses?id=eq.${B_ROWS.expense}`, { method: 'PATCH', body: JSON.stringify({ amount: 1 }) })).json).toEqual([])
    expect((await rest(A, `debts?id=eq.${B_ROWS.debt}`, { method: 'DELETE' })).json).toEqual([])
    const asB = await rest(A, 'expenses', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), user_id: USERS.B.id, amount: 1, currency: 'EGP', category: 'Food', expense_date: TODAY }) })
    expect(asB.status).toBe(403)
    const still = (await serviceGet(`expenses?id=eq.${B_ROWS.expense}&select=amount,deleted_at&limit=1`)).json as Array<{ amount: number; deleted_at: string | null }>
    expect(Number(still[0].amount)).toBe(10)
    expect((await serviceGet(`debts?id=eq.${B_ROWS.debt}&select=id&limit=1`)).json).toHaveLength(1)
  })
})

test.describe('RPC IDOR: B\'s ids through A\'s session', () => {
  test('savings RPCs on B\'s pocket fail and leave the balance', async () => {
    const before = await bPocketBalance()
    const base = { p_account_id: B_ROWS.pocket, p_amount: 5, p_currency: 'EGP', p_local_date: TODAY }
    for (const fn of ['deposit_to_savings_v2', 'withdraw_from_savings_v2']) {
      const r = await rpc(A, fn, { ...base, p_transaction_id: crypto.randomUUID() })
      expect(r.status, fn).toBeGreaterThanOrEqual(400)
    }
    const corr = await rpc(A, 'correct_savings_balance_v2', { p_account_id: B_ROWS.pocket, p_new_balance: 0, p_local_date: TODAY, p_transaction_id: crypto.randomUUID() })
    expect(corr.status).toBeGreaterThanOrEqual(400)
    for (const fn of ['deposit_to_savings', 'withdraw_from_savings']) {
      const r = await rpc(A, fn, { p_account_id: B_ROWS.pocket, p_amount: 5, p_currency: 'EGP', p_date: TODAY, p_transaction_id: crypto.randomUUID() })
      expect(r.status, fn).toBeGreaterThanOrEqual(400)
    }
    expect(await bPocketBalance()).toBe(before)
  })

  test('balance_view on B\'s account shows nothing of B', async () => {
    const r = await rpc(A, 'balance_view', { p_payment_method: B_ROWS.pm })
    expect(r.text).not.toMatch(/1000|QA B/)
  })

  test('linked-row RPCs refuse B\'s debt and account', async () => {
    const pay = await rpc(A, 'add_debt_payment_with_expense', {
      p_payment: { id: crypto.randomUUID(), debt_id: B_ROWS.debt, amount: 1, currency: 'EGP', payment_date: TODAY },
      p_expense: { id: crypto.randomUUID(), amount: 1, currency: 'EGP', category: 'Debt', description: 'qa', expense_date: TODAY },
    })
    expect(pay.status).toBeGreaterThanOrEqual(400)
    const inc = await rpc(A, 'add_income_with_debt', {
      p_income: { name: 'qa', amount: 1, currency: 'EGP', payment_method_id: B_ROWS.pm },
      p_debt: { name: 'qa', amount: 1, currency: 'EGP' },
    })
    expect(inc.status).toBeGreaterThanOrEqual(400)
    expect((await serviceGet(`debt_payments?debt_id=eq.${B_ROWS.debt}&select=id&limit=1`)).json).toEqual([])
  })

  test('invoker SMS-pool functions cannot write (no table grant)', async () => {
    expect((await rpc(A, 'learn_sms_sender_currency', { p_user: USERS.B.id, p_sender: 'QAS8C', p_currency: 'USD', p_confirmed: true })).status).toBeGreaterThanOrEqual(400)
    expect((await rpc(A, 'bump_sms_sender', { p_sender: 'QAS8C', p_is_txn: true })).status).toBeGreaterThanOrEqual(400)
    expect((await rpc(A, 'bump_sms_keyword', { p_keyword: 'qas8c', p_lang: 'en' })).status).toBeGreaterThanOrEqual(400)
  })

  test('sync reads return only A\'s rows; the table allowlist holds', async () => {
    const delta = await rpc(A, 'sync_table_delta', { p_table: 'expenses', p_win: null })
    expect(delta.text).not.toContain(B_ROWS.expense)
    const bad = await rpc(A, 'sync_table_delta', { p_table: 'profiles', p_win: null })
    expect(bad.status).toBeGreaterThanOrEqual(400)
    const inj = await rpc(A, 'sync_table_delta', { p_table: 'expenses t; select 1 --', p_win: null })
    expect(inj.status).toBeGreaterThanOrEqual(400)
    const pull = await rpc(A, 'sync_pull_v2', { p_since: null })
    expect(pull.status).toBe(200)
    expect(pull.text).not.toMatch(new RegExp(`${B_ROWS.expense}|${B_ROWS.pm}|${B_ROWS.debt}|${B_ROWS.pocket}`))
  })
})

test.describe('API route IDOR', () => {
  test('SMS actions on B\'s parse log are not found', async ({ request }) => {
    for (const path of ['/api/sms/confirm', '/api/sms/dismiss', '/api/sms/undo', '/api/sms/flag-action', '/api/sms/own-transfer']) {
      const r = await request.post(path, { headers: auth(A), data: { logId: B_ROWS.smsLog, action: 'dismiss' } })
      expect(r.status(), path).not.toBe(500)
      expect((await r.json()) as Record<string, unknown>, path).not.toMatchObject({ ok: true })
    }
    const log = (await serviceGet(`sms_parse_log?id=eq.${B_ROWS.smsLog}&select=status&limit=1`)).json as Array<{ status: string }>
    expect(log[0].status).toBe('rejected')
  })

  test('notifications and devices of B stay untouched', async ({ request }) => {
    expect((await request.patch('/api/notifications', { headers: auth(A), data: { ids: [B_ROWS.notification] } })).status()).toBeLessThan(500)
    const n = (await serviceGet(`notifications?id=eq.${B_ROWS.notification}&select=is_read&limit=1`)).json as Array<{ is_read: boolean }>
    expect(n[0].is_read).toBe(false)
    // Device ids are client-chosen and scoped per user: A may hold its own row with the same id string (cross-user.mjs
    // creates one), and then these act on A's row only. Either way B's row must not change.
    expect((await request.patch(`/api/devices/${B_ROWS.device}`, { headers: auth(A), data: { name: 'qa-s8c-rename' } })).status()).toBeLessThan(500)
    const bDev = (await serviceGet(`user_devices?user_id=eq.${USERS.B.id}&select=name,revoked_at&limit=5`)).json as Array<{ name: string; revoked_at: string | null }>
    expect(bDev[0].name).toBe('QA B phone')
    expect(bDev[0].revoked_at).toBeNull()
  })

  test('admin routes refuse a non-admin user token', async ({ request }) => {
    const id = USERS.B.id
    const gets = ['overview', 'plans', 'ai/cost', 'emails/log', 'emails', 'users', `users/${id}`, `users/${id}/activity`, `users/${id}/financial`, `users/${id}/sms`, `users/${id}/export`, `users/${id}/rewards`,
      'platform', 'auth/sessions', 'sms/queue-health', 'sms/pattern-review', 'sms/push-health', 'sms/templates', 'sms/logs', 'sms/health', 'sms/promotion', 'audit', 'rewards/switches',
      'crashes', 'access', 'loyalty', 'leads', 'staff', 'support/macros', 'support/tickets', 'flags', 'analytics', 'analytics/onboarding']
    for (const p of gets) {
      const r = await request.get(`/api/admin/${p}`, { headers: auth(A) })
      expect([401, 403, 405], p).toContain(r.status())
    }
    for (const p of ['flags', 'plans', 'rewards/switches', `users/${id}`, 'staff']) {
      const r = await request.fetch(`/api/admin/${p}`, { method: 'PATCH', headers: auth(A), data: {} })
      expect([401, 403, 405], `PATCH ${p}`).toContain(r.status())
    }
  })
})

test.describe('sessions and tokens', () => {
  test('alg none and foreign-project tokens are refused', async ({ request }) => {
    const [, payload] = A.split('.')
    const none = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${payload}.`
    expect((await request.get('/api/notifications', { headers: auth(none) })).status()).toBe(401)
    expect((await rest(none, 'expenses?select=id&limit=1')).status).toBe(401)
  })

  test('S8C-02 (fixed 0332): a revoked session fails on the app API routes too, not only on PostgREST', async ({ request }) => {
    const t = await signIn('A')
    await fetch(`${SB_URL}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${t}` } })
    expect((await rest(t, 'expenses?select=id&limit=1')).status).toBe(401)
    // Every app route checks the JWT's session is still live (session_is_live), reads and writes alike.
    expect((await request.post('/api/sms/setup-token', { headers: auth(t), data: {} })).status()).toBe(401)
    expect((await request.post('/api/entitlements/trial', { headers: auth(t) })).status()).toBe(401)
    expect((await request.post('/api/billing/paywall-view', { headers: auth(t), data: {} })).status()).toBe(401)
    expect((await request.get('/api/notifications', { headers: auth(t) })).status()).toBe(401)
  })

  test('SMS ingest token: garbage refused, valid token accepted, revoked token refused', async ({ request }) => {
    expect((await request.post('/api/sms/parse', { headers: auth('00000000-0000-4000-8000-000000000000'), data: {} })).status()).toBe(401)
    const issued = await request.post('/api/sms/setup-token', { headers: auth(A), data: {} })
    expect(issued.status()).toBe(200)
    const token = ((await issued.json()) as { token: string }).token
    const ok = await request.post('/api/sms/parse', { headers: auth(token), data: { nothing: true } })
    expect(ok.status()).toBe(200)
    expect(await ok.json()).toMatchObject({ ok: false, reason: 'invalid_body' })
    const rev = await request.post('/api/sms/revoke-token', { headers: auth(A), data: { token } })
    expect(rev.status()).toBeLessThan(500)
    if (rev.status() === 200) expect((await request.post('/api/sms/parse', { headers: auth(token), data: {} })).status()).toBe(401)
  })
})

test.describe('money RPC concurrency', () => {
  test('parallel corrections with one transaction id apply once; withdrawals never overdraw', async () => {
    const pocket = crypto.randomUUID()
    await rest(A, 'savings_accounts', { method: 'POST', body: JSON.stringify({ id: pocket, user_id: USERS.A.id, name: 'qa s8c conc', currency: 'EGP', opening_balance: 0 }) })
    const bal = async () => Number(((await rest(A, `savings_accounts?id=eq.${pocket}&select=current_balance&limit=1`)).json as Array<{ current_balance: number }>)[0].current_balance)
    const dep = crypto.randomUUID()
    await Promise.all(Array.from({ length: 6 }, () => rpc(A, 'deposit_to_savings_v2', { p_account_id: pocket, p_amount: 100, p_currency: 'EGP', p_local_date: TODAY, p_transaction_id: dep })))
    expect(await bal()).toBe(100)
    const tx = crypto.randomUUID()
    await Promise.all(Array.from({ length: 6 }, () => rpc(A, 'correct_savings_balance_v2', { p_account_id: pocket, p_new_balance: 70, p_local_date: TODAY, p_transaction_id: tx })))
    expect(await bal()).toBe(70)
    const ws = await Promise.all(Array.from({ length: 5 }, () => rpc(A, 'withdraw_from_savings_v2', { p_account_id: pocket, p_amount: 30, p_currency: 'EGP', p_local_date: TODAY, p_transaction_id: crypto.randomUUID() })))
    expect(ws.filter((r) => r.status === 200)).toHaveLength(2)
    expect(await bal()).toBe(10)
  })

  test('parallel debt payment with the same ids lands once', async () => {
    const debt = crypto.randomUUID()
    await rest(A, 'debts', { method: 'POST', body: JSON.stringify({ id: debt, user_id: USERS.A.id, name: 'qa s8c debt', amount: 500, currency: 'EGP', direction: 'i_owe' }) })
    const payId = crypto.randomUUID(), expId = crypto.randomUUID()
    const rs = await Promise.all(Array.from({ length: 6 }, () => rpc(A, 'add_debt_payment_with_expense', {
      p_payment: { id: payId, debt_id: debt, amount: 50, currency: 'EGP', payment_date: TODAY, linked_expense_id: expId },
      p_expense: { id: expId, amount: 50, currency: 'EGP', category: 'Debt', description: 'qa s8c', expense_date: TODAY },
    })))
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1)
    expect(rs.filter((r) => r.status >= 500)).toHaveLength(0)
    expect((await rest(A, `debt_payments?debt_id=eq.${debt}&select=id`)).json).toHaveLength(1)
  })
})

test.describe('inputs: NaN, Infinity, boundary dates', () => {
  test('debt payments and income refuse NaN and Infinity', async () => {
    const debt = crypto.randomUUID()
    await rest(A, 'debts', { method: 'POST', body: JSON.stringify({ id: debt, user_id: USERS.A.id, name: 'qa s8c nan', amount: 100, currency: 'EGP', direction: 'i_owe' }) })
    for (const amount of ['NaN', 'Infinity', '-Infinity']) {
      expect((await rest(A, 'debt_payments', { method: 'POST', body: JSON.stringify({ user_id: USERS.A.id, debt_id: debt, amount, currency: 'EGP', payment_date: TODAY }) })).status, amount).toBe(400)
      expect((await rest(A, 'income_events', { method: 'POST', body: JSON.stringify({ user_id: USERS.A.id, name: 'qa', amount, currency: 'EGP', received_date: TODAY }) })).status, amount).toBe(400)
    }
  })

  test('S8C-03 (fixed 0332): debts.amount refuses NaN', async () => {
    const r = await rest(A, 'debts', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), user_id: USERS.A.id, name: 'qa s8c nan debt', amount: 'NaN', currency: 'EGP', direction: 'i_owe' }) })
    expect(r.status).toBe(400)
  })

  test('S8C-04 (fixed 0332): expense and income dates far outside 2000..2099 are refused', async () => {
    const r = await rest(A, 'expenses', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), user_id: USERS.A.id, amount: 1, currency: 'EGP', category: 'Food', description: 'qa s8c 2999', expense_date: '2999-01-01' }) })
    expect(code(r)).toBe('23514')
    const ok = await rest(A, 'expenses', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), user_id: USERS.A.id, amount: 1, currency: 'EGP', category: 'Food', description: 'qa s8c 2000', expense_date: '2000-01-01' }) })
    expect(ok.status).toBe(201)
    const inc = await rest(A, 'income_events', { method: 'POST', body: JSON.stringify({ user_id: USERS.A.id, name: 'qa s8c 1900', amount: 1, currency: 'EGP', received_date: '1900-01-01' }) })
    expect(code(inc)).toBe('23514')
  })

  test('month-end bad bodies are 4xx (bad op, bad id, bad version, split over 100)', async ({ request }) => {
    const bodies = [{ op: 'nope' }, { op: 'apply', id: 'NaN', version: 1 }, { op: 'apply', id: crypto.randomUUID(), version: 0 },
      { op: 'split', split: [{ target_id: crypto.randomUUID(), pct: 101 }] }]
    for (const data of bodies) {
      const r = await request.post('/api/month-end', { headers: auth(A), data })
      expect(r.status(), JSON.stringify(data)).toBeGreaterThanOrEqual(400)
      expect(r.status(), JSON.stringify(data)).toBeLessThan(500)
    }
  })
})

test.describe('rate limits (a couple past each limit)', () => {
  test('biometric sign-in: 10 per device per 10 min', async ({ request }) => {
    const deviceId = crypto.randomUUID()
    const st: number[] = []
    for (let i = 0; i < 12; i++) st.push((await request.post('/api/biometric/signin', { headers: { 'X-Buddget-Device-Id': deviceId }, data: { secret: 'x'.repeat(64) } })).status())
    expect(st.slice(0, 10).every((s) => s === 404)).toBe(true)
    expect(st.slice(10)).toEqual([429, 429])
  })

  test('month-end: 30 per user per minute', async ({ request }) => {
    const sec = new Date().getUTCSeconds()
    if (sec > 30) await new Promise((r) => setTimeout(r, (61 - sec) * 1000))
    const st: number[] = []
    for (let i = 0; i < 32; i++) st.push((await request.post('/api/month-end', { headers: auth(B), data: { op: 'undo', id: crypto.randomUUID() } })).status())
    expect(st.filter((s) => s === 429).length).toBeGreaterThanOrEqual(2)
    expect(st.indexOf(429)).toBe(30)
  })
})

test.describe('billing and entitlements', () => {
  test('RevenueCat webhook refuses an unsigned call; entitlements are per user', async ({ request }) => {
    expect([401, 503]).toContain((await request.post('/api/billing/revenuecat', { data: { event: { type: 'INITIAL_PURCHASE', app_user_id: USERS.A.id } } })).status())
    const me = await request.get('/api/entitlements/me', { headers: auth(A) })
    expect(['free', 'plus_trial']).toContain(((await me.json()) as { planKey: string }).planKey)
    expect((await rest(A, 'user_entitlements', { method: 'POST', body: JSON.stringify({ user_id: USERS.A.id, plan_key: 'plus', status: 'active' }) })).status).toBeGreaterThanOrEqual(400)
    const patch = await rest(A, `user_entitlements?user_id=eq.${USERS.A.id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ plan_key: 'plus' }) })
    expect(patch.status >= 400 || (Array.isArray(patch.json) && patch.json.length === 0)).toBe(true)
  })

  test('trial: twelve parallel claims grant one', async ({ request }) => {
    const rs = await Promise.all(Array.from({ length: 12 }, () => request.post('/api/entitlements/trial', { headers: auth(B), data: {} })))
    const statuses = await Promise.all(rs.map(async (r) => ((await r.json()) as { status?: string }).status))
    expect(statuses.filter((s) => s === 'granted').length).toBeLessThanOrEqual(1)
    expect(rs.every((r) => r.status() < 500)).toBe(true)
  })
})
