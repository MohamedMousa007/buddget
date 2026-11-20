// S8c round 2: one permanent regression test per QA fix (QA-17, 30, 51 to 62, 98 to 102). Synthetic users only.
// Known open bugs are test.fail() with their S8c finding id, so the suite stays green and flips when fixed.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect } from '@playwright/test'
import { B_ROWS, USERS, SB_URL, SB_KEY, code, rest, rpc, serviceGet, signIn } from './lib'

const TODAY = '2026-11-18'
let A = ''
test.beforeAll(async () => { A = await signIn('A') })
const auth = (t: string) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' })

test('QA-17 / QA-99: check-email stops at 30 per window from one IP', async ({ request }) => {
  // Start in a fresh 60 s bucket so the burst cannot straddle two windows. Local servers report 127.0.0.1, so other
  // sessions on this host share the bucket: that can only make the 429 come earlier.
  const sec = new Date().getUTCSeconds()
  if (sec > 2) await new Promise((r) => setTimeout(r, (61 - sec) * 1000))
  const statuses: number[] = []
  for (let wave = 0; wave < 8 && !statuses.includes(429); wave++) {
    const rs = await Promise.all(Array.from({ length: 4 }, () => request.post('/api/auth/check-email', { data: { email: USERS.B.email } })))
    statuses.push(...rs.map((r) => r.status()))
  }
  expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(30)
  expect(statuses).toContain(429)
})

test('QA-30: a revoked session JWT is refused by PostgREST; another live session is not', async () => {
  const t1 = await signIn('A')
  const t2 = await signIn('A')
  expect((await rest(t1, 'expenses?select=id&limit=1')).status).toBe(200)
  const out = await fetch(`${SB_URL}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${t1}` } })
  expect(out.status).toBe(204)
  const after = await rest(t1, 'expenses?select=id&limit=1')
  expect(after.status).toBe(401)
  expect(code(after)).toBe('session_revoked')
  expect((await rest(t2, 'expenses?select=id&limit=1')).status).toBe(200)
})

test('QA-51 / QA-55: null bodies and wrong-typed fields answer 4xx, never 500', async ({ request }) => {
  const cases: Array<[string, unknown, number]> = [
    ['/api/ai', null, 400], ['/api/analytics/onboarding', null, 400], ['/api/budget/ai', null, 400],
    ['/api/billing/paywall-view', null, 200], ['/api/auth/check-email', { email: 7 }, 400],
    ['/api/biometric/signin', { deviceId: 5, secret: 5 }, 400], ['/api/biometric/register', { deviceId: 5, secret: [] }, 400],
  ]
  for (const [path, body, want] of cases) {
    const r = await request.post(path, { headers: auth(A), data: JSON.stringify(body) })
    expect(r.status(), path).toBe(want)
  }
})

test('QA-52: paywall-view records at most 20 views per user per hour', async ({ request }) => {
  const B = await signIn('B')
  const recorded: boolean[] = []
  for (let i = 0; i < 22; i++) {
    const r = await request.post('/api/billing/paywall-view', { headers: auth(B), data: { platform: 'web', source: 'qa-s8c' } })
    expect(r.status()).toBe(200)
    recorded.push(((await r.json()) as { recorded: boolean }).recorded)
  }
  expect(recorded.filter(Boolean).length).toBeLessThanOrEqual(20)
  expect(recorded.at(-1)).toBe(false)
})

test('QA-54: biometric sign-in with no device header or cookie is 404 and sets no cookie', async ({ request }) => {
  const r = await request.post('/api/biometric/signin', { data: { secret: 'x'.repeat(64) } })
  expect(r.status()).toBe(404)
  expect(r.headers()['set-cookie']).toBeUndefined()
})

test('QA-56 / QA-57: the public deep health answer is ok/degraded only', async ({ request }) => {
  const r = await request.get('/api/health/deep')
  const j = (await r.json()) as Record<string, unknown>
  expect(Object.keys(j).sort()).toEqual(['degraded', 'ok'])
  expect(JSON.stringify(j)).not.toMatch(/linear|outbox|cron|commit/i)
  // A user JWT is not the cron secret.
  const cron = await request.get('/api/cron/integrations', { headers: auth(A) })
  expect(cron.status()).toBe(401)
})

