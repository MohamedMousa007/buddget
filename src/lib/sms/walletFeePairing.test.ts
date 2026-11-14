import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'
vi.mock('./accountPlacement', async (orig) => ({
  ...(await orig<typeof import('./accountPlacement')>()),
  ensureProvisionalAccount: vi.fn(async () => 'prov-1'),
}))

import { createSmsTransaction } from './dispatch'
import type { SmsRowData } from './createSmsExpense'
import { transferFeeTolerance } from './pairing'

type Row = Record<string, unknown>

/** An in-memory service whose filters really filter, plus sms_try_pair as migration 0277 defines it (the fee tolerance only with p_fee_proven). */
function memService(tables: Record<string, Row[]>): ServiceClient {
  let seq = 0
  const from = (name: string) => {
    const rows = (tables[name] ??= [])
    const filters: ((r: Row) => boolean)[] = []
    let op: 'select' | 'insert' | 'update' = 'select'
    let payload: Row = {}
    let max = Infinity
    const run = () => {
      if (op === 'insert') {
        const row = { id: `${name}-${++seq}`, deleted_at: null, ...payload }
        rows.push(row)
        return [row]
      }
      const hit = rows.filter((r) => filters.every((f) => f(r)))
      if (op === 'update') hit.forEach((r) => Object.assign(r, payload))
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
      ilike: () => (filters.push(() => false), b),
      order: () => b,
      limit: (n: number) => ((max = n), b),
      maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown) => res({ data: run(), error: null }),
    }
    return b
  }
  const rpc = async (fn: string, p: Record<string, unknown>) => {
    if (fn !== 'sms_try_pair') return { data: null, error: null }
    const logs = tables.sms_parse_log
    const self = logs.find((l) => l.id === p.p_log_id) as Row
    if (self.paired_log_id) return { data: [], error: null }
    const at = Date.parse(p.p_received_at as string)
    const allow = p.p_fee_proven === true ? (p.p_amount_tolerance as number) : 0
    const hit = logs
      .filter((s) => s.user_id === p.p_user_id && s.id !== self.id && !s.paired_log_id && s.parsed_ok === true && (p.p_match_kinds as string[]).includes(s.kind as string))
      .filter((s) => !p.p_sibling_id || s.id === p.p_sibling_id)
      .filter((s) => Math.abs(Date.parse(s.received_at as string) - at) <= (p.p_window_seconds as number) * 1000)
      .filter((s) => Math.abs((s.amount as number) - (p.p_amount as number)) <= allow)
      .sort((a, b) => Math.abs(Date.parse(a.received_at as string) - at) - Math.abs(Date.parse(b.received_at as string) - at))[0]
    if (!hit) return { data: [], error: null }
    hit.paired_log_id = self.id
    self.paired_log_id = hit.id
    return { data: [{ sibling_id: hit.id, sibling_kind: hit.kind, sibling_expense_id: hit.expense_id ?? null, sibling_income_id: hit.income_id ?? null, sibling_status: hit.status }], error: null }
  }
  return { from, rpc } as unknown as ServiceClient
}

const U = 'u1'
const AT = '2026-10-27T10:00:00.000Z'
const plus = (ms: number) => new Date(Date.parse(AT) + ms).toISOString()

let db: Record<string, Row[]>
let svc: ServiceClient
beforeEach(() => {
  db = {
    expenses: [], sms_parse_log: [], income_events: [],
    payment_methods: [
      { id: 'w1', user_id: U, name: 'Barq', last4: null, type: 'wallet', deleted_at: null, closed_at: null },
      { id: 'w2', user_id: U, name: 'Telda', last4: null, type: 'wallet', deleted_at: null, closed_at: null },
    ],
  }
  svc = memService(db)
})

const seedLog = (id: string, over: Row) =>
  db.sms_parse_log.push({ id, user_id: U, currency: 'EGP', parsed_ok: false, status: 'processing', is_duplicate: false, awaiting_confirmation: false, paired_log_id: null, expense_id: null, income_id: null, ...over })
const log = (id: string) => db.sms_parse_log.find((l) => l.id === id) as Row

const row = (over: Partial<SmsRowData> & { logId: string }): SmsRowData => ({
  userId: U, amount: 105, currency: 'EGP', day: AT.slice(0, 10), kind: 'online_purchase', cleanTitle: null, merchantNormalized: null, merchant: 'Barq',
  bankName: 'CIB', categoryHint: null, source: 'sms', rawBody: 'Online purchase EGP 105 at Barq', last4: '4444', receivedAtIso: AT, ...over,
})
const walletCredit = (over: Partial<SmsRowData> & { logId: string }): SmsRowData =>
  row({ kind: 'income', amount: 100, merchant: null, bankName: null, last4: null, rawBody: 'Money added to your Barq wallet: EGP 100', receivedAtIso: plus(20_000), ...over })

const PERSON_KINDS = ['instant_transfer_in', 'instant_transfer_out', 'own_transfer']

/**
 * The route claims the log row with the raw body and the arrival time only, dispatch publishes kind, amount and the
 * account while pairing, and the route's final write then stores the APPLIED kind, with `merchant` and
 * `merchant_normalized` null for a transfer kind (hasPersonCounterparty), `clean_title` always, and the booked ids.
 */
