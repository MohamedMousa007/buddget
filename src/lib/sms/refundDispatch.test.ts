import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'

const h = vi.hoisted(() => ({ ensureProvisional: vi.fn(async () => 'prov-1') }))
vi.mock('./accountPlacement', async (orig) => ({
  ...(await orig<typeof import('./accountPlacement')>()),
  ensureProvisionalAccount: h.ensureProvisional,
}))

import { createSmsTransaction } from './dispatch'
import { createSmsExpense, type SmsRowData } from './createSmsExpense'
import { referenceHash } from './ownTransferDecision'

type Row = Record<string, unknown>

/**
 * An in-memory service whose filters really filter, unlike the query-builder stubs elsewhere, so a refund or decline
 * that reads the wrong row is caught here.
 */
function memService(tables: Record<string, Row[]>): ServiceClient {
  let seq = 0
  const from = (name: string) => {
    const rows = (tables[name] ??= [])
    const filters: ((r: Row) => boolean)[] = []
    let op: 'select' | 'insert' | 'update' = 'select'
    let payload: Row = {}
    let sort: { col: string; asc: boolean } | null = null
    let max = Infinity
    const run = () => {
      if (op === 'insert') {
        const row = { id: `${name}-${++seq}`, deleted_at: null, refunded_at: null, refund_kind: null, refund_sms_log_id: null, ...payload }
        rows.push(row)
        return [row]
      }
      let hit = rows.filter((r) => filters.every((f) => f(r)))
      if (op === 'update') {
        hit.forEach((r) => Object.assign(r, payload))
        return hit
      }
      if (sort) {
        const { col, asc } = sort
        hit = [...hit].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1))
      }
      return hit.slice(0, max)
    }
    const b: Record<string, unknown> = {
      select: () => b,
      insert: (p: Row) => ((op = 'insert'), (payload = p), b),
      update: (p: Row) => ((op = 'update'), (payload = p), b),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      neq: (c: string, v: unknown) => (filters.push((r) => r[c] != null && r[c] !== v), b),
      is: (c: string, v: unknown) => (filters.push((r) => (v === null ? r[c] == null : r[c] === v)), b),
      not: (c: string, _o: string, v: unknown) => (filters.push((r) => (v === null ? r[c] != null : r[c] !== v)), b),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
      gte: (c: string, v: string | number) => (filters.push((r) => r[c] != null && (r[c] as string | number) >= v), b),
      lte: (c: string, v: string | number) => (filters.push((r) => r[c] != null && (r[c] as string | number) <= v), b),
      order: (col: string, o?: { ascending?: boolean }) => ((sort = { col, asc: o?.ascending !== false }), b),
      limit: (n: number) => ((max = n), b),
      maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown) => res({ data: run(), error: null }),
    }
    return b
  }
  return { from } as unknown as ServiceClient
}

const U = 'u1'
const CARD = '4444'
const AT = '2026-10-27T10:00:00.000Z'
const plus = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString()
const SEC = 1000
const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

let db: Record<string, Row[]>
let svc: ServiceClient
beforeEach(() => {
  db = { expenses: [], sms_parse_log: [], income_events: [], payment_methods: [] }
  svc = memService(db)
  h.ensureProvisional.mockClear()
})

/** An earlier message that booked a row, plus that row (created by the message unless `handEntered`). */
function seed(o: { log: string; kind: string; amount?: number; last4?: string | null; at?: string; ref?: string | null; merchant?: string | null; handEntered?: boolean; description?: string }) {
  const at = o.at ?? AT
  const expenseId = `e-${o.log}`
  if (!o.handEntered) {
    db.sms_parse_log.push({
      id: o.log, user_id: U, kind: o.kind, amount: o.amount ?? 250, currency: 'EGP', account_last4: o.last4 === undefined ? CARD : o.last4,
      received_at: at, reference_hash: o.ref ? referenceHash(U, o.ref) : null, merchant_normalized: o.merchant ?? null, clean_title: null,
      expense_id: expenseId, is_duplicate: false,
    })
  }
  db.expenses.push({
    id: expenseId, user_id: U, amount: o.amount ?? 250, currency: 'EGP', description: o.description ?? 'row', category: 'Other',
    sms_log_id: o.handEntered ? null : o.log, deleted_at: null, refunded_at: null, refund_kind: null, refund_sms_log_id: null, payment_method_id: null,
    expense_date: at.slice(0, 10),
  })
  return expenseId
}
const expense = (id: string) => db.expenses.find((e) => e.id === id) as Row

