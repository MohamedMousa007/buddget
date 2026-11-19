// QA Session 02 (security) probe against the Supabase REST/Auth API with synthetic users only.
// Usage: SB_URL=... SB_KEY=<publishable key> QA_PW_FILE=<path> node e2e/security/api-probe.mjs <step>
// Prints statuses and row counts only, never tokens or row contents.
import { readFileSync } from 'node:fs'

const URL_ = process.env.SB_URL
const KEY = process.env.SB_KEY
const PW = readFileSync(process.env.QA_PW_FILE, 'utf8').trim()
const B = '126068f6-bdf9-46fe-976c-83d3552bac14'
const step = process.argv[2] ?? 'rls'

async function signIn(email, password) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, token: j.access_token, code: j.error_code ?? j.code, msg: (j.msg ?? j.error_description ?? '').slice(0, 80) }
}

const rest = (token, path, init = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } })

async function count(token, path, init) {
  const r = await rest(token, path, init)
  const t = await r.text()
  let n = '-'
  try { const j = JSON.parse(t); n = Array.isArray(j) ? j.length : (j?.code ?? 'obj') } catch {}
  return `${r.status}/${n}`
}

if (step === 'rls') {
  const a = await signIn('qa-sec-1@buddget-qa.test', PW)
  console.log('signin A', a.status, a.code ?? '')
  if (!a.token) process.exit(1)
  const T = a.token
  console.log('A select B expenses     ', await count(T, `expenses?user_id=eq.${B}&select=id`))
  console.log('A select all expenses   ', await count(T, 'expenses?select=id'))
  console.log('A select B pm by id     ', await count(T, 'payment_methods?id=eq.bbbbbbbb-0000-4000-8000-000000000001&select=id'))
  console.log('A patch B expense       ', await count(T, 'expenses?id=eq.bbbbbbbb-0000-4000-8000-000000000004', { method: 'PATCH', body: JSON.stringify({ amount: 1 }) }))
  console.log('A delete B debt         ', await count(T, 'debts?id=eq.bbbbbbbb-0000-4000-8000-000000000002', { method: 'DELETE' }))
  console.log('A insert as B           ', await count(T, 'notifications', { method: 'POST', body: JSON.stringify({ user_id: B, type: 'info', title: 'x', message: 'x' }) }))
  console.log('A rpc deposit B pocket  ', await count(T, 'rpc/deposit_to_savings_v2', { method: 'POST', body: JSON.stringify({ p_account_id: 'bbbbbbbb-0000-4000-8000-000000000003', p_amount: 1, p_currency: 'EGP', p_local_date: '2026-11-17', p_transaction_id: crypto.randomUUID(), p_notes: 'qa' }) }))
  console.log('A rpc balance_view B pm ', await count(T, 'rpc/balance_view', { method: 'POST', body: JSON.stringify({ p_payment_method: 'bbbbbbbb-0000-4000-8000-000000000001' }) }))
  console.log('A rpc admin_overview    ', await count(T, 'rpc/admin_overview', { method: 'POST', body: '{}' }))
  console.log('A rpc check_email_status', await count(T, 'rpc/check_email_status', { method: 'POST', body: JSON.stringify({ p_email: 'qa-sec-2@buddget-qa.test' }) }))
  console.log('A rpc user_id_by_email  ', await count(T, 'rpc/user_id_by_email', { method: 'POST', body: JSON.stringify({ p_email: 'qa-sec-2@buddget-qa.test' }) }))
  console.log('A select admin_staff    ', await count(T, 'admin_staff?select=user_id'))
  console.log('A select user_entitle.  ', await count(T, 'user_entitlements?select=user_id'))
  console.log('A insert user_entitle.  ', await count(T, 'user_entitlements', { method: 'POST', body: JSON.stringify({ user_id: '95586f55-46db-46eb-ad11-ff9395be8d7c', plan_key: 'plus', status: 'active' }) }))
  console.log('A rpc sync_pull_v2      ', await count(T, 'rpc/sync_pull_v2', { method: 'POST', body: JSON.stringify({ p_since: null }) }))
  console.log('anon select profiles    ', await count(KEY, 'profiles?select=id'))
  console.log('anon rpc sync_pull_v2   ', await count(KEY, 'rpc/sync_pull_v2', { method: 'POST', body: JSON.stringify({ p_since: null }) }))
  console.log('anon rpc learn_sender_cur', await count(KEY, 'rpc/learn_sms_sender_currency', { method: 'POST', body: JSON.stringify({ p_user: B, p_sender: 'QAX', p_currency: 'USD', p_confirmed: true }) }))
  console.log('anon rpc bump_sms_sender', await count(KEY, 'rpc/bump_sms_sender', { method: 'POST', body: JSON.stringify({ p_sender: 'QAX', p_is_txn: true }) }))
}

