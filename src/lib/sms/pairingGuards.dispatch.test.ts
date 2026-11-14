import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'

const h = vi.hoisted(() => ({
  ensureProvisional: vi.fn(async () => null as string | null),
  debt: vi.fn(),
}))
vi.mock('./accountPlacement', async (orig) => ({
  ...(await orig<typeof import('./accountPlacement')>()),
  ensureProvisionalAccount: h.ensureProvisional,
}))
vi.mock('./createSmsExpense', async (orig) => ({
  ...(await orig<typeof import('./createSmsExpense')>()),
  createSmsDebtPayment: (...args: unknown[]) => h.debt(...args),
}))

import { createSmsTransaction, type SmsTxResult } from './dispatch'
import type { SmsRowData } from './createSmsExpense'
import { pairGuardsAllow, reconcileCcPayoffFundingLeg, reconcileSibling, tryPairLeg, publishTransferLeg, transferFeeTolerance, type PairLegFacts, type PairSibling } from './pairing'
import { answerOneLegQuestion } from './ownAccountAnswer'
import { referenceHash } from './ownTransferDecision'

type Row = Record<string, unknown>

/**
 * An in-memory service whose filters really filter, with `sms_try_pair` implemented over the same pure guards as
 * migration 0271 (pairGuardsAllow), so a pairing rule that would claim the wrong row is caught here.
 */
