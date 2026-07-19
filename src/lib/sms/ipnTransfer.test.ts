import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSmsTransaction } from './dispatch'
import type { SmsRowData } from './createSmsExpense'

/**
 * Account-to-account IPN transfer between the user's OWN two accounts (HSBC ••0001 → QNB
 * ••5124). The outbound SMS names the recipient only by NAME, the inbound names no sender,
 * so neither leg carries the other account's number — the counterparty-last4 join (step 1)
 * can never see it, and the transfer was booked as Remittance (spend) + income.
 *
 * Two ways to prove it own, exercised here end-to-end (both arrival orders → one non-spend
 * Transfer, zero income): the shared IPN reference (1b), and the both-accounts-registered
 * fee-margin fallback (1c). Row-count assertions, not string matches — the sibling is
 * claimed on the persisted `kind` column, which a matcher test cannot see.
 */

interface Log {
  id: string; kind: string; amount: number; raw_body: string; account_last4: string | null
  expense_id: string | null; income_id: string | null; paired: boolean
}
interface State {
  registeredLast4: string[]
  logs: Log[]
  expenses: Array<{ id: string; category: string; deleted: boolean }>
  incomes: Array<{ id: string; deleted: boolean }>
}

function makeService(state: State) {
  const rpc = vi.fn(async (_name: string, p: Record<string, unknown>) => {
    const kinds = p.p_match_kinds as string[]
    const amount = p.p_amount as number
    const ref = (p.p_reference as string | null) ?? null
    const requireReg = (p.p_require_registered_sibling as boolean) ?? false
    const tol = (p.p_amount_tolerance as number) ?? 0
    const selfId = p.p_log_id as string

    const hit = state.logs.find((l) => {
      if (l.paired || l.id === selfId || !kinds.includes(l.kind)) return false
      if (ref) return l.raw_body.includes(ref)
      if (requireReg) {
        return Math.abs(l.amount - amount) <= tol && !!l.account_last4 && state.registeredLast4.includes(l.account_last4)
      }
      return l.amount === amount
    })
    if (!hit) return { data: [], error: null }
    hit.paired = true
    return {
      data: [{ sibling_id: hit.id, sibling_kind: hit.kind, sibling_expense_id: hit.expense_id, sibling_income_id: hit.income_id, sibling_status: 'logged' }],
      error: null,
    }
  })

  const chain = (opts: {
    onInsertExpense?: (r: Record<string, unknown>) => string
    onInsertIncome?: () => string
    onUpdate?: (patch: Record<string, unknown>, id: string) => void
    listData?: unknown[]
    single?: () => unknown
  }): Record<string, unknown> => {
    const c: Record<string, unknown> = {
      select: () => c, eq: () => c, neq: () => c, in: () => c, is: () => c, not: () => c,
      gte: () => c, lte: () => c, order: () => c, limit: () => c,
      maybeSingle: () => Promise.resolve({ data: opts.single ? opts.single() : null, error: null }),
      single: () => Promise.resolve({ data: opts.single ? opts.single() : null, error: null }),
      then: (r: (v: unknown) => unknown) => r({ data: opts.listData ?? [], error: null }),
      insert: (r: Record<string, unknown>) => {
        const id = opts.onInsertExpense ? opts.onInsertExpense(r) : opts.onInsertIncome ? opts.onInsertIncome() : 'x'
        return {
          select: () => ({ single: () => Promise.resolve({ data: { id }, error: null }) }),
          then: (res: (v: unknown) => unknown) => res({ data: null, error: null }),
        }
      },
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, id: string) => { opts.onUpdate?.(patch, id); return Promise.resolve({ error: null, data: null }) },
      }),
    }
    return c
  }

  const from = (table: string) => {
    if (table === 'payment_methods')
      // No wallets (banks only) → step 0 is skipped; last4 lookups resolve to a stub id so
      // 1c's own-account registration check passes for a registered account.
      return chain({ listData: [], single: () => ({ id: 'pm' }) })
    if (table === 'expenses')
      return chain({
        onInsertExpense: (r) => { const id = `e${state.expenses.length + 1}`; state.expenses.push({ id, category: String(r.category), deleted: false }); return id },
        onUpdate: (patch, id) => { const e = state.expenses.find((x) => x.id === id); if (!e) return; if (patch.deleted_at) e.deleted = true; if (typeof patch.category === 'string') e.category = patch.category },
      })
    if (table === 'income_events')
      return chain({
        onInsertIncome: () => { const id = `i${state.incomes.length + 1}`; state.incomes.push({ id, deleted: false }); return id },
        onUpdate: (patch, id) => { if (patch.deleted_at) { const i = state.incomes.find((x) => x.id === id); if (i) i.deleted = true } },
      })
    return chain({}) // income_sources (matchSalary), sms_parse_log, etc.
  }

  return { from, rpc } as unknown as SupabaseClient
}