const msg = (over: Partial<SmsRowData> & { logId: string }): SmsRowData => ({
  userId: U, amount: 250, currency: 'EGP', day: AT.slice(0, 10), kind: 'declined', cleanTitle: null, merchantNormalized: null, merchant: null,
  bankName: null, categoryHint: null, source: 'sms', rawBody: 'Your card transaction was declined', last4: CARD, receivedAtIso: AT, ...over,
})
const dispatch = (row: SmsRowData) => createSmsTransaction(svc, row, { exchangeRates: {} })
const refundMsg = (over: Partial<SmsRowData> & { logId: string }) =>
  msg({ kind: 'refund', rawBody: 'Your card was credited with the returned amount', ...over })
const ownRows = (log: string) => db.expenses.filter((e) => e.sms_log_id === log)

describe('I2: a decline changes nothing but its own row', () => {
  it('same amount, card and second as a purchase: the purchase is untouched, the decline books its own net-zero row', async () => {
    const purchase = seed({ log: 'p1', kind: 'purchase' })
    const tx = await dispatch(msg({ logId: 'd1' }))
    expect(tx.outcome).toBe('expense')
    expect(expense(purchase).refunded_at).toBeNull()
    expect(ownRows('d1')).toHaveLength(1)
    expect(ownRows('d1')[0]).toMatchObject({ refund_kind: 'declined', refund_sms_log_id: 'd1', refunded_at: AT.slice(0, 10) })
    expect(tx.expenseId).toBe(ownRows('d1')[0].id)
  })

  it('same result when the decline is processed first and the purchase second', async () => {
    await dispatch(msg({ logId: 'd1' }))
    const purchase = seed({ log: 'p1', kind: 'purchase' })
    expect(expense(purchase).refunded_at).toBeNull()
    expect(ownRows('d1')).toHaveLength(1)
    expect(db.expenses).toHaveLength(2)
  })

  it('refund kind with decline wording is a decline too', async () => {
    const purchase = seed({ log: 'p1', kind: 'purchase' })
    const tx = await dispatch(refundMsg({ logId: 'd1', rawBody: 'The transaction was rejected' }))
    expect(tx.outcome).toBe('expense')
    expect(expense(purchase).refunded_at).toBeNull()
    expect(ownRows('d1')[0]).toMatchObject({ refund_kind: 'declined' })
    expect(tx.kind).toBe('declined')
    expect(db.income_events).toHaveLength(0)
  })

  it('a decline, then a successful withdrawal 31 seconds later: the withdrawal is never stamped, in both orders', async () => {
    await dispatch(msg({ logId: 'd1', amount: 1000 }))
    const withdrawal = seed({ log: 'w1', kind: 'atm_withdrawal', amount: 1000, at: plus(AT, 31 * SEC) })
    expect(expense(withdrawal).refunded_at).toBeNull()

    db.expenses.length = 0
    db.sms_parse_log.length = 0
    const earlier = seed({ log: 'w2', kind: 'atm_withdrawal', amount: 1000, at: plus(AT, 31 * SEC) })
    await dispatch(msg({ logId: 'd2', amount: 1000 }))
    expect(expense(earlier).refunded_at).toBeNull()
    expect(ownRows('d2')).toHaveLength(1)
  })

  it('four identical declines on four consecutive days give one own row and three acknowledgements', async () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']
    const out = []
    for (const [i, day] of days.entries()) out.push(await dispatch(msg({ logId: `d${i + 1}`, day, receivedAtIso: `${day}T09:00:00.000Z` })))
    expect(out.map((t) => t.outcome)).toEqual(['expense', 'refund_matched', 'refund_matched', 'refund_matched'])
    expect(db.expenses).toHaveLength(1)
    expect(new Set(out.map((t) => t.expenseId)).size).toBe(1)
  })

  it('a decline is not acknowledged against a purchase that a refund stamped one day earlier', async () => {
    const purchase = seed({ log: 'p1', kind: 'purchase' })
    Object.assign(expense(purchase), { refunded_at: '2026-10-26', refund_kind: 'refunded', refund_sms_log_id: 'r-earlier' })
    const tx = await dispatch(msg({ logId: 'd1' }))
    expect(tx.outcome).toBe('expense')
    expect(tx.expenseId).not.toBe(purchase)
    expect(ownRows('d1')).toHaveLength(1)
    expect(expense(purchase)).toMatchObject({ refunded_at: '2026-10-26', refund_kind: 'refunded', refund_sms_log_id: 'r-earlier' })
  })

  it('a repeat is acknowledged only on the same payment method when this message names one', async () => {
    db.payment_methods.push({ id: 'pmA', user_id: U, name: 'Bank ••4444', last4: '4444', last4_aliases: [], deleted_at: null })
    db.expenses.push({
      id: 'old', user_id: U, amount: 250, currency: 'EGP', category: 'Other', sms_log_id: 'd0', refund_sms_log_id: 'd0', refund_kind: 'declined',
      refunded_at: '2026-10-27', deleted_at: null, payment_method_id: 'pmOther',
    })
    expect((await dispatch(msg({ logId: 'd1' }))).outcome).toBe('expense')
  })

  it('a decline never creates a provisional account', async () => {
    await dispatch(msg({ logId: 'd1', bankName: 'Some Bank', sender: 'SomeBank' }))
    expect(h.ensureProvisional).not.toHaveBeenCalled()
  })

  it('the same message without noProvisionalAccount does reach the creator', async () => {
    await createSmsExpense(svc, msg({ logId: 'x1', bankName: 'Some Bank', sender: 'SomeBank' }))
    expect(h.ensureProvisional).toHaveBeenCalled()
  })
})

