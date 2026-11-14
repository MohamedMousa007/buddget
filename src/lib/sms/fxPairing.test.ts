import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSmsTransaction, type SmsTxResult } from './dispatch'
import { detectLegDirection } from './directionGuard'
import { fxLegAction } from './fxEvent'
import type { SmsRowData } from './createSmsExpense'

/**
 * SMS4 — a currency exchange is a debit in one currency and a credit in another. It used to pair with ANY other
 * currency_exchange leg in the window, so with arrival order d1, d2, c1, c2 the two debits paired with each other
 * and one conversion was left unrepresented. The fake `sms_try_pair` mirrors the live function (migration 0235):
 * opposite direction and different currency, both known; an unknown direction never pairs.
 */

interface Log {
  id: string; kind: string | null; amount: number; currency: string | null; leg_direction: string | null
  parsed_ok: boolean; paired: boolean; received: number
}

let logs: Log[]
let expenses: number
let rpcCalls: Array<Record<string, unknown>>
/** Registered accounts the legs can resolve to, expense rows posted, and patches applied to posted rows. */
let methods: Array<{ id: string; name: string; last4: string; last4_aliases: string[] }>
let inserted: Array<Record<string, unknown>>
let patched: Array<{ id: string; patch: Record<string, unknown> }>

function makeService() {
  const rpc = vi.fn(async (_n: string, p: Record<string, unknown>) => {
    rpcCalls.push(p)
    const self = logs.find((l) => l.id === p.p_log_id)!
    if (self.paired) return { data: [], error: null }
    const dir = (p.p_direction as string | undefined) ?? null
    const cur = (p.p_currency as string | undefined) ?? null
    const candidates = logs
      .filter((l) => l.id !== self.id && !l.paired && l.parsed_ok && l.kind === 'currency_exchange'
        && dir && l.leg_direction && l.leg_direction !== dir && cur && l.currency && l.currency !== cur)
      .sort((a, b) => Math.abs(a.received - self.received) - Math.abs(b.received - self.received))
    const hit = candidates[0]
    if (!hit) return { data: [], error: null }
    hit.paired = true
    self.paired = true
    return { data: [{ sibling_id: hit.id, sibling_kind: hit.kind, sibling_expense_id: `exp-${hit.id}`, sibling_income_id: null, sibling_status: 'logged' }], error: null }
  })
  const from = (table: string) => {
    const c: Record<string, unknown> = {
      select: () => c, eq: () => c, neq: () => c, in: () => c, is: () => c, not: () => c, gte: () => c, lte: () => c, order: () => c, limit: () => c,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (r: (v: unknown) => unknown) => r({ data: table === 'payment_methods' ? methods : [], error: null }),
      insert: (row: Record<string, unknown>) => {
        if (table === 'expenses') { expenses++; inserted.push(row) }
        return { select: () => ({ single: () => Promise.resolve({ data: { id: `e${expenses}` }, error: null }) }), then: (r: (v: unknown) => unknown) => r({ data: null, error: null }) }
      },
      update: (patch: Record<string, unknown>) => ({
        eq: (_c: string, id: string) => {
          if (table === 'sms_parse_log') Object.assign(logs.find((l) => l.id === id) ?? {}, patch)
          if (table === 'expenses') patched.push({ id, patch })
          return Promise.resolve({ error: null, data: null })
        },
      }),
    }
    return c
  }
  return { from, rpc } as unknown as SupabaseClient
}

const DEBIT_USD_1 = 'You have exchanged USD 100.00 from account ****1234.'
const DEBIT_USD_2 = 'You have exchanged USD 200.00 from account ****1234.'
const CREDIT_EGP_1 = 'Currency conversion: EGP 4,800.00 credited to account ****5678.'
const CREDIT_EGP_2 = 'Currency conversion: EGP 9,600.00 credited to account ****5678.'

function leg(logId: string, body: string, amount: number, currency: string, at: number): SmsRowData {
  return {
    userId: 'u1', amount, currency, day: '2026-07-18', kind: 'currency_exchange', cleanTitle: null, merchantNormalized: null,
    merchant: null, bankName: 'Bank', categoryHint: null, source: 'sms', rawBody: body, last4: null, counterpartyLast4: null,
    receivedAtIso: new Date(Date.UTC(2026, 6, 18, 12, 0, at)).toISOString(), logId,
  } as SmsRowData
}

beforeEach(() => {
  vi.useFakeTimers()
  logs = ['d1', 'd2', 'c1', 'c2'].map((id, i) => ({ id, kind: null, amount: 0, currency: null, leg_direction: null, parsed_ok: false, paired: false, received: i }))
  expenses = 0
  rpcCalls = []
  methods = []
  inserted = []
  patched = []
})
afterEach(() => { vi.useRealTimers() })

async function arrive(svc: SupabaseClient, row: SmsRowData): Promise<SmsTxResult> {
  const p = createSmsTransaction(svc, row, { exchangeRates: {} })
  await vi.advanceTimersByTimeAsync(1000)
  return p
}