const OUT_REF = 'Your HSBC Account ********0001 was debited with IPN outward transfer for EGP 2002.00 on 18-07-2026 21:55 to MOHAMED MOUSA ABDELLATIF METWALLY ALI with reference b3abc23b. For further details, please contact HSBC call centre'
const IN_REF = 'IPN transfer received with amount of EGP 2000.00 on 5124 on 18/07 at 09:55 PM. Ref# b3abc23b. For more details call 16607.'

function outLeg(over: Partial<SmsRowData> = {}): SmsRowData {
  return {
    userId: 'u1', amount: 2002, currency: 'EGP', day: '2026-07-18', kind: 'instant_transfer_out',
    cleanTitle: null, merchantNormalized: null, merchant: 'MOHAMED MOUSA ABDELLATIF METWALLY ALI',
    bankName: 'HSBC', categoryHint: null, source: 'sms', rawBody: OUT_REF, last4: '0001',
    counterpartyLast4: null, receivedAtIso: '2026-07-18T18:56:43Z', logId: 'log-out', ...over,
  } as SmsRowData
}
function inLeg(over: Partial<SmsRowData> = {}): SmsRowData {
  return {
    userId: 'u1', amount: 2000, currency: 'EGP', day: '2026-07-18', kind: 'instant_transfer_in',
    cleanTitle: null, merchantNormalized: null, merchant: null, bankName: 'QNB', categoryHint: null,
    source: 'sms', rawBody: IN_REF, last4: '5124', counterpartyLast4: null,
    receivedAtIso: '2026-07-18T18:55:51Z', logId: 'log-in', ...over,
  } as SmsRowData
}

function persist(state: State, row: SmsRowData, res: { kind: string | null; expenseId: string | null; incomeId: string | null }) {
  state.logs.push({
    id: row.logId!, kind: res.kind ?? 'other', amount: row.amount, raw_body: row.rawBody,
    account_last4: row.last4 ?? null, expense_id: res.expenseId, income_id: res.incomeId, paired: false,
  })
}

let state: State
const opts = { exchangeRates: {} }
beforeEach(() => { state = { registeredLast4: ['0001', '5124'], logs: [], expenses: [], incomes: [] } })

function expectSettledAsTransfer() {
  const live = state.expenses.filter((e) => !e.deleted)
  expect(live).toHaveLength(1)
  expect(live[0].category).toBe('Transfer')
  expect(state.incomes.filter((i) => !i.deleted)).toHaveLength(0)
}

describe('IPN own-account transfer — reference match (1b)', () => {
  it('inbound first, outbound second → one non-spend Transfer, no income', async () => {
    const svc = makeService(state)
    const a = await createSmsTransaction(svc, inLeg(), opts)
    expect(a.outcome).toBe('income') // provisional — nothing proves it internal yet
    persist(state, inLeg(), a)

    const b = await createSmsTransaction(svc, outLeg(), opts)
    expect(b.outcome).toBe('transfer_paired')
    expectSettledAsTransfer()
  })

  it('outbound first, inbound second → the Remittance is retagged, no income', async () => {
    const svc = makeService(state)
    const a = await createSmsTransaction(svc, outLeg(), opts)
    expect(a.kind).toBe('instant_transfer_out')
    expect(state.expenses[0].category).toBe('Remittance') // provisional spend
    persist(state, outLeg(), a)

    const b = await createSmsTransaction(svc, inLeg(), opts)
    expect(b.outcome).toBe('transfer_paired')
    expectSettledAsTransfer()
  })
})