async function book(input: SmsRowData, logRow: Row = {}) {
  seedLog(input.logId as string, { raw_body: input.rawBody, received_at: input.receivedAtIso, ...logRow })
  const tx = await createSmsTransaction(svc, input, { exchangeRates: {} })
  const kind = tx.kind ?? input.kind ?? ''
  const person = PERSON_KINDS.includes(kind)
  Object.assign(log(input.logId as string), {
    parsed_ok: true,
    status: tx.outcome === 'transfer_paired' ? 'paired' : 'confirmed',
    kind,
    amount: input.amount,
    account_last4: input.last4 ?? null,
    merchant: person ? null : input.merchant ?? null,
    merchant_normalized: person ? null : input.merchantNormalized ?? null,
    clean_title: input.cleanTitle ?? input.merchant ?? null,
    expense_id: tx.expenseId,
    income_id: tx.incomeId,
  })
  return tx
}
const live = (t: string) => db[t].filter((r) => r.deleted_at == null)

describe('N9 (I3, I7): a wallet top-up with a fee pairs on the wallet and the fee tolerance', () => {
  it('the bank debit of 105 first, the wallet credit of 100 second: one transfer, no income, the 5 fee booked as spending', async () => {
    await book(row({ logId: 'b1' }))
    const tx = await book(walletCredit({ logId: 'c1' }))
    expect(tx.outcome).toBe('transfer_paired')
    expect(live('income_events')).toHaveLength(0)
    const main = live('expenses').filter((e) => e.description !== 'Transfer fee')
    expect(main).toHaveLength(1)
    expect(main[0]).toMatchObject({ category: 'Transfer', amount: 105, sms_log_id: 'b1' })
    expect(live('expenses').filter((e) => e.description === 'Transfer fee')).toEqual([expect.objectContaining({ amount: 5, category: 'Other' })])
  })

  it('the wallet credit first, the bank debit second: the income row is retracted with the marker and one transfer remains', async () => {
    await book(walletCredit({ logId: 'c1' }))
    expect(live('income_events')).toHaveLength(1)
    expect(log('c1').kind).toBe('instant_transfer_in')
    const tx = await book(row({ logId: 'b1' }))
    expect(tx.outcome).toBe('transfer_paired')
    expect(db.income_events[0]).toMatchObject({ retracted_by_sms_log_id: 'b1' })
    expect(db.income_events[0].deleted_at).toEqual(expect.any(String))
    const main = live('expenses').filter((e) => e.description !== 'Transfer fee')
    expect(main).toHaveLength(1)
    expect(main[0]).toMatchObject({ category: 'Transfer', amount: 105 })
    expect(live('expenses').filter((e) => e.description === 'Transfer fee')).toHaveLength(1)
  })

  it('a debit that names a different wallet is not paired: the credit stays income', async () => {
    await book(row({ logId: 'b1', merchant: 'Telda', rawBody: 'Online purchase EGP 105 at Telda' }))
    const tx = await book(walletCredit({ logId: 'c1' }))
    expect(tx.outcome).not.toBe('transfer_paired')
    expect(live('income_events')).toHaveLength(1)
    expect(log('c1').paired_log_id).toBeNull()
  }, 15_000)

  it('a debit that is not a purchase at the wallet is not paired: the credit stays income', async () => {
    await book(row({ logId: 'b1', merchant: 'ACME STORE', rawBody: 'Online purchase EGP 105 at ACME STORE' }))
    const tx = await book(walletCredit({ logId: 'c1' }))
    expect(tx.outcome).not.toBe('transfer_paired')
    expect(live('income_events')).toHaveLength(1)
  }, 15_000)

  it('amounts further apart than the fee tolerance are not paired', async () => {
    const debit = 100 + transferFeeTolerance(100) + 10
    await book(row({ logId: 'b1', amount: debit }))
    const tx = await book(walletCredit({ logId: 'c1' }))
    expect(tx.outcome).not.toBe('transfer_paired')
    expect(live('income_events')).toHaveLength(1)
  }, 15_000)

  it('a credit larger than the debit is not paired', async () => {
    await book(row({ logId: 'b1', amount: 95 }))
    const tx = await book(walletCredit({ logId: 'c1' }))
    expect(tx.outcome).not.toBe('transfer_paired')
    expect(live('income_events')).toHaveLength(1)
  }, 15_000)
})

describe('N9 second half and the lone leg', () => {
  it('N9 (I3): a credit naming a wallet the user has not registered is booked as income and carries wallet_unregistered', async () => {
    const body = 'Money added to your Ziina wallet: EGP 100'
    await book(walletCredit({ logId: 'c1', rawBody: body }))
    expect(live('income_events')).toHaveLength(1)
    expect(live('income_events')[0].sms_flags).toEqual(['wallet_unregistered'])
  })

  it('N9: a credit naming a registered wallet does not carry the flag', async () => {
    await book(walletCredit({ logId: 'c1' }))
    expect(live('income_events')[0].sms_flags ?? null).toBeNull()
  }, 15_000)

  it('I3: a lone transfer leg whose only signal is the user\'s own name records no two-leg question', async () => {
    const body = 'Instant transfer of EGP 300 sent'
    await book(row({ logId: 'o1', kind: 'instant_transfer_out', amount: 300, merchant: null, counterpartyIsSelf: true, rawBody: body }))
    expect(log('o1').own_transfer_verdict).toBe('none')
  }, 15_000)
})