function memService(tables: Record<string, Row[]>, rpcLog: Array<Record<string, unknown>>): ServiceClient {
  let seq = 0
  const from = (name: string) => {
    const rows = (tables[name] ??= [])
    const filters: ((r: Row) => boolean)[] = []
    let op: 'select' | 'insert' | 'update' | 'upsert' = 'select'
    let payload: Row = {}
    let max = Infinity
    const run = () => {
      if (op === 'insert') {
        const row = { id: `${name}-${++seq}`, deleted_at: null, retracted_by_sms_log_id: null, ...payload }
        rows.push(row)
        return [row]
      }
      if (op === 'upsert') {
        const key = (r: Row) => `${r.user_id}|${r.account_a}|${r.account_b}`
        const at = rows.findIndex((r) => key(r) === key(payload))
        if (at >= 0) rows[at] = { ...payload }
        else rows.push({ ...payload })
        return []
      }
      const hit = rows.filter((r) => filters.every((f) => f(r)))
      if (op === 'update') {
        hit.forEach((r) => Object.assign(r, payload))
        return hit
      }
      return hit.slice(0, max)
    }
    const b: Record<string, unknown> = {
      select: () => b,
      insert: (p: Row) => ((op = 'insert'), (payload = p), b),
      update: (p: Row) => ((op = 'update'), (payload = p), b),
      upsert: (p: Row) => ((op = 'upsert'), (payload = p), b),
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

  const facts = (r: Row): PairLegFacts => ({
    id: r.id as string,
    kind: (r.kind as string | null) ?? null,
    legDirection: (r.leg_direction as 'credit' | 'debit' | null) ?? null,
    status: (r.status as string | null) ?? null,
    isDuplicate: (r.is_duplicate as boolean | null) ?? false,
    awaitingConfirmation: (r.awaiting_confirmation as boolean | null) ?? false,
    accountLast4: (r.account_last4 as string | null) ?? null,
    currency: (r.currency as string | null) ?? null,
    amount: (r.amount as number | null) ?? null,
    counterpartyLast4: (r.counterparty_last4 as string | null) ?? null,
    counterpartyHash: (r.counterparty_hash as string | null) ?? null,
    counterpartyIsSelf: (r.counterparty_is_self as boolean | null) ?? null,
    referenceHash: (r.reference_hash as string | null) ?? null,
  })

  const rpc = async (_fn: string, p: Record<string, unknown>) => {
    rpcLog.push(p)
    const logs = tables.sms_parse_log
    const self = logs.find((l) => l.id === p.p_log_id)!
    if (self.paired_log_id) return { data: [], error: null }
    const at = Date.parse(p.p_received_at as string)
    const window = (p.p_window_seconds as number) * 1000
    const kinds = p.p_match_kinds as string[]
    const reference = (p.p_reference as string | undefined) ?? null
    const selfKind = (p.p_self_kind as string | undefined) ?? (self.kind as string)
    const hit = logs
      .filter((s) => s.user_id === p.p_user_id && s.id !== self.id && !s.paired_log_id && s.parsed_ok === true && kinds.includes(s.kind as string))
      .filter((s) => Math.abs(Date.parse(s.received_at as string) - at) <= window)
      .filter((s) => (reference ? String(s.raw_body ?? '').toLowerCase().includes(reference.toLowerCase()) : !p.p_require_equal_amount || Math.abs((s.amount as number) - (p.p_amount as number)) <= (selfKind === 'cc_payoff' || s.kind === 'cc_payoff' ? (p.p_amount_tolerance as number) : 0)))
      .filter((s) =>
        pairGuardsAllow(facts(self), facts(s), {
          selfKind: p.p_self_kind as string | undefined,
          selfDirection: ((p.p_direction as 'credit' | 'debit' | undefined) ?? undefined),
          selfCurrency: p.p_currency as string | undefined,
          siblingId: p.p_sibling_id as string | undefined,
          amountTolerance: p.p_amount_tolerance as number | undefined,
        }),
      )
      .sort((a, b) => Math.abs(Date.parse(a.received_at as string) - at) - Math.abs(Date.parse(b.received_at as string) - at))[0]
    if (!hit) return { data: [], error: null }
    hit.paired_log_id = self.id
    self.paired_log_id = hit.id
    return { data: [{ sibling_id: hit.id, sibling_kind: hit.kind, sibling_expense_id: hit.expense_id ?? null, sibling_income_id: hit.income_id ?? null, sibling_status: hit.status }], error: null }
  }
  return { from, rpc } as unknown as ServiceClient
}

const U = 'u1'
const T0 = '2026-11-01T10:00:00.000Z'
const at = (sec: number) => new Date(Date.parse(T0) + sec * 1000).toISOString()

let db: Record<string, Row[]>
let rpcLog: Array<Record<string, unknown>>
let svc: ServiceClient
beforeEach(() => {
  vi.useFakeTimers()
  db = { expenses: [], sms_parse_log: [], income_events: [], payment_methods: [], sms_own_transfer_answers: [] }
  rpcLog = []
  svc = memService(db, rpcLog)
  h.ensureProvisional.mockClear()
  h.debt.mockReset()
})
afterEach(() => { vi.useRealTimers() })

const pm = (id: string, name: string, last4: string, extra: Row = {}) =>
  db.payment_methods.push({ id, user_id: U, name, last4, last4_aliases: [], type: 'bank_account', provisional: false, closed_at: null, deleted_at: null, ...extra })

const log = (id: string) => db.sms_parse_log.find((l) => l.id === id) as Row
const liveExpenses = () => db.expenses.filter((e) => !e.deleted_at)
const liveIncomes = () => db.income_events.filter((e) => !e.deleted_at)

type RowOver = Partial<Omit<SmsRowData, 'logId'>>
const msg = (over: RowOver & { logId: string }): SmsRowData => ({
  userId: U, amount: 500, currency: 'EGP', day: '2026-11-01', kind: 'instant_transfer_out', cleanTitle: null, merchantNormalized: null, merchant: null,
  bankName: null, categoryHint: null, source: 'sms', rawBody: 'Account debited EGP 500', last4: '0001', receivedAtIso: T0, deviceId: 'dev-1', ...over,
})

/** The route's part of the pipeline: the log row exists (processing) before dispatch and is promoted with the result after. */
async function run(row: SmsRowData, opts: { userConfirmed?: boolean } = {}): Promise<SmsTxResult> {
  if (!log(row.logId as string)) {
    db.sms_parse_log.push({
      id: row.logId, user_id: U, status: 'processing', parsed_ok: false, kind: null, raw_body: row.rawBody, received_at: row.receivedAtIso,
      device_id: row.deviceId ?? null, paired_log_id: null, is_duplicate: false, awaiting_confirmation: false, expense_id: null, income_id: null,
      counterparty_last4: row.counterpartyLast4 ?? null, account_last4: row.last4 ?? null, currency: row.currency, amount: row.amount,
    })
  }
  const p = createSmsTransaction(svc, row, { exchangeRates: {}, ...opts })
  let result: SmsTxResult | undefined
  let failure: unknown
  void p.then((r) => { result = r }, (e) => { failure = e })
  while (!result && !failure) await vi.advanceTimersByTimeAsync(100)
  if (failure) throw failure
  const res = result as SmsTxResult
  Object.assign(log(row.logId as string), {
    status: res.outcome === 'awaiting_confirmation' ? 'logged' : res.outcome === 'transfer_paired' ? 'paired' : 'confirmed',
    awaiting_confirmation: res.outcome === 'awaiting_confirmation',
    kind: res.kind, expense_id: res.expenseId, income_id: res.incomeId,
    // Pairing may have retired this row's own money; the route would write what dispatch returned.
  })
  return res
}

describe('P0-3: own digits alone no longer settle a one-leg transfer the first time', () => {
  beforeEach(() => {
    pm('pm-a', 'HSBC Egypt', '0001')
    pm('pm-b', 'QNB', '5124')
  })
  const toOwn = (id: string, over: RowOver = {}) => msg({ logId: id, counterpartyLast4: '5124', ...over })

  it('first transfer to own registered digits, no answer: booked plain, asks once (ask_account, no candidate)', async () => {
    const tx = await run(toOwn('L1'))
    expect(tx.kind).toBe('instant_transfer_out')
    expect(liveExpenses()).toHaveLength(1)
    expect(liveExpenses()[0].category).not.toBe('Transfer')
    expect(log('L1')).toMatchObject({ own_transfer_verdict: 'ask_account', own_transfer_candidate: null, own_transfer_signals: ['account'] })
  })

  it('confirm_account: the row becomes a Transfer with the destination set, and the next one-leg transfer on that pair settles silently', async () => {
    await run(toOwn('L1'))
    const r = await answerOneLegQuestion(svc, U, log('L1') as never, 'confirm_account')
    expect(r).toEqual({ ok: true })
    expect(liveExpenses()[0]).toMatchObject({ category: 'Transfer', to_payment_method_id: 'pm-b' })
    expect(log('L1').own_transfer_verdict).toBe('settle')
    expect(db.sms_own_transfer_answers).toEqual([expect.objectContaining({ user_id: U, account_a: '0001', account_b: '5124', is_own: true })])

    const next = await run(toOwn('L2', { receivedAtIso: at(3600), amount: 120 }))
    expect(next.kind).toBe('own_transfer')
    const posted = db.expenses.find((e) => e.sms_log_id === 'L2')!
    expect(posted).toMatchObject({ category: 'Transfer', to_payment_method_id: 'pm-b', amount: 120 })
    expect(log('L2').own_transfer_verdict).not.toBe('ask_account')
  })

  it('decline_account: remembered, never asked again for that pair, and the row stays as booked', async () => {
    await run(toOwn('L1'))
    expect(await answerOneLegQuestion(svc, U, log('L1') as never, 'decline_account')).toEqual({ ok: true })
    expect(log('L1').own_transfer_verdict).toBe('declined')
    expect(liveExpenses()[0].category).not.toBe('Transfer')

    const next = await run(toOwn('L2', { receivedAtIso: at(3600) }))
    expect(next.kind).toBe('instant_transfer_out')
    expect(log('L2').own_transfer_verdict).not.toBe('ask_account')
    expect(db.expenses.find((e) => e.sms_log_id === 'L2')!.category).not.toBe('Transfer')
  })

  it('own tail unknown: the answer is stored under "-" and found by the next leg with no own tail', async () => {
    await run(toOwn('L1', { last4: null }))
    expect(log('L1').own_transfer_verdict).toBe('ask_account')
    await answerOneLegQuestion(svc, U, log('L1') as never, 'confirm_account')
    expect(db.sms_own_transfer_answers[0]).toMatchObject({ account_a: '-', account_b: '5124', is_own: true })

    const next = await run(toOwn('L2', { last4: null, receivedAtIso: at(3600) }))
    expect(next.kind).toBe('own_transfer')
  })

  it('a transfer in to own digits: confirm_account retracts the income with its cause and posts one Transfer from the digits\' account', async () => {
    const tx = await run(msg({ logId: 'L1', kind: 'instant_transfer_in', last4: '5124', counterpartyLast4: '0001', rawBody: 'Transfer received EGP 500' }))
    expect(tx.kind).toBe('instant_transfer_in')
    expect(liveIncomes()).toHaveLength(1)
    expect(log('L1').own_transfer_verdict).toBe('ask_account')

    expect(await answerOneLegQuestion(svc, U, log('L1') as never, 'confirm_account')).toEqual({ ok: true })
    expect(liveIncomes()).toHaveLength(0)
    expect(db.income_events[0]).toMatchObject({ retracted_by_sms_log_id: 'L1' })
    expect(liveExpenses()).toHaveLength(1)
    expect(liveExpenses()[0]).toMatchObject({ category: 'Transfer', sms_log_id: 'L1', payment_method_id: 'pm-a', to_payment_method_id: 'pm-b', amount: 500 })
    expect(log('L1')).toMatchObject({ kind: 'own_transfer', income_id: null, expense_id: liveExpenses()[0].id, own_transfer_verdict: 'settle' })
  })

  it('P2-16: a question whose row is gone is cleared, not stuck', async () => {
    await run(toOwn('L1'))
    db.expenses.forEach((e) => (e.deleted_at = '2026-11-02T00:00:00Z'))
    expect(await answerOneLegQuestion(svc, U, log('L1') as never, 'confirm_account')).toEqual({ ok: true, stale: true })
    expect(log('L1').own_transfer_verdict).toBe('none')
  })

  it('digits that are not a confirmed account (provisional only) never settle and never ask this way', async () => {
    db.payment_methods.length = 0
    pm('pm-a', 'HSBC Egypt', '0001')
    pm('pm-p', 'Provisional', '5124', { provisional: true })
    await run(toOwn('L1'))
    expect(log('L1').own_transfer_verdict).not.toBe('ask_account')
    expect(liveExpenses()[0].category).not.toBe('Transfer')
  })

  it('a stored yes does not settle a transfer whose counterparty digits are no account of the user', async () => {
    db.sms_own_transfer_answers.push({ user_id: U, account_a: '0001', account_b: '9999', is_own: true })
    const tx = await run(toOwn('L1', { counterpartyLast4: '9999' }))
    expect(tx.kind).toBe('instant_transfer_out')
  })

  it('N5 end to end: digits printed shorter than the saved account still count when the message bank is the account\'s bank', async () => {
    await run(toOwn('L1', { counterpartyLast4: '001', last4: '5124', bankName: 'HSBC Egypt', providerKey: 'hsbceg' }))
    expect(log('L1').own_transfer_verdict).toBe('ask_account')
  })
})

describe('P0-2: a card repayment claims only a funding leg that could have paid it', () => {
  const seedFunding = (over: Row = {}) => {
    db.sms_parse_log.push({
      id: 'F', user_id: U, kind: 'instant_transfer_out', parsed_ok: true, status: 'confirmed', amount: 1000, currency: 'EGP', account_last4: '1234', received_at: at(-20),
      expense_id: 'eF', income_id: null, paired_log_id: null, is_duplicate: false, awaiting_confirmation: false, raw_body: 'x', leg_direction: 'debit', ...over,
    })
    db.expenses.push({ id: 'eF', user_id: U, sms_log_id: 'F', amount: 1000, category: 'Instapay', deleted_at: null })
  }
  const repayment = (over: RowOver = {}) => msg({ logId: 'C', kind: 'cc_payoff', amount: 1000, last4: '4444', rawBody: 'Payment of EGP 1000 received on your card', ...over })

  beforeEach(() => {
    pm('pm-f', 'Bank', '1234')
    h.debt.mockResolvedValue({ expenseId: 'dp-exp', incomeId: null, debtPaymentId: 'dp-1', error: null })
  })

  it('a transfer out that names another person is not claimed or retired', async () => {
    seedFunding({ counterparty_hash: 'h-person', counterparty_is_self: false })
    const tx = await run(repayment())
    expect(tx.outcome).toBe('debt_payment')
    expect(log('F').paired_log_id).toBeNull()
    expect(db.expenses.find((e) => e.id === 'eF')!.deleted_at).toBeNull()
  })

  it('a transfer out that names other digits is not claimed', async () => {
    seedFunding({ counterparty_last4: '9999' })
    await run(repayment())
    expect(log('F').paired_log_id).toBeNull()
    expect(db.expenses.find((e) => e.id === 'eF')!.deleted_at).toBeNull()
  })

  it('a funding leg with no destination digits and the exact amount is claimed and retired with its cause', async () => {
    seedFunding()
    await run(repayment())
    expect(log('F').paired_log_id).toBe('C')
    expect(db.expenses.find((e) => e.id === 'eF')).toMatchObject({ retracted_by_sms_log_id: 'C' })
    expect(h.debt).toHaveBeenCalledWith(expect.anything(), expect.anything(), { fundingLast4: '1234' })
  })

  it('a fee difference does not pair without matching digits or a shared reference', async () => {
    seedFunding({ amount: 1012 })
    await run(repayment())
    expect(log('F').paired_log_id).toBeNull()
  })

  it('a fee difference pairs when the funding leg names the card\'s digits', async () => {
    seedFunding({ amount: 1012, counterparty_last4: '4444' })
    await run(repayment())
    expect(log('F').paired_log_id).toBe('C')
  })

  it('a fee difference pairs on a shared payment reference', async () => {
    seedFunding({ amount: 1012, reference_hash: referenceHash(U, 'ab12cd34') })
    await run(repayment({ referenceHash: referenceHash(U, 'ab12cd34') }))
    expect(log('F').paired_log_id).toBe('C')
  })
})

describe('hole a: decide first, retire second', () => {
  beforeEach(() => {
    pm('pm-f', 'Bank', '1234')
    db.sms_parse_log.push({
      id: 'F', user_id: U, kind: 'own_transfer', parsed_ok: true, status: 'confirmed', amount: 1000, currency: 'EGP', account_last4: '1234', received_at: at(-20),
      expense_id: 'eF', income_id: null, paired_log_id: null, is_duplicate: false, awaiting_confirmation: false, raw_body: 'x', leg_direction: 'debit',
    })
    db.expenses.push({ id: 'eF', user_id: U, sms_log_id: 'F', amount: 1000, category: 'Transfer', deleted_at: null, payment_method_id: 'pm-f' })
    h.debt.mockResolvedValue({ expenseId: null, incomeId: null, debtPaymentId: null, error: null, needsConfirm: true })
  })
  const repayment = (over: RowOver = {}) => msg({ logId: 'C', kind: 'cc_payoff', amount: 1000, last4: '4444', rawBody: 'Payment of EGP 1000 received on your card', ...over })

  it('a repayment that needs the user leaves the funding row live and both logs unpaired', async () => {
    const tx = await run(repayment())
    expect(tx.outcome).toBe('awaiting_confirmation')
    expect(db.expenses.find((e) => e.id === 'eF')).toMatchObject({ deleted_at: null })
    expect(db.expenses.find((e) => e.id === 'eF')!.retracted_by_sms_log_id ?? null).toBeNull()
    expect(log('F').paired_log_id).toBeNull()
    expect(log('C').paired_log_id).toBeNull()
    expect(log('F').expense_id).toBe('eF')
  })

  it('after confirmation the plain CC Payoff expense carries the funding account and the funding row is retired with the marker', async () => {
    await run(repayment())
    const tx = await run(repayment(), { userConfirmed: true })
    expect(tx).toMatchObject({ outcome: 'expense', category: 'CC Payoff' })
    const own = db.expenses.find((e) => e.sms_log_id === 'C')!
    expect(own).toMatchObject({ category: 'CC Payoff', payment_method_id: 'pm-f' })
    expect(db.expenses.find((e) => e.id === 'eF')).toMatchObject({ retracted_by_sms_log_id: 'C' })
    expect(db.expenses.find((e) => e.id === 'eF')!.deleted_at).toEqual(expect.any(String))
  })

  it('a repayment that posts retires the funding row in the same pass', async () => {
    h.debt.mockResolvedValue({ expenseId: 'dp-exp', incomeId: null, debtPaymentId: 'dp-1', error: null })
    await run(repayment())
    expect(db.expenses.find((e) => e.id === 'eF')).toMatchObject({ retracted_by_sms_log_id: 'C' })
  })

  it('a repayment whose posting failed releases the claim and retires nothing', async () => {
    h.debt.mockResolvedValue({ expenseId: null, incomeId: null, debtPaymentId: null, error: { message: 'down' } })
    await run(repayment())
    expect(db.expenses.find((e) => e.id === 'eF')!.deleted_at).toBeNull()
    expect(log('F').paired_log_id).toBeNull()
  })
})

describe('hole b: a settled pair whose legs name each other by name only credits the destination', () => {
  beforeEach(() => {
    pm('pm-a', 'HSBC Egypt', '0001')
    pm('pm-b', 'QNB', '5124')
  })
  const OUT = 'Account 0001 debited with IPN outward transfer EGP 2002.00 to SAMPLE PERSON with reference ab12cd34'
  const IN = 'IPN transfer received EGP 2000.00 on 5124. Ref# ab12cd34.'
  const ref = referenceHash(U, 'ab12cd34')
  const outLeg = () => msg({ logId: 'O', amount: 2002, rawBody: OUT, last4: '0001', merchant: 'SAMPLE PERSON', receivedAtIso: at(30), referenceHash: ref })
  const inLeg = () => msg({ logId: 'I', kind: 'instant_transfer_in', amount: 2000, rawBody: IN, last4: '5124', receivedAtIso: at(0), referenceHash: ref })

  it('outbound first, inbound second: the kept row gets the receiving account as its destination', async () => {
    await run(outLeg())
    expect(db.expenses[0].to_payment_method_id ?? null).toBeNull()
    const tx = await run(inLeg())
    expect(tx.outcome).toBe('transfer_paired')
    expect(liveExpenses()).toHaveLength(1)
    expect(liveExpenses()[0]).toMatchObject({ category: 'Transfer', to_payment_method_id: 'pm-b', payment_method_id: 'pm-a' })
    expect(liveIncomes()).toHaveLength(0)
  })

  it('inbound first, outbound second: the single Transfer row takes the retracted credit leg\'s account as its destination', async () => {
    await run(inLeg())
    const tx = await run(outLeg())
    expect(tx.outcome).toBe('transfer_paired')
    expect(liveIncomes()).toHaveLength(0)
    expect(db.income_events[0]).toMatchObject({ retracted_by_sms_log_id: 'O' })
    expect(liveExpenses()).toHaveLength(1)
    expect(liveExpenses()[0]).toMatchObject({ category: 'Transfer', to_payment_method_id: 'pm-b', payment_method_id: 'pm-a' })
  })

  it('a destination already on the kept row is never overwritten', async () => {
    await run(outLeg())
    db.expenses[0].to_payment_method_id = 'pm-other'
    await run(inLeg())
    expect(db.expenses[0].to_payment_method_id).toBe('pm-other')
  })

  it('step 1b claims only the sibling it read', async () => {
    await run(outLeg())
    await run(inLeg())
    expect(rpcLog.at(-1)).toMatchObject({ p_sibling_id: 'O', p_direction: 'credit', p_currency: 'EGP' })
  })
})

describe('Part 7: a claimed sibling with no money row', () => {
  beforeEach(() => {
    pm('pm-a', 'HSBC Egypt', '0001')
    pm('pm-b', 'QNB', '5124')
  })
  const ref = referenceHash(U, 'ab12cd34')

  it('1b: both log rows are unpaired and this leg books its plain kind; nothing vanishes', async () => {
    db.sms_parse_log.push({
      id: 'I', user_id: U, kind: 'instant_transfer_in', parsed_ok: true, status: 'confirmed', amount: 2000, currency: 'EGP', account_last4: '5124', received_at: at(0),
      expense_id: null, income_id: null, paired_log_id: null, is_duplicate: false, awaiting_confirmation: false, raw_body: 'IPN transfer received. Ref# ab12cd34.', device_id: 'dev-1',
    })
    const tx = await run(msg({ logId: 'O', amount: 2002, rawBody: 'Account 0001 debited IPN outward transfer with reference ab12cd34', receivedAtIso: at(30), referenceHash: ref }))
    expect(tx.outcome).toBe('expense')
    expect(log('I').paired_log_id).toBeNull()
    expect(log('O').paired_log_id).toBeNull()
    expect(liveExpenses()).toHaveLength(1)
    expect(liveExpenses()[0].category).not.toBe('Transfer')
  })

  it('step 2: an own transfer whose sibling posted nothing is unpaired and posts its own row', async () => {
    db.sms_parse_log.push({
      id: 'S', user_id: U, kind: 'own_transfer', parsed_ok: true, status: 'confirmed', amount: 500, currency: 'EGP', account_last4: '5124', received_at: at(0),
      expense_id: null, income_id: null, paired_log_id: null, is_duplicate: false, awaiting_confirmation: false, raw_body: 'x', leg_direction: 'credit',
    })
    const tx = await run(msg({ logId: 'O', kind: 'own_transfer', last4: '0001', receivedAtIso: at(10) }))
    expect(tx.outcome).toBe('transfer_single')
    expect(log('S').paired_log_id).toBeNull()
    expect(log('O').paired_log_id).toBeNull()
    expect(liveExpenses()).toHaveLength(1)
  })
})

describe('P1-7: provenance, not the bare kind', () => {
  beforeEach(() => {
    pm('pm-a', 'HSBC Egypt', '0001')
    pm('pm-w', 'Barq', '', { type: 'wallet' })
  })

  it('a repayment from the model worded "via card" is spending, flagged, and reduces no debt', async () => {
    const tx = await run(msg({ logId: 'L1', kind: 'cc_payoff', kindSource: 'model', amount: 950, currency: 'SAR', last4: '1234', merchant: 'SAMPLE SHOP', rawBody: 'Payment of SAR 950.00 via card ••1234 at SAMPLE SHOP' }))
    expect(tx.kind).toBe('purchase')
    expect(tx.outcome).toBe('expense')
    expect(h.debt).not.toHaveBeenCalled()
    expect(db.expenses[0]).toMatchObject({ sms_log_id: 'L1', sms_flags: ['model_kind_unproven'] })
    expect(db.expenses[0].category).not.toBe('CC Payoff')
    expect(rpcLog).toHaveLength(0)
  })

  it('the same wording from a code tier stays a repayment', async () => {
    h.debt.mockResolvedValue({ expenseId: 'dp-exp', incomeId: null, debtPaymentId: 'dp-1', error: null })
    const tx = await run(msg({ logId: 'L1', kind: 'cc_payoff', kindSource: 'code', amount: 950, last4: '1234', rawBody: 'Payment of SAR 950.00 via card ••1234 at SAMPLE SHOP' }))
    expect(tx.outcome).toBe('debt_payment')
  })

  it('a repayment from the model worded "paid into your card" with NO registered debt stays non-spend', async () => {
    h.debt.mockResolvedValue({ expenseId: null, incomeId: null, debtPaymentId: null, error: null, needsConfirm: true })
    const first = await run(msg({ logId: 'L1', kind: 'cc_payoff', kindSource: 'model', amount: 1724, last4: '1234', rawBody: 'An amount of EGP 1,724.00 was paid into your credit card ending 1234' }))
    expect(first.outcome).toBe('awaiting_confirmation')
    expect(liveExpenses()).toHaveLength(0)
    const confirmed = await run(msg({ logId: 'L1', kind: 'cc_payoff', kindSource: 'code', amount: 1724, last4: '1234', rawBody: 'An amount of EGP 1,724.00 was paid into your credit card ending 1234' }), { userConfirmed: true })
    expect(confirmed).toMatchObject({ outcome: 'expense', category: 'CC Payoff' })
  })

  it('a repayment from the model with neither wording keeps the repayment path', async () => {
    h.debt.mockResolvedValue({ expenseId: 'dp-exp', incomeId: null, debtPaymentId: 'dp-1', error: null })
    const tx = await run(msg({ logId: 'L1', kind: 'cc_payoff', kindSource: 'model', amount: 950, last4: '1234', rawBody: 'Credit card payment received' }))
    expect(tx.outcome).toBe('debt_payment')
  })

  it('an own transfer only the model asserted, with no sibling: booked as its plain kind by direction, flagged', async () => {
    const tx = await run(msg({ logId: 'L1', kind: 'own_transfer', kindSource: 'model', amount: 300, rawBody: 'EGP 300.00- sent' }))
    expect(tx.kind).toBe('instant_transfer_out')
    expect(tx.outcome).toBe('expense')
    expect(db.expenses[0]).toMatchObject({ sms_log_id: 'L1', sms_flags: ['model_kind_unproven'] })
    expect(db.expenses[0].category).not.toBe('Transfer')
  })

  it('an own transfer only the model asserted, shown as a credit, is booked as income', async () => {
    const tx = await run(msg({ logId: 'L1', kind: 'own_transfer', kindSource: 'model', amount: 300, last4: '0001', rawBody: 'EGP 300.00+ received' }))
    expect(tx.kind).toBe('instant_transfer_in')
    expect(liveExpenses()).toHaveLength(0)
    expect(db.income_events[0]).toMatchObject({ sms_log_id: 'L1', sms_flags: ['model_kind_unproven'] })
  })

  it('an own transfer the model asserted that finds a sibling still pairs', async () => {
    db.sms_parse_log.push({
      id: 'S', user_id: U, kind: 'instant_transfer_in', parsed_ok: true, status: 'confirmed', amount: 300, currency: 'EGP', account_last4: '5124', received_at: at(0),
      expense_id: 'eS', income_id: null, paired_log_id: null, is_duplicate: false, awaiting_confirmation: false, raw_body: 'x',
    })
    db.expenses.push({ id: 'eS', user_id: U, sms_log_id: 'S', amount: 300, category: 'Other', deleted_at: null })
    const tx = await run(msg({ logId: 'L1', kind: 'own_transfer', kindSource: 'model', amount: 300, receivedAtIso: at(5), rawBody: 'EGP 300.00- sent' }))
    expect(tx.outcome).toBe('transfer_paired')
  })

  it('an own transfer the model asserted with no source set is treated as code (existing callers are unchanged)', async () => {
    const tx = await run(msg({ logId: 'L1', kind: 'own_transfer', amount: 300, rawBody: 'EGP 300.00- sent' }))
    expect(tx).toMatchObject({ kind: 'own_transfer', outcome: 'transfer_single' })
  })

  it('an own wallet top-up by name is still a transfer, even from the model', async () => {
    const tx = await run(msg({ logId: 'L1', kind: 'online_purchase', kindSource: 'model', amount: 200, merchant: 'Barq', last4: '0001', rawBody: 'Online purchase EGP 200 at Barq' }))
    expect(tx.kind).toBe('own_transfer')
    expect(db.expenses[0]).toMatchObject({ category: 'Transfer' })
    expect(db.expenses[0].sms_flags ?? null).toBeNull()
  })
})

describe('P2-16: a retracted row clears the question on its log', () => {
  const sibling = (over: Partial<PairSibling> = {}): PairSibling => ({ siblingId: 'A', siblingKind: 'instant_transfer_in', siblingExpenseId: null, siblingIncomeId: 'inc-A', siblingStatus: 'confirmed', ...over })
  beforeEach(() => {
    db.sms_parse_log.push(
      { id: 'A', user_id: U, own_transfer_verdict: 'ask', own_transfer_candidate: 'B', status: 'confirmed' },
      { id: 'B', user_id: U, own_transfer_verdict: 'ask', own_transfer_candidate: 'A', status: 'confirmed' },
    )
    db.income_events.push({ id: 'inc-A', user_id: U, sms_log_id: 'A', deleted_at: null })
    db.expenses.push({ id: 'exp-A', user_id: U, sms_log_id: 'A', deleted_at: null })
  })

  it('reconcileSibling clears an open ask on the retracted row\'s log and on its candidate', async () => {
    await reconcileSibling(svc, sibling(), 'C')
    expect(log('A')).toMatchObject({ own_transfer_verdict: 'none', own_transfer_candidate: null })
    expect(log('B')).toMatchObject({ own_transfer_verdict: 'none', own_transfer_candidate: null })
  })

  it('reconcileCcPayoffFundingLeg clears an open ask_account the same way', async () => {
    log('A').own_transfer_verdict = 'ask_account'
    log('A').own_transfer_candidate = null
    await reconcileCcPayoffFundingLeg(svc, sibling({ siblingIncomeId: null, siblingExpenseId: 'exp-A', siblingKind: 'own_transfer' }), 'C')
    expect(log('A').own_transfer_verdict).toBe('none')
    expect(log('B').own_transfer_verdict).toBe('ask')
  })

  it('a settled or declined verdict is left alone', async () => {
    log('A').own_transfer_verdict = 'declined'
    await reconcileSibling(svc, sibling(), 'C')
    expect(log('A').own_transfer_verdict).toBe('declined')
    expect(log('B').own_transfer_verdict).toBe('ask')
  })
})

describe('what is published before a claim, and what is sent with it', () => {
  beforeEach(() => {
    db.sms_parse_log.push({ id: 'L', user_id: U, status: 'processing', parsed_ok: false, paired_log_id: null })
  })

  it('tryPairLeg publishes every known guard fact and sends direction, currency and the named sibling for any kind', async () => {
    const claim = tryPairLeg(svc, {
      userId: U, logId: 'L', receivedAtIso: T0, amount: 100, kind: 'own_transfer', accountLast4: '0001', currency: 'EGP', direction: 'debit',
      counterpartyLast4: '5124', counterpartyHash: 'h', counterpartyIsSelf: false, referenceHash: 'r', siblingId: 'S',
    })
    await vi.advanceTimersByTimeAsync(1000)
    await claim
    expect(log('L')).toMatchObject({
      kind: 'own_transfer', parsed_ok: true, amount: 100, account_last4: '0001', currency: 'EGP', leg_direction: 'debit',
      counterparty_last4: '5124', counterparty_hash: 'h', counterparty_is_self: false, reference_hash: 'r',
    })
    expect(rpcLog[0]).toMatchObject({ p_direction: 'debit', p_currency: 'EGP', p_sibling_id: 'S', p_self_kind: 'own_transfer' })
  })

  it('unknown facts are never written (I7): nothing is blanked and nothing invented', async () => {
    await publishTransferLeg(svc, { logId: 'L', kind: 'instant_transfer_out', amount: 100, accountLast4: null })
    expect(Object.keys(log('L')).sort()).toEqual(['amount', 'id', 'kind', 'paired_log_id', 'parsed_ok', 'status', 'user_id'].sort())
    expect(transferFeeTolerance(1000)).toBeGreaterThan(0)
  })
})

describe('P0-2/P0-3 order independence: a funding leg that arrives after the card bank\'s repayment', () => {
  beforeEach(() => {
    pm('pm-f', 'Bank', '1234')
    pm('pm-card', 'Card', '4444')
    db.sms_parse_log.push({
      id: 'C', user_id: U, kind: 'cc_payoff', parsed_ok: true, status: 'confirmed', amount: 1000, currency: 'EGP', account_last4: '4444', received_at: at(-20),
      expense_id: 'eC', income_id: null, paired_log_id: null, is_duplicate: false, awaiting_confirmation: false, raw_body: 'x', leg_direction: 'credit', debt_payment_id: null,
    })
    db.expenses.push({ id: 'eC', user_id: U, sms_log_id: 'C', amount: 1000, category: 'CC Payoff', deleted_at: null, payment_method_id: null })
    h.debt.mockResolvedValue({ expenseId: 'dp-exp', incomeId: null, debtPaymentId: 'dp-1', error: null })
  })
  const funding = (over: RowOver = {}) => msg({ logId: 'F', amount: 1012, last4: '1234', counterpartyLast4: '4444', rawBody: 'Account debited EGP 1012', ...over })
  const spending = () => liveExpenses().filter((e) => e.sms_log_id === 'F')

  it('registered own digits, no stored answer: the repayment row gets the funding account, the fee is posted, no spending row, no question', async () => {
    const tx = await run(funding())
    expect(tx).toMatchObject({ outcome: 'transfer_paired', kind: 'own_transfer' })
    expect(db.expenses.find((e) => e.id === 'eC')!.payment_method_id).toBe('pm-f')
    expect(spending().filter((e) => e.description !== 'Transfer fee')).toHaveLength(0)
    expect(db.expenses.filter((e) => e.description === 'Transfer fee').map((e) => e.amount)).toEqual([12])
    expect(log('F').own_transfer_verdict ?? null).not.toBe('ask_account')
    expect(log('F').paired_log_id).toBe('C')
  })

  it('the opposite order ends the same: one repayment, the fee, no spending row, no open question', async () => {
    db.sms_parse_log.splice(0, 1)
    db.expenses.splice(0, 1)
    await run(funding({ receivedAtIso: at(-20) }))
    expect(log('F').own_transfer_verdict).toBe('ask_account')
    await run(msg({ logId: 'C', kind: 'cc_payoff', amount: 1000, last4: '4444', receivedAtIso: at(0), rawBody: 'Payment of EGP 1000 received on your card' }))
    expect(h.debt).toHaveBeenCalledWith(expect.anything(), expect.anything(), { fundingLast4: '1234' })
    expect(liveExpenses().filter((e) => e.sms_log_id === 'F' && e.description !== 'Transfer fee')).toHaveLength(0)
    expect(db.expenses.filter((e) => e.description === 'Transfer fee').map((e) => e.amount)).toEqual([12])
    expect(log('F').own_transfer_verdict).toBe('none')
  })

  it('a transfer out naming OTHER digits is not claimed and stays spending', async () => {
    const tx = await run(funding({ counterpartyLast4: '9999', amount: 1000 }))
    expect(tx.kind).toBe('instant_transfer_out')
    expect(log('C').paired_log_id).toBeNull()
    expect(spending()).toHaveLength(1)
  })

  it('a transfer out naming another person is not claimed and stays spending', async () => {
    const tx = await run(funding({ counterpartyLast4: null, amount: 1000, counterpartyHash: 'h-person', counterpartyIsSelf: false }))
    expect(tx.kind).toBe('instant_transfer_out')
    expect(log('C').paired_log_id).toBeNull()
    expect(spending()).toHaveLength(1)
  })

  it('a funding leg with no destination digits and the exact amount is claimed', async () => {
    const tx = await run(funding({ counterpartyLast4: null, amount: 1000 }))
    expect(tx.outcome).toBe('transfer_paired')
    expect(log('C').paired_log_id).toBe('F')
    expect(db.expenses.find((e) => e.id === 'eC')!.payment_method_id).toBe('pm-f')
    expect(db.expenses.filter((e) => e.description === 'Transfer fee')).toHaveLength(0)
  })
})
