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
 * A pair settles as one non-spend Transfer only when both legs were captured by the same device on
 * different accounts AND carry one more decisive signal (shared IPN reference, shared counterparty
 * hash, ...). Anything weaker stays income + expense (ownTransferDecision.ts). Row-count assertions,
 * not string matches — the sibling is claimed on the persisted `kind` column, which a matcher test
 * cannot see.
 */

interface Log {
  id: string; kind: string; amount: number; raw_body: string; account_last4: string | null
  expense_id: string | null; income_id: string | null; paired: boolean
  device_id?: string | null; received_at?: string | null; counterparty_hash?: string | null; own_transfer_verdict?: string | null
}
interface State {
  registeredLast4: string[]
  logs: Log[]
  expenses: Array<{ id: string; category: string; deleted: boolean; row?: Record<string, unknown> }>
  incomes: Array<{ id: string; deleted: boolean }>
}

function makeService(state: State) {
  const rpc = vi.fn(async (_name: string, p: Record<string, unknown>) => {
    const kinds = p.p_match_kinds as string[]
    const amount = p.p_amount as number
    const ref = (p.p_reference as string | null) ?? null
    const selfId = p.p_log_id as string

    const hit = state.logs.find((l) => {
      if (l.paired || l.id === selfId || !kinds.includes(l.kind)) return false
      if (ref) return l.raw_body.includes(ref)
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

  const banks = () => {
    const methods = state.registeredLast4.map((l4) => ({ id: `pm${l4}`, name: l4 === '0001' ? 'HSBC Egypt ••0001' : `QNB ••${l4}`, last4: l4, last4_aliases: [] }))
    const c = chain({ single: () => ({ id: 'pm' }) })
    let wallets = false
    c.in = () => { wallets = true; return c }
    c.then = (r: (v: unknown) => unknown) => r({ data: wallets ? [] : methods, error: null })
    return c
  }

  const from = (table: string) => {
    if (table === 'payment_methods')
      // No wallets (banks only) → step 0 is skipped; last4 lookups resolve to a stub id so
      // 1c's own-account registration check passes for a registered account.
      return banks()
    if (table === 'expenses')
      return chain({
        onInsertExpense: (r) => { const id = `e${state.expenses.length + 1}`; state.expenses.push({ id, category: String(r.category), deleted: false, row: r }); return id },
        onUpdate: (patch, id) => { const e = state.expenses.find((x) => x.id === id); if (!e) return; if (patch.deleted_at) e.deleted = true; if (typeof patch.category === 'string') e.category = patch.category },
      })
    if (table === 'income_events')
      return chain({
        onInsertIncome: () => { const id = `i${state.incomes.length + 1}`; state.incomes.push({ id, deleted: false }); return id },
        onUpdate: (patch, id) => { if (patch.deleted_at) { const i = state.incomes.find((x) => x.id === id); if (i) i.deleted = true } },
      })
    if (table === 'sms_parse_log') {
      // Three readers: the leg publishing itself (update), the same-account check (selects only `id`,
      // filters by account and amount) and the candidate lookup (selects the full leg, unpaired only).
      const eqs: Record<string, unknown> = {}
      let kinds: string[] | null = null
      let cols = ''
      let excluded: string | null = null
      let unpairedOnly = false
      const c = chain({})
      c.select = (s: string) => { cols = s; return c }
      c.eq = (col: string, v: unknown) => { eqs[col] = v; return c }
      c.in = (_col: string, v: string[]) => { kinds = v; return c }
      c.neq = (col: string, v: string) => { if (col === 'id') excluded = v; return c }
      c.is = (col: string, v: unknown) => { if (col === 'paired_log_id' && v === null) unpairedOnly = true; return c }
      c.update = (patch: Record<string, unknown>) => ({
        eq: (_col: string, id: string) => {
          let l = state.logs.find((x) => x.id === id)
          if (!l) {
            l = { id, kind: 'other', amount: 0, raw_body: '', account_last4: null, expense_id: null, income_id: null, paired: false }
            state.logs.push(l)
          }
          Object.assign(l, patch)
          return Promise.resolve({ error: null, data: null })
        },
      })
      c.then = (r: (v: unknown) => unknown) => {
        const hits = state.logs.filter((l) =>
          (!kinds || kinds.includes(l.kind)) && l.id !== excluded && (!unpairedOnly || !l.paired) &&
          (eqs.account_last4 === undefined || l.account_last4 === eqs.account_last4) && (eqs.amount === undefined || l.amount === eqs.amount))
        return r({
          data: cols.includes('device_id')
            ? hits.map((l) => ({ id: l.id, amount: l.amount, account_last4: l.account_last4, device_id: l.device_id ?? null, counterparty_hash: l.counterparty_hash ?? null, raw_body: l.raw_body, received_at: l.received_at ?? null, own_transfer_verdict: l.own_transfer_verdict ?? null }))
            : hits.map((l) => ({ id: l.id })),
          error: null,
        })
      }
      return c
    }
    if (table === 'sms_own_transfer_answers') return chain({}) // no remembered answer
    return chain({}) // income_sources (matchSalary), etc.
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
    counterpartyLast4: null, receivedAtIso: '2026-07-18T18:56:43Z', logId: 'log-out', deviceId: 'dev-1', ...over,
  } as SmsRowData
}
function inLeg(over: Partial<SmsRowData> = {}): SmsRowData {
  return {
    userId: 'u1', amount: 2000, currency: 'EGP', day: '2026-07-18', kind: 'instant_transfer_in',
    cleanTitle: null, merchantNormalized: null, merchant: null, bankName: 'QNB', categoryHint: null,
    source: 'sms', rawBody: IN_REF, last4: '5124', counterpartyLast4: null,
    receivedAtIso: '2026-07-18T18:55:51Z', logId: 'log-in', deviceId: 'dev-1', ...over,
  } as SmsRowData
}

function persist(state: State, row: SmsRowData, res: { kind: string | null; expenseId: string | null; incomeId: string | null }) {
  // The leg may already exist: dispatch publishes it to the log before the route persists the rest.
  const full = {
    id: row.logId!, kind: res.kind ?? 'other', amount: row.amount, raw_body: row.rawBody,
    account_last4: row.last4 ?? null, expense_id: res.expenseId, income_id: res.incomeId,
    device_id: row.deviceId ?? null, received_at: row.receivedAtIso, counterparty_hash: row.counterpartyHash ?? null,
  }
  const existing = state.logs.find((l) => l.id === full.id)
  if (existing) Object.assign(existing, full)
  else state.logs.push({ ...full, paired: false })
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

/** Weak or unproven pair: one live spend (never the non-spend Transfer), one live income, nothing claimed. */
function expectBothLegsStay() {
  const live = state.expenses.filter((e) => !e.deleted)
  expect(live).toHaveLength(1)
  expect(live[0].category).not.toBe('Transfer')
  expect(state.incomes.filter((i) => !i.deleted)).toHaveLength(1)
  expect(state.logs.some((l) => l.paired)).toBe(false)
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
    expect(state.expenses[0].category).toBe('Instapay') // provisional spend (Egyptian IPN)
    persist(state, outLeg(), a)

    const b = await createSmsTransaction(svc, inLeg(), opts)
    expect(b.outcome).toBe('transfer_paired')
    expectSettledAsTransfer()
  })
})

describe('IPN own-account transfer — reference match needs the same device', () => {
  it('same reference but DIFFERENT devices does not settle', async () => {
    const svc = makeService(state)
    const a = await createSmsTransaction(svc, inLeg({ deviceId: 'dev-2' }), opts)
    persist(state, inLeg({ deviceId: 'dev-2' }), a)

    const b = await createSmsTransaction(svc, outLeg(), opts)
    expect(b.outcome).toBe('expense')
    expectBothLegsStay()
  })

  it('same reference but a missing device id does not settle', async () => {
    const svc = makeService(state)
    const a = await createSmsTransaction(svc, inLeg({ deviceId: null }), opts)
    persist(state, inLeg({ deviceId: null }), a)

    const b = await createSmsTransaction(svc, outLeg(), opts)
    expect(b.outcome).toBe('expense')
    expectBothLegsStay()
  })
})

describe('IPN own-account transfer — no shared reference does not settle on its own', () => {
  // No shared reference in the bodies → 1b can't fire. A fee-sized difference needs the reference, so the legs stay.
  const OUT_NOREF = 'Account 0001 debited IPN outward transfer EGP 2015 to Mohamed Mousa'
  const IN_NOREF = 'IPN transfer received EGP 2000 on 5124'

  it('2015 out / 2000 in (15 fee), same device, both accounts registered → both legs stay, nothing paired', async () => {
    const svc = makeService(state)
    const a = await createSmsTransaction(svc, inLeg({ amount: 2000, rawBody: IN_NOREF }), opts)
    persist(state, inLeg({ amount: 2000, rawBody: IN_NOREF }), a)

    const b = await createSmsTransaction(svc, outLeg({ amount: 2015, rawBody: OUT_NOREF }), opts)
    expect(b.outcome).toBe('expense')
    expectBothLegsStay()
  })

  it('amounts outside the fee margin (2000 vs 2500) do NOT pair', async () => {
    const svc = makeService(state)
    const a = await createSmsTransaction(svc, inLeg({ amount: 2000, rawBody: IN_NOREF }), opts)
    persist(state, inLeg({ amount: 2000, rawBody: IN_NOREF }), a)

    const b = await createSmsTransaction(svc, outLeg({ amount: 2500, rawBody: 'Account 0001 debited IPN outward transfer EGP 2500 to Mohamed Mousa' }), opts)
    expect(b.outcome).toBe('expense') // stayed a spend send (Egyptian IPN → Instapay)
    expectBothLegsStay()
  })

  it('an unregistered sibling account does not settle either', async () => {
    const svc = makeService(state)
    state.registeredLast4 = ['0001']
    const a = await createSmsTransaction(svc, inLeg({ amount: 2000, rawBody: IN_NOREF }), opts)
    persist(state, inLeg({ amount: 2000, rawBody: IN_NOREF }), a)

    const b = await createSmsTransaction(svc, outLeg({ amount: 2015, rawBody: OUT_NOREF }), opts)
    expect(b.outcome).toBe('expense')
    expectBothLegsStay()
  })

  it('an EXACT-amount pair on the same device with no reference and no other signal is only asked about', async () => {
    const svc = makeService(state)
    const a = await createSmsTransaction(svc, inLeg({ amount: 2000, rawBody: IN_NOREF }), opts)
    persist(state, inLeg({ amount: 2000, rawBody: IN_NOREF }), a)

    const b = await createSmsTransaction(svc, outLeg({ amount: 2000, rawBody: 'Account 0001 debited IPN outward transfer EGP 2000 to Mohamed Mousa' }), opts)
    expect(b.outcome).toBe('expense')
    expectBothLegsStay()
    expect(state.logs.find((l) => l.id === 'log-out')!.own_transfer_verdict).toBe('ask')
  })

  it('an exact-amount pair on the same device DOES settle when both legs carry the same counterparty hash', async () => {
    const svc = makeService(state)
    const a = await createSmsTransaction(svc, inLeg({ amount: 2000, rawBody: IN_NOREF, counterpartyHash: 'h1' }), opts)
    persist(state, inLeg({ amount: 2000, rawBody: IN_NOREF, counterpartyHash: 'h1' }), a)

    const b = await createSmsTransaction(svc, outLeg({ amount: 2000, rawBody: 'Account 0001 debited IPN outward transfer EGP 2000 to Mohamed Mousa', counterpartyHash: 'h1' }), opts)
    expect(b.outcome).toBe('transfer_paired')
    expectSettledAsTransfer()
  })
})

describe('IPN own-account transfer — guards', () => {
  it('a real send to a friend (no inbound leg) stays a spend send, not a Transfer', async () => {
    const svc = makeService(state)
    const res = await createSmsTransaction(svc, outLeg(), opts)
    expect(res.outcome).toBe('expense')
    const live = state.expenses.filter((e) => !e.deleted)
    expect(live).toHaveLength(1)
    // Egyptian IPN body → Instapay (still a spend category, NOT the non-spend own-account Transfer).
    expect(live[0].category).toBe('Instapay')
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

describe('money passing through ONE account is never settled as an own transfer', () => {
  // Same account, same amount, no shared reference: a pass-through, never a pair.
  const IN = 'IPN transfer received with amount of EGP 2000.00 on 0001 on 18/07 at 09:55 PM.'
  const OUT = 'Your Account ********0001 was debited with IPN outward transfer for EGP 2000.00 on 18-07-2026 21:56.'
  const relayIn = () => inLeg({ rawBody: IN, last4: '0001', bankName: 'HSBC', amount: 2000 })
  const relayOut = () => outLeg({ rawBody: OUT, last4: '0001', amount: 2000, merchant: null })

  it('in then out stays income plus spend', async () => {
    const svc = makeService(state)
    const a = await createSmsTransaction(svc, relayIn(), opts)
    persist(state, relayIn(), a)
    const b = await createSmsTransaction(svc, relayOut(), opts)
    expect(b.outcome).toBe('expense')
    expect(state.expenses.filter((e) => !e.deleted).map((e) => e.category)).toEqual(['Instapay'])
    expect(state.incomes.filter((i) => !i.deleted)).toHaveLength(1)
  })

  it('out then in stays spend plus income', async () => {
    const svc = makeService(state)
    const a = await createSmsTransaction(svc, relayOut(), opts)
    persist(state, relayOut(), a)
    const b = await createSmsTransaction(svc, relayIn(), opts)
    expect(b.outcome).toBe('income')
    expect(state.expenses.filter((e) => !e.deleted)).toHaveLength(1)
    expect(state.incomes.filter((i) => !i.deleted)).toHaveLength(1)
  })

  it('two DIFFERENT own accounts still settle as one transfer', async () => {
    const svc = makeService(state)
    // Same device and the same counterparty hash on both legs: the decisive signal.
    const a = await createSmsTransaction(svc, inLeg({ rawBody: IN.replace('0001', '5124'), amount: 2000, counterpartyHash: 'h1' }), opts)
    persist(state, inLeg({ amount: 2000, counterpartyHash: 'h1' }), a)
    const b = await createSmsTransaction(svc, { ...relayOut(), counterpartyHash: 'h1' }, opts)
    expect(b.outcome).toBe('transfer_paired')
    expectSettledAsTransfer()
  })
})

describe('the counterparty is the user by name (supporting signal)', () => {
  // The profile name is one supporting signal: on its own, even with a confirmed own account, it settles nothing.
  const named = (over: Partial<SmsRowData> = {}) => inLeg({ rawBody: 'Transfer received 2000.00 on 5124.', amount: 2000, counterpartyIsSelf: true, ...over })

  it('never reclassifies a credit on its own: it stays income', async () => {
    const res = await createSmsTransaction(makeService(state), named(), opts)
    expect(res.kind).toBe('instant_transfer_in')
    expect(res.outcome).toBe('income')
    expect(state.expenses).toHaveLength(0)
    expect(state.incomes).toHaveLength(1)
  })

  it('behaves the same with no registered account', async () => {
    state.registeredLast4 = []
    const res = await createSmsTransaction(makeService(state), named(), opts)
    expect(res.outcome).toBe('income')
  })
})