if (step === 'brute') {
  // Wrong passwords against our own synthetic account, then the right one: does any lockout apply?
  for (let i = 1; i <= 8; i++) {
    const r = await signIn('qa-sec-3@buddget-qa.test', `wrong-${i}-${Date.now()}`)
    console.log('wrong', i, r.status, r.code ?? '', r.msg)
  }
  const ok = await signIn('qa-sec-3@buddget-qa.test', PW)
  console.log('correct after 8 fails', ok.status, ok.code ?? '', ok.token ? 'token issued' : 'no token')
}

if (step === '2fa') {
  // qa-sec-3 has two_factor_email_enabled; a password-only session should be refused by the PostgREST pre-request gate.
  const c = await signIn('qa-sec-3@buddget-qa.test', PW)
  console.log('signin C (password only)', c.status)
  const T = c.token
  console.log('C select own expenses    ', await count(T, 'expenses?select=id'))
  console.log('C select own profile     ', await count(T, 'profiles?select=id'))
  console.log('C insert own expense     ', await count(T, 'expenses', { method: 'POST', body: JSON.stringify({ user_id: '108c5141-7d2c-4f51-b9fc-0ba725fa108b', description: 'qa', category: 'Food', amount: 1, currency: 'EGP', expense_date: '2026-11-17' }) }))
  console.log('C rpc second_factor_status', await count(T, 'rpc/second_factor_status', { method: 'POST', body: '{}' }))
  console.log('C disable 2FA via PATCH  ', await count(T, 'user_settings?user_id=eq.108c5141-7d2c-4f51-b9fc-0ba725fa108b', { method: 'PATCH', body: JSON.stringify({ two_factor_email_enabled: false }) }))
}

if (step === 'net') {
  // Is the pg_net `net` schema reachable through PostgREST (SSRF)? Harmless target only.
  const a = await signIn('qa-sec-1@buddget-qa.test', PW)
  const r = await rest(a.token, 'rpc/http_get', { method: 'POST', headers: { 'Content-Profile': 'net' }, body: JSON.stringify({ url: 'https://example.com/' }) })
  const j = await r.json().catch(() => ({}))
  console.log('net.http_get via REST', r.status, j.code ?? '', (j.message ?? '').slice(0, 80))
  const g = await rest(a.token, 'rpc/http_get', { method: 'POST', headers: { 'Content-Profile': 'graphql_public' }, body: '{}' })
  console.log('graphql_public profile', g.status)
}

if (step === 'revoke-1') {
  const a = await signIn('qa-sec-1@buddget-qa.test', PW)
  const sid = JSON.parse(Buffer.from(a.token.split('.')[1], 'base64url').toString()).session_id
  const { writeFileSync } = await import('node:fs')
  writeFileSync(process.env.QA_PW_FILE.replace('qa_pw.txt', 'qa_tokA.txt'), a.token)
  console.log('A session', sid, 'before revoke', await count(a.token, 'expenses?select=id'))
}
if (step === 'revoke-2') {
  const tok = readFileSync(process.env.QA_PW_FILE.replace('qa_pw.txt', 'qa_tokA.txt'), 'utf8')
  console.log('A old JWT after session revoked: REST', await count(tok, 'expenses?select=id'))
  const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${tok}` } })
  console.log('A old JWT after session revoked: /auth/v1/user', u.status)
}

if (step === 'ttl') {
  const a = await signIn('qa-sec-1@buddget-qa.test', PW)
  const c = JSON.parse(Buffer.from(a.token.split('.')[1], 'base64url').toString())
  const h = JSON.parse(Buffer.from(a.token.split('.')[0], 'base64url').toString())
  console.log('jwt alg', h.alg, 'ttl seconds', c.exp - c.iat, 'amr', JSON.stringify(c.amr?.map((x) => x.method)))
}
