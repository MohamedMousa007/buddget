// QA Session 06: atomicity / idempotency of the money RPCs under duplicate and concurrent submits (qa-api-1 only, via PostgREST).
// Usage: QA_PW_FILE=<path> node e2e/api/money-rpc.mjs
import { SB_URL, SB_KEY, signIn, USERS, redact } from './lib.mjs'

const A = (await signIn('A')).access_token
const rest = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SB_KEY, Authorization: `Bearer ${A}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } })
  const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, j, t: redact(t).slice(0, 160) }
}
const POCKET = 'cccc0606-0000-4000-8000-0000000000s1'.replace('s1', '51')
const DEBT = 'cccc0606-0000-4000-8000-000000000061'
const PM = 'cccc0606-0000-4000-8000-000000000071'
console.log('seed pm     ', (await rest('payment_methods', { method: 'POST', body: JSON.stringify({ id: PM, user_id: USERS.A.id, name: 'QA bank', type: 'bank_account', currency: 'EGP' }) })).status)
console.log('seed pocket ', (await rest('savings_accounts', { method: 'POST', body: JSON.stringify({ id: POCKET, user_id: USERS.A.id, name: 'QA pocket', category: 'savings', currency: 'EGP', opening_balance: 0 }) })).status)
console.log('seed debt   ', (await rest('debts', { method: 'POST', body: JSON.stringify({ id: DEBT, user_id: USERS.A.id, name: 'QA loan', amount: 1000, remaining_amount: 1000, currency: 'EGP', direction: 'i_owe' }) })).t)

const bal = async () => (await rest(`savings_accounts?id=eq.${POCKET}&select=current_balance`)).j?.[0]?.current_balance
const tally = (rs) => rs.reduce((m, r) => ((m[`${r.status} ${r.j?.code ?? ''}`.trim()] = (m[`${r.status} ${r.j?.code ?? ''}`.trim()] ?? 0) + 1), m), {})

// 1. Same transaction id deposited 8x concurrently: balance must move once.
const tx = crypto.randomUUID()
const dep = () => rest('rpc/deposit_to_savings_v2', { method: 'POST', body: JSON.stringify({ p_account_id: POCKET, p_amount: 100, p_currency: 'EGP', p_local_date: '2026-11-18', p_transaction_id: tx, p_notes: 'qa' }) })
const r1 = await Promise.all(Array.from({ length: 8 }, dep))
console.log('8x deposit same tx id      ', JSON.stringify(tally(r1)), 'balance', await bal(), 'sample', r1.find((r) => r.status >= 400)?.t ?? '')

// 2. Different tx ids concurrently: all 8 must land (no lost update).
const r2 = await Promise.all(Array.from({ length: 8 }, () => rest('rpc/deposit_to_savings_v2', { method: 'POST', body: JSON.stringify({ p_account_id: POCKET, p_amount: 10, p_currency: 'EGP', p_local_date: '2026-11-18', p_transaction_id: crypto.randomUUID() }) })))
console.log('8x deposit distinct ids    ', JSON.stringify(tally(r2)), 'balance', await bal(), '(expect 180)')

// 3. Concurrent withdrawals past the balance: floor must hold.
const r3 = await Promise.all(Array.from({ length: 6 }, () => rest('rpc/withdraw_from_savings_v2', { method: 'POST', body: JSON.stringify({ p_account_id: POCKET, p_amount: 50, p_currency: 'EGP', p_local_date: '2026-11-18', p_transaction_id: crypto.randomUUID() }) })))
console.log('6x withdraw 50 from 180    ', JSON.stringify(tally(r3)), 'balance', await bal(), '(expect 30, never < 0)', r3.find((r) => r.status >= 400)?.t ?? '')

// 4. Wrong inputs.
for (const [name, body] of [
  ['negative amount', { p_amount: -5 }], ['zero amount', { p_amount: 0 }], ['NaN amount', { p_amount: 'NaN' }], ['1e20 amount', { p_amount: 1e20 }],
  ['currency mismatch', { p_currency: 'USD' }], ['bad currency', { p_currency: 'XXX' }], ['null tx id', { p_transaction_id: null }],
  ['far future date', { p_local_date: '2999-01-01' }],
]) {
  const r = await rest('rpc/deposit_to_savings_v2', { method: 'POST', body: JSON.stringify({ p_account_id: POCKET, p_amount: 1, p_currency: 'EGP', p_local_date: '2026-11-18', p_transaction_id: crypto.randomUUID(), ...body }) })
  console.log(`deposit ${name.padEnd(18)}`, r.status, r.t)
}
console.log('balance after wrong inputs', await bal())

// 5. Debt payment with linked expense: same ids submitted 6x concurrently.
const payId = crypto.randomUUID(), expId = crypto.randomUUID()
const pay = () => rest('rpc/add_debt_payment_with_expense', { method: 'POST', body: JSON.stringify({
  p_payment: { id: payId, debt_id: DEBT, amount: 100, currency: 'EGP', payment_date: '2026-11-18', payment_method_id: PM, linked_expense_id: expId },
  p_expense: { id: expId, amount: 100, currency: 'EGP', category: 'debt_payment', description: 'QA loan payment', expense_date: '2026-11-18', payment_method_id: PM },
}) })
const r5 = await Promise.all(Array.from({ length: 6 }, pay))
console.log('6x debt payment same ids   ', JSON.stringify(tally(r5)), r5.find((r) => r.status >= 400)?.t ?? '', '| ok sample', r5.find((r) => r.status < 300)?.t ?? '')
const debt = await rest(`debts?id=eq.${DEBT}&select=remaining_amount`)
const pays = await rest(`debt_payments?debt_id=eq.${DEBT}&select=id`)
const exps = await rest(`expenses?id=eq.${expId}&select=id`)
console.log('debt remaining', debt.j?.[0]?.remaining_amount, 'payments', pays.j?.length, 'expenses', exps.j?.length, '(expect 900 / 1 / 1)')