describe('IPN own-account transfer — registered fee-margin fallback (1c)', () => {
  // No shared reference in the bodies → 1b can't fire; both accounts registered + fee margin.
  const OUT_NOREF = 'Account 0001 debited IPN outward transfer EGP 2015 to Mohamed Mousa'
  const IN_NOREF = 'IPN transfer received EGP 2000 on 5124'

  it('2015 out / 2000 in (15 fee), both accounts registered → one Transfer', async () => {
    const svc = makeService(state)
    const a = await createSmsTransaction(svc, inLeg({ amount: 2000, rawBody: IN_NOREF }), opts)
    persist(state, inLeg({ amount: 2000, rawBody: IN_NOREF }), a)

    const b = await createSmsTransaction(svc, outLeg({ amount: 2015, rawBody: OUT_NOREF }), opts)
    expect(b.outcome).toBe('transfer_paired')
    expectSettledAsTransfer()
  })

  it('amounts outside the fee margin (2000 vs 2500) do NOT pair', async () => {
    const svc = makeService(state)
    const a = await createSmsTransaction(svc, inLeg({ amount: 2000, rawBody: IN_NOREF }), opts)
    persist(state, inLeg({ amount: 2000, rawBody: IN_NOREF }), a)

    const b = await createSmsTransaction(svc, outLeg({ amount: 2500, rawBody: 'Account 0001 debited IPN outward transfer EGP 2500 to Mohamed Mousa' }), opts)
    expect(b.outcome).toBe('expense') // stayed a Remittance
    expect(state.incomes.filter((i) => !i.deleted)).toHaveLength(1) // inbound stays income
    expect(state.expenses.filter((e) => !e.deleted && e.category === 'Remittance')).toHaveLength(1)
  })

  it('does not fire when the sibling account is not registered', async () => {
    const svc = makeService(state)
    // Inbound on an UNregistered account (5124 removed) — not the user's tracked account.
    state.registeredLast4 = ['0001']
    const a = await createSmsTransaction(svc, inLeg({ amount: 2000, rawBody: IN_NOREF }), opts)
    persist(state, inLeg({ amount: 2000, rawBody: IN_NOREF }), a)

    const b = await createSmsTransaction(svc, outLeg({ amount: 2015, rawBody: OUT_NOREF }), opts)
    expect(b.outcome).toBe('expense') // no registered sibling → stays Remittance
  })
})

describe('IPN own-account transfer — guards', () => {
  it('a real remittance to a friend (no inbound leg) stays a Remittance', async () => {
    const svc = makeService(state)
    const res = await createSmsTransaction(svc, outLeg(), opts)
    expect(res.outcome).toBe('expense')
    const live = state.expenses.filter((e) => !e.deleted)
    expect(live).toHaveLength(1)
    expect(live[0].category).toBe('Remittance')
  })

  it('never claims a cc_payoff sibling, even on the same reference', async () => {
    // A card-payoff funding leg is settled by step 3; hijacking it here would strand it from
    // its real card leg and resurrect the a34d517 double-count. matchKinds must exclude it.
    state.logs.push({ id: 'log-payoff', kind: 'cc_payoff', amount: 2000, raw_body: OUT_REF, account_last4: '2016', expense_id: 'e-payoff', income_id: null, paired: false })
    const svc = makeService(state)

    const res = await createSmsTransaction(svc, outLeg(), opts)
    expect(res.outcome).toBe('expense') // fell through to Remittance
    expect(state.logs.find((l) => l.id === 'log-payoff')!.paired).toBe(false) // untouched
  })
})