test('QA-58: admin leads (cursor paging) refuses a non-admin token', async ({ request }) => {
  for (const q of ['', '?cursor=2026-11-01T00:00:00Z|00000000-0000-4000-8000-000000000000', '?offset=1']) {
    const r = await request.get(`/api/admin/leads${q}`, { headers: auth(A) })
    expect([401, 403]).toContain(r.status())
  }
})

test('QA-59: trial claims never hold a clear email address', async () => {
  const r = await serviceGet('trial_claims?email_key=like.*@*&select=email_key&limit=1')
  expect(r.status).toBe(200)
  expect(r.json).toEqual([])
})

test('QA-60: NaN and Infinity are refused on every money column', async () => {
  const id = () => crypto.randomUUID()
  const writes: Array<[string, Record<string, unknown>]> = [
    ['expenses', { id: id(), user_id: USERS.A.id, amount: 'NaN', currency: 'EGP', category: 'Food', description: 'qa nan', expense_date: TODAY }],
    ['expenses', { id: id(), user_id: USERS.A.id, amount: 'Infinity', currency: 'EGP', category: 'Food', description: 'qa inf', expense_date: TODAY }],
    ['income_events', { id: id(), user_id: USERS.A.id, name: 'qa nan', amount: 'NaN', currency: 'EGP', received_date: TODAY }],
    ['savings_accounts', { id: id(), user_id: USERS.A.id, name: 'qa nan', currency: 'EGP', opening_balance: 'NaN' }],
  ]
  for (const [table, row] of writes) {
    const r = await rest(A, table, { method: 'POST', body: JSON.stringify(row) })
    expect(r.status, `${table} ${row.amount ?? row.opening_balance}`).toBe(400)
  }
  for (const amt of ['NaN', 'Infinity', 1e20]) {
    const r = await rpc(A, 'deposit_to_savings_v2', { p_account_id: crypto.randomUUID(), p_amount: amt, p_currency: 'EGP', p_local_date: TODAY, p_transaction_id: crypto.randomUUID() })
    expect(r.status, `deposit ${amt}`).toBe(400)
  }
})

test('S8C-01 (QA-60 gap, fixed 0332): payment_methods.opening_balance refuses NaN', async () => {
  const r = await rest(A, 'payment_methods', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), user_id: USERS.A.id, name: 'qa nan pm', type: 'cash', currency: 'EGP', opening_balance: 'NaN' }) })
  expect(r.status).toBe(400)
})

test('S8A X-4 (fixed 0335): the remaining money tables refuse NaN and Infinity; a normal row is accepted', async () => {
  const rows: Array<[string, string, Record<string, unknown>]> = [
    ['budget_categories', 'amount', { name: 'qa s8a', amount: 1 }],
    ['goals', 'target_amount', { name: 'qa s8a', target_amount: 1 }],
    ['income_sources', 'amount', { name: 'qa s8a', amount: 1, effective_start: TODAY }],
    ['recurring_expenses', 'amount', { amount: 1 }],
    ['subscriptions', 'amount', { name: 'qa s8a', amount: 1 }],
  ]
  for (const [table, col, base] of rows) {
    const ok = { id: crypto.randomUUID(), user_id: USERS.A.id, ...base }
    const good = await rest(A, table, { method: 'POST', body: JSON.stringify(ok) })
    expect(good.status, `${table} normal row`).toBe(201)
    await rest(A, `${table}?id=eq.${ok.id}`, { method: 'DELETE' })
    for (const bad of ['NaN', 'Infinity']) {
      const r = await rest(A, table, { method: 'POST', body: JSON.stringify({ ...ok, id: crypto.randomUUID(), [col]: bad }) })
      expect(r.status, `${table}.${col} ${bad}`).toBe(400)
    }
  }
})