describe('currency_exchange pairing (SMS4)', () => {
  it('d1, d2, c1, c2: two same-direction legs never pair; each credit claims one debit', async () => {
    const svc = makeService()
    const d1 = await arrive(svc, leg('d1', DEBIT_USD_1, 100, 'USD', 0))
    const d2 = await arrive(svc, leg('d2', DEBIT_USD_2, 200, 'USD', 1))
    expect([d1.outcome, d2.outcome]).toEqual(['transfer_single', 'transfer_single'])
    expect(expenses).toBe(2)

    const c1 = await arrive(svc, leg('c1', CREDIT_EGP_1, 4800, 'EGP', 2))
    const c2 = await arrive(svc, leg('c2', CREDIT_EGP_2, 9600, 'EGP', 3))
    expect([c1.outcome, c2.outcome]).toEqual(['transfer_paired', 'transfer_paired'])
    expect(expenses).toBe(2) // both conversions represented once, no extra rows
    expect(logs.every((l) => l.paired)).toBe(true)
  })

  it('publishes the leg direction and currency and sends them to the pairing function', async () => {
    const svc = makeService()
    await arrive(svc, leg('d1', DEBIT_USD_1, 100, 'USD', 0))
    expect(logs[0]).toMatchObject({ currency: 'USD', leg_direction: 'debit' })
    expect(rpcCalls[0]).toMatchObject({ p_direction: 'debit', p_currency: 'USD', p_self_kind: 'currency_exchange' })
  })

  it('a leg whose direction cannot be read never pairs', async () => {
    const svc = makeService()
    await arrive(svc, leg('d1', DEBIT_USD_1, 100, 'USD', 0))
    const c = await arrive(svc, leg('c1', 'EGP 4,800.00 conversion', 4800, 'EGP', 2))
    expect(c.outcome).toBe('transfer_single')
  })
})

describe('a currency exchange is one event (RC-D)', () => {
  const USD = { id: 'usd', name: 'HSBC Egypt ••1234', last4: '1234', last4_aliases: [] }
  const EGP = { id: 'egp', name: 'HSBC Egypt ••5678', last4: '5678', last4_aliases: [] }
  const debit = () => ({ ...leg('d1', DEBIT_USD_1, 100, 'USD', 0), last4: '1234', bankName: 'HSBC Egypt' })
  const credit = () => ({ ...leg('c1', CREDIT_EGP_1, 4800, 'EGP', 2), last4: '5678', bankName: 'HSBC Egypt' })
  beforeEach(() => { methods = [USD, EGP] })

  it('debit first: the debited account is the source, the credit leg only names the destination', async () => {
    const svc = makeService()
    await arrive(svc, debit())
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ category: 'Currency Exchange', payment_method_id: 'usd', to_payment_method_id: null, amount: 100, currency: 'USD' })

    const c = await arrive(svc, credit())
    expect(c.outcome).toBe('transfer_paired')
    expect(c.expenseId).toBeNull()
    expect(inserted).toHaveLength(1)
    expect(patched).toEqual([{ id: 'exp-d1', patch: { to_payment_method_id: 'egp' } }])
  })

  it('credit first: the credited account is never booked as the account the money left', async () => {
    const svc = makeService()
    const c = await arrive(svc, credit())
    expect(c.outcome).toBe('transfer_single')
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ category: 'Currency Exchange', payment_method_id: null, to_payment_method_id: 'egp' })

    const d = await arrive(svc, debit())
    expect(d.outcome).toBe('transfer_paired')
    expect(inserted).toHaveLength(1)
    // The debit leg makes itself the source and states what actually left it.
    expect(patched).toEqual([{ id: 'exp-c1', patch: { payment_method_id: 'usd', amount: 100, currency: 'USD' } }])
  })

  it('either order ends with one row: source = debited account, destination = credited account', async () => {
    for (const order of [[debit, credit], [credit, debit]]) {
      logs.forEach((l) => Object.assign(l, { kind: null, paired: false, parsed_ok: false, leg_direction: null, currency: null }))
      inserted = []
      patched = []
      const svc = makeService()
      for (const next of order) await arrive(svc, next())
      const row = { ...inserted[0], ...patched[0].patch }
      expect(inserted).toHaveLength(1)
      expect(row).toMatchObject({ payment_method_id: 'usd', to_payment_method_id: 'egp', amount: 100, currency: 'USD' })
    }
  })
})

describe('detectLegDirection', () => {
  it('reads the ledger sign first, then unambiguous wording', () => {
    expect(detectLegDirection('Phone Banking Transfer to 103-104***-001 EGP 9,968.00+ bal')).toBe('credit')
    expect(detectLegDirection('Phone Banking Transfer from 103-104***-110 USD 200.00- bal')).toBe('debit')
    expect(detectLegDirection(DEBIT_USD_1)).toBe('debit')
    expect(detectLegDirection(CREDIT_EGP_1)).toBe('credit')
    expect(detectLegDirection('تم تحويل عملة بمبلغ USD 100.00 من حسابك ****1234')).toBe('debit')
  })
  it('is null when the message says nothing or says both', () => {
    expect(detectLegDirection('EGP 4,800.00 conversion')).toBeNull()
    expect(detectLegDirection('USD 10 debited from account X, EGP 20 credited to account Y')).toBeNull()
  })
})

describe('fxLegAction', () => {
  it('posts with this account in its own role when no row exists yet', () => {
    expect(fxLegAction('debit', false)).toEqual({ type: 'post', role: 'source' })
    expect(fxLegAction('credit', false)).toEqual({ type: 'post', role: 'destination' })
    expect(fxLegAction(null, false)).toEqual({ type: 'post', role: 'source' })
  })
  it('only completes the row the other leg posted', () => {
    expect(fxLegAction('credit', true)).toEqual({ type: 'complete', set: 'destination' })
    expect(fxLegAction('debit', true)).toEqual({ type: 'complete', set: 'source' })
  })
})