describe('I1 exception 1: a refund stamps one earlier message row', () => {
  it('(a) 40 hours after a transfer out, same reference hash: stamped', async () => {
    const original = seed({ log: 't1', kind: 'instant_transfer_out', amount: 1000, last4: null, at: plus(AT, -40 * HOUR), ref: 'ab12cd34' })
    const tx = await dispatch(refundMsg({ logId: 'r1', amount: 1000, last4: null, referenceHash: referenceHash(U, 'AB12CD34') }))
    expect(tx).toMatchObject({ outcome: 'refund_matched', expenseId: original })
    expect(expense(original)).toMatchObject({ refunded_at: AT.slice(0, 10), refund_kind: 'refunded', refund_sms_log_id: 'r1' })
    expect(db.income_events).toHaveLength(0)
  })

  it('(a) a different or missing reference: not stamped, booked as the unmatched-refund expense, no income row', async () => {
    const original = seed({ log: 't1', kind: 'instant_transfer_out', amount: 1000, at: plus(AT, -40 * HOUR), ref: 'ab12cd34' })
    const tx = await dispatch(refundMsg({ logId: 'r0', amount: 1000, referenceHash: referenceHash(U, 'zz99yy88') }))
    expect(tx).toMatchObject({ outcome: 'refund_unmatched', incomeId: null })
    expect(expense(original).refunded_at).toBeNull()
    expect(ownRows('r0')).toHaveLength(1)
    expect(ownRows('r0')[0]).toMatchObject({ refund_kind: 'refunded', refund_sms_log_id: 'r0', sms_flags: ['refund_unmatched'], amount: 1000 })
    expect(db.income_events).toHaveLength(0)
  })

  it('(a) a missing reference on the refund is the same', async () => {
    const original = seed({ log: 't1', kind: 'instant_transfer_out', amount: 1000, at: plus(AT, -40 * HOUR), ref: 'ab12cd34' })
    const tx = await dispatch(refundMsg({ logId: 'r0', amount: 1000, referenceHash: null }))
    expect(tx.outcome).toBe('refund_unmatched')
    expect(expense(original).refunded_at).toBeNull()
    expect(db.income_events).toHaveLength(0)
  })

  it('(b) a "returned" credit 16 seconds after a transfer out, same tail and amount, no merchant: stamped', async () => {
    const original = seed({ log: 't1', kind: 'instant_transfer_out', amount: 700, at: AT })
    const tx = await dispatch(refundMsg({ logId: 'r1', amount: 700, receivedAtIso: plus(AT, 16 * SEC) }))
    expect(tx).toMatchObject({ outcome: 'refund_matched', expenseId: original })
    expect(expense(original)).toMatchObject({ refund_kind: 'refunded' })
  })

  it('(c) same merchant and tail, exact amount, 20 days earlier: stamped', async () => {
    const original = seed({ log: 'p1', kind: 'purchase', amount: 300, at: plus(AT, -20 * DAY), merchant: 'Spinneys' })
    const hit = await dispatch(refundMsg({ logId: 'r1', amount: 300, merchant: 'Spinneys' }))
    expect(hit).toMatchObject({ outcome: 'refund_matched', expenseId: original })
  })

  it('(c) a different merchant is not stamped', async () => {
    const original = seed({ log: 'p1', kind: 'purchase', amount: 300, at: plus(AT, -20 * DAY), merchant: 'Spinneys' })
    const miss = await dispatch(refundMsg({ logId: 'r0', amount: 300, merchant: 'Carrefour' }))
    expect(miss.outcome).toBe('refund_unmatched')
    expect(expense(original).refunded_at).toBeNull()
  })

  it('(b) a refund is not stamped on a purchase that was already refunded: the next candidate is tried', async () => {
    const first = seed({ log: 'p1', kind: 'purchase', amount: 300, at: plus(AT, -2 * MIN) })
    const second = seed({ log: 'p2', kind: 'purchase', amount: 300, at: plus(AT, -10 * MIN) })
    Object.assign(expense(first), { refunded_at: '2026-10-10', refund_kind: 'refunded', refund_sms_log_id: 'r-first' })
    const tx = await dispatch(refundMsg({ logId: 'r1', amount: 300 }))
    expect(tx).toMatchObject({ outcome: 'refund_matched', expenseId: second })
  })

  it('I6: an unmatched refund\'s own placeholder does not answer a second genuine refund of the same amount the next day', async () => {
    const first = await dispatch(refundMsg({ logId: 'r1', amount: 400, receivedAtIso: AT }))
    expect(first.outcome).toBe('refund_unmatched')
    const second = await dispatch(refundMsg({ logId: 'r2', amount: 400, day: '2026-10-28', receivedAtIso: plus(AT, DAY) }))
    expect(second.outcome).toBe('refund_unmatched')
    expect(ownRows('r2')).toHaveLength(1)
    expect(ownRows('r2')[0]).toMatchObject({ refund_kind: 'refunded', refund_sms_log_id: 'r2', sms_flags: ['refund_unmatched'] })
  })

  it('I6: a refund re-sent against a purchase that a refund already stamped is still acknowledged', async () => {
    const purchase = seed({ log: 'p1', kind: 'purchase', amount: 400, at: plus(AT, -2 * MIN) })
    await dispatch(refundMsg({ logId: 'r1', amount: 400 }))
    const again = await dispatch(refundMsg({ logId: 'r2', amount: 400, rawBody: 'The refunded amount was credited to your card', receivedAtIso: plus(AT, 2 * MIN) }))
    expect(again).toMatchObject({ outcome: 'refund_matched', expenseId: purchase })
    expect(ownRows('r2')).toHaveLength(0)
  })

  it('a hand-entered expense of the same amount is never stamped', async () => {
    const hand = seed({ log: 'h1', kind: 'purchase', amount: 300, at: AT, handEntered: true })
    const tx = await dispatch(refundMsg({ logId: 'r1', amount: 300 }))
    expect(tx.outcome).toBe('refund_unmatched')
    expect(expense(hand).refunded_at).toBeNull()
  })

  it('a row whose expense the message did not create is never stamped even when the log points at it', async () => {
    const id = seed({ log: 'p1', kind: 'purchase', amount: 300 })
    expense(id).sms_log_id = 'someone-else'
    expect((await dispatch(refundMsg({ logId: 'r1', amount: 300 }))).outcome).toBe('refund_unmatched')
    expect(expense(id).refunded_at).toBeNull()
  })

  it('a cash withdrawal, a fee row and a card repayment are never stamped', async () => {
    const atm = seed({ log: 'a1', kind: 'atm_withdrawal', amount: 300 })
    const fee = seed({ log: 'f1', kind: 'fee', amount: 300 })
    const repay = seed({ log: 'c1', kind: 'cc_payoff', amount: 300 })
    const feeRow = seed({ log: 'p9', kind: 'purchase', amount: 300, description: 'Transfer fee' })
    const tx = await dispatch(refundMsg({ logId: 'r1', amount: 300 }))
    expect(tx.outcome).toBe('refund_unmatched')
    for (const id of [atm, fee, repay, feeRow]) expect(expense(id).refunded_at).toBeNull()
  })

  it('a refund is not acknowledged against a decline\'s own row', async () => {
    const original = seed({ log: 'p1', kind: 'purchase', amount: 300 })
    await dispatch(msg({ logId: 'd1', amount: 300 }))
    const tx = await dispatch(refundMsg({ logId: 'r1', amount: 300 }))
    expect(tx).toMatchObject({ outcome: 'refund_matched', expenseId: original })
  })

  it('I7: a refund with no account tail does not hit window or merchant', async () => {
    const near = seed({ log: 'p1', kind: 'purchase', amount: 300, merchant: 'Spinneys' })
    const tx = await dispatch(refundMsg({ logId: 'r1', amount: 300, last4: null, merchant: 'Spinneys' }))
    expect(tx.outcome).toBe('refund_unmatched')
    expect(expense(near).refunded_at).toBeNull()
  })

  it('reversal wording with no original: the unmatched-refund expense, not a decline row and not income', async () => {
    const tx = await dispatch(refundMsg({ logId: 'r1', rawBody: 'The transaction was reversed to your card' }))
    expect(tx).toMatchObject({ outcome: 'refund_unmatched', incomeId: null })
    expect(db.income_events).toHaveLength(0)
    expect(ownRows('r1')[0]).toMatchObject({ refund_kind: 'refunded', sms_flags: ['refund_unmatched'] })
    expect(ownRows('r1')[0].refund_kind).not.toBe('declined')
  })
})