test('QA-61: the migrations README says the folder is the record', () => {
  const readme = readFileSync(resolve(__dirname, '../../../supabase/migrations/README.md'), 'utf8')
  expect(readme).toMatch(/The folder is the record \(QA-61/)
})

test('QA-62: savings dates outside 2000..2099 are refused', async () => {
  const pocket = crypto.randomUUID()
  expect((await rest(A, 'savings_accounts', { method: 'POST', body: JSON.stringify({ id: pocket, user_id: USERS.A.id, name: 'qa s8c dates', currency: 'EGP', opening_balance: 0 }) })).status).toBe(201)
  for (const d of ['2999-01-01', '1999-12-31', '2100-01-01']) {
    const r = await rpc(A, 'deposit_to_savings_v2', { p_account_id: pocket, p_amount: 1, p_currency: 'EGP', p_local_date: d, p_transaction_id: crypto.randomUUID() })
    expect(r.status, d).toBe(400)
    expect(code(r), d).toBe('23514')
  }
  expect((await rpc(A, 'deposit_to_savings_v2', { p_account_id: pocket, p_amount: 1, p_currency: 'EGP', p_local_date: '2000-01-01', p_transaction_id: crypto.randomUUID() })).status).toBe(200)
})

test('QA-98: link columns refuse another user\'s ids, accept own and unknown ids', async () => {
  const goal = (ids: string[]) => rest(A, 'goals', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), user_id: USERS.A.id, name: 'qa s8c link', linked_savings_account_ids: ids }) })
  const crossGoal = await goal([B_ROWS.pocket])
  expect(crossGoal.status).toBe(409)
  expect(code(crossGoal)).toBe('23503')
  expect((await goal([crypto.randomUUID()])).status).toBe(201)
  const exp = (link: Record<string, string>) => rest(A, 'expenses', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), user_id: USERS.A.id, amount: 1, currency: 'EGP', category: 'Food', description: 'qa s8c link', expense_date: TODAY, ...link }) })
  for (const col of ['sms_log_id', 'retracted_by_sms_log_id']) {
    const r = await exp({ [col]: B_ROWS.smsLog })
    expect(code(r), col).toBe('23503')
  }
  const income = await rest(A, 'income_events', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), user_id: USERS.A.id, name: 'qa s8c', amount: 1, currency: 'EGP', received_date: TODAY, linked_savings_account_id: B_ROWS.pocket }) })
  expect(code(income)).toBe('23503')
})

test('QA-100: app pages pin the project origin; bare https: images only on /admin', async ({ request }) => {
  const origin = new URL(SB_URL).origin
  const dir = (csp: string, name: string) => csp.split(';').map((s) => s.trim()).find((s) => s.startsWith(name)) ?? ''
  for (const p of ['/login', '/dashboard']) {
    const csp = (await request.get(p)).headers()['content-security-policy'] ?? ''
    expect(dir(csp, 'connect-src'), p).toContain(origin)
    expect(dir(csp, 'connect-src'), p).not.toContain('*.supabase.co')
    expect(dir(csp, 'img-src').split(' '), p).not.toContain('https:')
  }
})

test('QA-101: the net schema is not reachable through PostgREST', async () => {
  const r = await rest(A, 'rpc/http_get', { method: 'POST', headers: { 'Content-Profile': 'net' }, body: JSON.stringify({ url: 'https://example.com/' }) })
  expect(r.status).toBe(406)
})

test('QA-102: setup-token GET without a Bearer is 405; POST issues a no-store token', async ({ request }) => {
  const cookieOnly = await request.get('/api/sms/setup-token', { headers: { Cookie: 'sb-qa-auth-token=x' } })
  expect(cookieOnly.status()).toBe(405)
  expect(cookieOnly.headers().allow).toBe('POST')
  const post = await request.post('/api/sms/setup-token', { headers: auth(A), data: {} })
  expect(post.status()).toBe(200)
  expect(post.headers()['cache-control']).toContain('no-store')
})

// QA-53 runs last in adversarial.spec.ts's lifecycle block: it deletes C.
