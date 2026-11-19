// S8c round 2: create synthetic users A/B/C (qa-api-1..3) with the fixed ids e2e/api/lib.mjs expects, plus B's seed rows.
// Usage: QA_PW_FILE=<path> node e2e/api/round2/setup.mjs   (teardown.mjs deletes them)
import { readFileSync } from 'node:fs'
import { SB_URL, USERS } from '../lib.mjs'
const env = Object.fromEntries(readFileSync(new URL('../../../.env.local', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]))
const PW = readFileSync(process.env.QA_PW_FILE, 'utf8').trim()
const H = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json' }
for (const [k, u] of Object.entries(USERS)) {
  const r = await fetch(`${SB_URL}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ id: u.id, email: u.email, password: PW, email_confirm: true }) })
  console.log('create', k, r.status)
}
const B = USERS.B.id
const ins = async (t, row) => console.log('seed', t, (await fetch(`${SB_URL}/rest/v1/${t}`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(row) })).status)
await ins('notifications', { id: 'bbbb0606-0000-4000-8000-0000000000a1', user_id: B, type: 'info', title: 'qa', message: 'qa' })
await ins('user_devices', { user_id: B, device_id: 'bbbb0606-0000-4000-8000-0000000000d1', platform: 'android', name: 'QA B phone' })
// B's money rows: targets for the cross-user RPC and link-guard specs (round2/*.spec.ts).
await ins('payment_methods', { id: 'bbbb0606-0000-4000-8000-0000000000b1', user_id: B, name: 'QA B bank', type: 'bank_account', currency: 'EGP', opening_balance: 1000 })
await ins('savings_accounts', { id: 'bbbb0606-0000-4000-8000-0000000000b2', user_id: B, name: 'QA B pocket', category: 'savings', currency: 'EGP', opening_balance: 500 })
await ins('debts', { id: 'bbbb0606-0000-4000-8000-0000000000b3', user_id: B, name: 'QA B loan', amount: 1000, currency: 'EGP', direction: 'i_owe' })
await ins('expenses', { id: 'bbbb0606-0000-4000-8000-0000000000b4', user_id: B, amount: 10, currency: 'EGP', category: 'Food', description: 'qa b', expense_date: '2026-11-18', payment_method_id: 'bbbb0606-0000-4000-8000-0000000000b1' })
await ins('sms_parse_log', { id: 'bbbb0606-0000-4000-8000-0000000000b5', user_id: B, source: 'manual', status: 'rejected', parse_method: 'static', payment_instrument: 'account' })

// --legacy-sec: the synthetic users and B rows that e2e/security/api-probe.mjs hard-codes (qa-sec-1..3).
// Do not run its revoke-1/revoke-2 steps unless QA_PW_FILE is named qa_pw.txt: they write a JWT to a path derived from it.
export const LEGACY_SEC = {
  A: { id: '95586f55-46db-46eb-ad11-ff9395be8d7c', email: 'qa-sec-1@buddget-qa.test' },
  B: { id: '126068f6-bdf9-46fe-976c-83d3552bac14', email: 'qa-sec-2@buddget-qa.test' },
  C: { id: '108c5141-7d2c-4f51-b9fc-0ba725fa108b', email: 'qa-sec-3@buddget-qa.test' },
}
if (process.argv.includes('--legacy-sec')) {
  for (const [k, u] of Object.entries(LEGACY_SEC)) {
    const r = await fetch(`${SB_URL}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ id: u.id, email: u.email, password: PW, email_confirm: true }) })
    console.log('create sec', k, r.status)
  }
  const SB = LEGACY_SEC.B.id
  await ins('payment_methods', { id: 'bbbbbbbb-0000-4000-8000-000000000001', user_id: SB, name: 'QA sec B bank', type: 'bank_account', currency: 'EGP' })
  await ins('debts', { id: 'bbbbbbbb-0000-4000-8000-000000000002', user_id: SB, name: 'QA sec B loan', amount: 100, currency: 'EGP', direction: 'i_owe' })
  await ins('savings_accounts', { id: 'bbbbbbbb-0000-4000-8000-000000000003', user_id: SB, name: 'QA sec B pocket', currency: 'EGP', opening_balance: 50 })
  await ins('expenses', { id: 'bbbbbbbb-0000-4000-8000-000000000004', user_id: SB, amount: 10, currency: 'EGP', category: 'Food', description: 'qa sec b', expense_date: '2026-11-18' })
  const st = await fetch(`${SB_URL}/rest/v1/user_settings?user_id=eq.${LEGACY_SEC.C.id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ two_factor_email_enabled: true }) })
  console.log('sec C 2fa on', st.status)
}
