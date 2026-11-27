// QA Session 06: does numeric 'NaN' get past amount checks, and what does it break downstream? qa-api-1 only.
// Usage: QA_PW_FILE=<path> node e2e/api/nan-probe.mjs
import { SB_URL, SB_KEY, signIn, USERS, redact, call } from './lib.mjs'

const A = (await signIn('A')).access_token
const rest = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SB_KEY, Authorization: `Bearer ${A}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(init.headers ?? {}) } })
  return { status: r.status, t: redact(await r.text()).slice(0, 200) }
}
const id = (n) => `cccc0606-0000-4000-8000-0000000000${n}`
console.log('expense amount NaN       ', (await rest('expenses', { method: 'POST', body: JSON.stringify({ id: id('81'), user_id: USERS.A.id, amount: 'NaN', currency: 'EGP', category: 'food', description: 'qa nan', expense_date: '2026-11-18' }) })))
console.log('expense amount Infinity  ', (await rest('expenses', { method: 'POST', body: JSON.stringify({ id: id('82'), user_id: USERS.A.id, amount: 'Infinity', currency: 'EGP', category: 'food', description: 'qa inf', expense_date: '2026-11-18' }) })))
console.log('income amount NaN        ', (await rest('income_events', { method: 'POST', body: JSON.stringify({ id: id('83'), user_id: USERS.A.id, amount: 'NaN', currency: 'EGP', received_date: '2026-11-18' }) })))
console.log('pm opening_balance NaN   ', (await rest('payment_methods', { method: 'POST', body: JSON.stringify({ id: id('84'), user_id: USERS.A.id, name: 'QA nan pm', type: 'cash', currency: 'EGP', opening_balance: 'NaN' }) })))
const pull = await fetch(`${SB_URL}/rest/v1/rpc/sync_pull_v2`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${A}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_since: null }) })
const pt = await pull.text()
console.log('sync_pull_v2             ', pull.status, pt.length, 'bytes', /NaN/.test(pt) ? 'contains NaN' : 'no NaN', redact(pt).slice(0, 160))
let parsed = 'ok'; try { JSON.parse(pt) } catch (e) { parsed = `JSON.parse throws: ${e.message.slice(0, 60)}` }
console.log('client JSON.parse        ', parsed)
await call('POST /api/month-end propose (A)', { method: 'POST', path: '/api/month-end', token: A, body: { op: 'propose' } })
const bv = await fetch(`${SB_URL}/rest/v1/rpc/balance_view`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${A}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_payment_method: id('84') }) })
console.log('balance_view NaN pm      ', bv.status, redact(await bv.text()).slice(0, 200))