describe('cash switch, server half: a "no" books each new withdrawal as ordinary spending', () => {
  const atm = (): SmsRowData => row({ logId: 'a1', kind: 'atm_withdrawal', amount: 500, merchant: null, rawBody: 'ATM cash withdrawal EGP 500' })
  const withCash = () => db.payment_methods.push({ id: 'cash1', user_id: U, name: 'Cash', last4: null, type: 'cash', deleted_at: null, closed_at: null })
  const answer = (promptState: Row) => db.user_settings = [{ user_id: U, prompt_state: promptState }]

  it('unanswered: unchanged, a non-spend ATM row crediting the Cash account', async () => {
    withCash()
    const tx = await createSmsTransaction(svc, atm(), { exchangeRates: {} })
    expect(tx).toMatchObject({ outcome: 'atm', kind: 'atm_withdrawal', category: 'ATM Cash Withdrawal' })
    expect(db.expenses[0]).toMatchObject({ category: 'ATM Cash Withdrawal', to_payment_method_id: 'cash1' })
  })

  it('"no": an Other row titled Cash withdrawal, the Cash account not credited, the kind still atm_withdrawal', async () => {
    withCash()
    answer({ 'cashlog:no': '2026-11-02T10:00:00.000Z' })
    const tx = await createSmsTransaction(svc, atm(), { exchangeRates: {} })
    expect(tx).toMatchObject({ outcome: 'atm', kind: 'atm_withdrawal', category: 'Other' })
    expect(db.expenses[0]).toMatchObject({ category: 'Other', description: 'Cash withdrawal', to_payment_method_id: null })
  })

  it('a later "yes" over an earlier "no" leaves the withdrawal non-spend', async () => {
    withCash()
    answer({ 'cashlog:no': '2026-11-01T10:00:00.000Z', 'cashlog:yes': '2026-11-02T10:00:00.000Z' })
    await createSmsTransaction(svc, atm(), { exchangeRates: {} })
    expect(db.expenses[0]).toMatchObject({ category: 'ATM Cash Withdrawal', to_payment_method_id: 'cash1' })
  })
})

describe('card load (council 2026-11-14): "payment via card" that printed a balance of at least the payment', () => {
  const pay = (balance: string | null, over: Partial<SmsRowData> & { logId?: string } = {}): SmsRowData =>
    row({ logId: 'k1', merchant: null as never, kind: 'cc_payoff', kindSource: 'model', amount: 200, last4: '1234', bankName: 'CIB',
      rawBody: `Payment of EGP 200 via card ending 1234.${balance ? ` Card balance is EGP ${balance}` : ''}`, ...over })
  beforeEach(() => db.payment_methods.push({ id: 'card1', user_id: U, name: 'CIB Prepaid', last4: '1234', type: 'prepaid_card', deleted_at: null, closed_at: null }))

  it('I3: balance at least the payment: a Top up into the card, no source account, flagged card_load, kind still cc_payoff, not spending', async () => {
    const tx = await createSmsTransaction(svc, pay('500'), { exchangeRates: {} })
    expect(tx).toMatchObject({ kind: 'cc_payoff', category: 'Top up' })
    expect(db.expenses).toHaveLength(1)
    expect(db.expenses[0]).toMatchObject({ category: 'Top up', to_payment_method_id: 'card1', payment_method_id: null, sms_flags: ['card_load'] })
    expect(db.debts ?? []).toHaveLength(0)
  })

  it('balance smaller than the payment: spending flagged model_kind_unproven, as before', async () => {
    await createSmsTransaction(svc, pay('50'), { exchangeRates: {} })
    expect(db.expenses[0].category).not.toBe('Top up')
    expect(db.expenses[0].sms_flags).toEqual(['model_kind_unproven'])
  })

  it('I7: no readable balance, or a balance in another currency: as before', async () => {
    await createSmsTransaction(svc, pay(null), { exchangeRates: {} })
    expect(db.expenses[0].sms_flags).toEqual(['model_kind_unproven'])
    await createSmsTransaction(svc, pay('500', { logId: 'k2', rawBody: 'Payment of EGP 200 via card ending 1234. Card balance is USD 500' }), { exchangeRates: {} })
    expect(db.expenses[1].sms_flags).toEqual(['model_kind_unproven'])
  })

  it('a code-tier repayment is untouched by the rule', async () => {
    seedLog('k1', { kind: 'cc_payoff', amount: 200, received_at: AT })
    const tx = await createSmsTransaction(svc, pay('500', { kindSource: 'code' }), { exchangeRates: {} })
    expect(tx.outcome).toBe('awaiting_confirmation')
    expect(db.expenses).toHaveLength(0)
  })
})