describe('createSmsExpense flags', () => {
  it('writes smsFlags on an income insert as well', async () => {
    await createSmsExpense(svc, msg({ logId: 'i1', kind: 'income', smsFlags: ['cash_deposit'] }))
    expect(db.income_events[0]).toMatchObject({ sms_log_id: 'i1', sms_flags: ['cash_deposit'] })
  })
  it('books a cash-machine deposit as a Transfer from the cash account to the message account, with no income row', async () => {
    db.payment_methods.push({ id: 'cash-1', user_id: U, type: 'cash', deleted_at: null, closed_at: null, created_at: AT })
    await createSmsExpense(svc, msg({ logId: 'd1', kind: 'own_transfer', destinationLeg: true, fromCash: true, smsFlags: ['cash_deposit'] }))
    expect(db.income_events).toHaveLength(0)
    expect(ownRows('d1')[0]).toMatchObject({ payment_method_id: 'cash-1', category: 'Transfer', sms_flags: ['cash_deposit'] })
    expect(ownRows('d1')[0].to_payment_method_id).toBeTruthy()
    expect(ownRows('d1')[0].to_payment_method_id).not.toBe('cash-1')
  })
  it('books the cash deposit with no source account when the user has no cash account', async () => {
    await createSmsExpense(svc, msg({ logId: 'd1', kind: 'own_transfer', destinationLeg: true, fromCash: true, smsFlags: ['cash_deposit'] }))
    expect(ownRows('d1')[0]).toMatchObject({ payment_method_id: null, category: 'Transfer' })
  })
  it('writes null when there are no flags', async () => {
    await createSmsExpense(svc, msg({ logId: 'i1', kind: 'income' }))
    expect(db.income_events[0].sms_flags).toBeNull()
  })
})
