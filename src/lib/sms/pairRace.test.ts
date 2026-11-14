import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSmsTransaction, type SmsTxResult } from './dispatch'
import type { SmsRowData } from './createSmsExpense'

/**
 * SMS3 — the pairing race. Two legs of one own-account IPN transfer arrive together: each publishes its kind and
 * searches for the other. The leg that searched first misses (its sibling has not published) and keeps posting
 * while the other claims it. The claimer used to see no posted row, post nothing, and the claimed leg then posted
 * its own row beside it: phantom income and no outbound row.
 *
 * The fake `sms_try_pair` mirrors the live function (supabase/migrations/0235): a leg that was already claimed
 * claims nothing, and the claimed sibling's status comes back as it was ('processing' until its route promotes
 * the log row). Each interleaving is driven by gating the claimed leg's ledger insert.
 */

interface Log {
  id: string; kind: string | null; amount: number; raw_body: string; account_last4: string | null
  status: string; parsed_ok: boolean; paired: boolean
  expense_id: string | null; income_id: string | null
}
interface Ledger { id: string; category: string; deleted: boolean; logId: string | null }
interface State {
  registeredLast4: string[]
  logs: Log[]
  expenses: Ledger[]
  incomes: Array<{ id: string; deleted: boolean; logId: string | null }>
  gate: { for: string; hit: boolean; release: () => void; wait: Promise<void> } | null
}

function newGate(forLog: string): NonNullable<State['gate']> {
  let release = () => {}
  const wait = new Promise<void>((r) => { release = r })
  return { for: forLog, hit: false, release, wait }
}

function makeService(state: State) {
  const rpc = vi.fn(async (_name: string, p: Record<string, unknown>) => {
    const kinds = p.p_match_kinds as string[]
    const amount = p.p_amount as number
    const ref = (p.p_reference as string | null) ?? null
    const requireReg = (p.p_require_registered_sibling as boolean) ?? false
    const tol = (p.p_amount_tolerance as number) ?? 0
    const selfId = p.p_log_id as string

    const self = state.logs.find((l) => l.id === selfId)
    if (self?.paired) return { data: [], error: null }

    const hit = state.logs.find((l) => {
      if (l.paired || l.id === selfId || !l.parsed_ok || !l.kind || !kinds.includes(l.kind)) return false
      if (ref) return l.raw_body.includes(ref)
      if (requireReg) {
        return Math.abs(l.amount - amount) <= tol && !!l.account_last4 && state.registeredLast4.includes(l.account_last4)
      }
      return l.amount === amount
    })
    if (!hit) return { data: [], error: null }
    hit.paired = true
    if (self) self.paired = true
    return {
      data: [{ sibling_id: hit.id, sibling_kind: hit.kind, sibling_expense_id: hit.expense_id, sibling_income_id: hit.income_id, sibling_status: hit.status }],
      error: null,
    }
  })

  const ledgerChain = (table: 'expenses' | 'income_events') => {
    const rows = table === 'expenses' ? state.expenses : state.incomes
    let eqCol = ''
    let eqVal = ''
    const c: Record<string, unknown> = {
      select: () => c, neq: () => c, in: () => c, is: () => c, not: () => c,
      gte: () => c, lte: () => c, order: () => c, limit: () => c,
      eq: (col: string, v: string) => { eqCol = col; eqVal = v; return c },
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      then: (r: (v: unknown) => unknown) => r({ data: [], error: null }),
      insert: (r: Record<string, unknown>) => {
        const id = `${table === 'expenses' ? 'e' : 'i'}${rows.length + 1}`
        const logId = (r.sms_log_id as string | null) ?? null
        const commit = () => {
          if (table === 'expenses') state.expenses.push({ id, category: String(r.category), deleted: false, logId })
          else state.incomes.push({ id, deleted: false, logId })
        }
        return {
          select: () => ({
            single: async () => {
              if (state.gate && state.gate.for === logId) { state.gate.hit = true; await state.gate.wait }
              commit()
              return { data: { id }, error: null }
            },
          }),
          then: (res: (v: unknown) => unknown) => { commit(); return res({ data: null, error: null }) },
        }
      },
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, id: string) => {
          const row = rows.find((x) => x.id === id) as { deleted: boolean; category?: string } | undefined
          if (row) {
            if (patch.deleted_at) row.deleted = true
            if (typeof patch.category === 'string') row.category = patch.category
          }
          return Promise.resolve({ error: null, data: null })
        },
      }),
    }
    void eqCol; void eqVal
    return c
  }

  const logChain = () => {
    let id = ''
    const c: Record<string, unknown> = {
      select: () => c, in: () => c, is: () => c, not: () => c, order: () => c, limit: () => c,
      neq: () => c, gte: () => c, lte: () => c,
      eq: (_col: string, v: string) => { id = v; return c },
      maybeSingle: () => {
        const l = state.logs.find((x) => x.id === id)
        return Promise.resolve({ data: l ? { status: l.status, expense_id: l.expense_id, income_id: l.income_id, amount: l.amount, account_last4: l.account_last4 } : null, error: null })
      },
      then: (r: (v: unknown) => unknown) => r({ data: [], error: null }),
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, target: string) => {
          const l = state.logs.find((x) => x.id === target)
          if (l) Object.assign(l, patch)
          return Promise.resolve({ error: null, data: null })
        },
      }),
    }
    return c
  }

  const banks = () => {
    const methods = state.registeredLast4.map((l4) => ({ id: `pm${l4}`, name: l4 === '0001' ? 'HSBC Egypt ••0001' : `QNB ••${l4}`, last4: l4, last4_aliases: [] }))
    let wallets = false
    const c: Record<string, unknown> = {
      select: () => c, eq: () => c, is: () => c, limit: () => c,
      in: () => { wallets = true; return c },
      maybeSingle: () => Promise.resolve({ data: { id: 'pm' }, error: null }),
      then: (r: (v: unknown) => unknown) => r({ data: wallets ? [] : methods, error: null }),
    }
    return c
  }

  const from = (table: string) => {
    if (table === 'payment_methods') return banks()
    if (table === 'expenses' || table === 'income_events') return ledgerChain(table)
    if (table === 'sms_parse_log') return logChain()
    const c: Record<string, unknown> = {
      select: () => c, eq: () => c, neq: () => c, in: () => c, is: () => c, not: () => c, gte: () => c, lte: () => c, order: () => c, limit: () => c,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (r: (v: unknown) => unknown) => r({ data: [], error: null }),
    }
    return c
  }
  return { from, rpc } as unknown as SupabaseClient
}

const OUT_REF = 'Your HSBC Account ********0001 was debited with IPN outward transfer for EGP 2002.00 on 18-07-2026 21:55 to MOHAMED MOUSA ABDELLATIF METWALLY ALI with reference b3abc23b. For further details, please contact HSBC call centre'
const IN_REF = 'IPN transfer received with amount of EGP 2000.00 on 5124 on 18/07 at 09:55 PM. Ref# b3abc23b. For more details call 16607.'

function outLeg(): SmsRowData {
  return {
    userId: 'u1', amount: 2002, currency: 'EGP', day: '2026-07-18', kind: 'instant_transfer_out',
    cleanTitle: null, merchantNormalized: null, merchant: 'MOHAMED MOUSA ABDELLATIF METWALLY ALI',
    bankName: 'HSBC', categoryHint: null, source: 'sms', rawBody: OUT_REF, last4: '0001',
    counterpartyLast4: null, receivedAtIso: '2026-07-18T18:56:43Z', logId: 'log-out',
  } as SmsRowData
}
function inLeg(): SmsRowData {
  return {
    userId: 'u1', amount: 2000, currency: 'EGP', day: '2026-07-18', kind: 'instant_transfer_in',
    cleanTitle: null, merchantNormalized: null, merchant: null, bankName: 'QNB', categoryHint: null,
    source: 'sms', rawBody: IN_REF, last4: '5124', counterpartyLast4: null,
    receivedAtIso: '2026-07-18T18:55:51Z', logId: 'log-in',
  } as SmsRowData
}

let state: State
const opts = { exchangeRates: {} }

beforeEach(() => {
  vi.useFakeTimers()
  state = { registeredLast4: ['0001', '5124'], logs: [], expenses: [], incomes: [], gate: null }
  // The route inserts the log row as 'processing' before it dispatches.
  for (const id of ['log-out', 'log-in']) {
    state.logs.push({ id, kind: null, amount: 0, raw_body: id === 'log-out' ? OUT_REF : IN_REF, account_last4: null, status: 'processing', parsed_ok: false, paired: false, expense_id: null, income_id: null })
  }
})
afterEach(() => { vi.useRealTimers() })

/** The route's promote step: writes the dispatcher's result onto the log row. */
function promote(logId: string, res: SmsTxResult) {
  const l = state.logs.find((x) => x.id === logId)!
  Object.assign(l, {
    status: res.outcome === 'transfer_paired' ? 'paired' : 'logged',
    kind: res.kind ?? l.kind,
    expense_id: res.expenseId, income_id: res.incomeId,
  })
}

async function run(svc: SupabaseClient, row: SmsRowData): Promise<SmsTxResult> {
  const p = createSmsTransaction(svc, row, opts)
  let res: SmsTxResult | undefined
  void p.then((r) => { res = r; promote(row.logId!, r) })
  await vi.advanceTimersByTimeAsync(0)
  while (!res && !(state.gate?.hit)) await vi.advanceTimersByTimeAsync(100)
  return res ?? (undefined as unknown as SmsTxResult)
}

async function settleAll(promises: Array<Promise<unknown>>) {
  let done = 0
  promises.forEach((p) => void p.then(() => { done++ }))
  while (done < promises.length) await vi.advanceTimersByTimeAsync(100)
}

function expectOneTransferNoIncome() {
  const live = state.expenses.filter((e) => !e.deleted)
  expect(live).toHaveLength(1)
  expect(live[0].category).toBe('Transfer')
  expect(state.incomes.filter((i) => !i.deleted)).toHaveLength(0)
}

describe('pairing race (SMS3)', () => {
  it('inbound leg still posting when the outbound leg claims it: one Transfer, no phantom income', async () => {
    const svc = makeService(state)
    state.gate = newGate('log-in')
    // B (inbound) misses its sibling search and is held just before it posts its income row.
    const bRun = createSmsTransaction(svc, inLeg(), opts)
    const bDone = bRun.then((r) => { promote('log-in', r); return r })
    while (!state.gate.hit) await vi.advanceTimersByTimeAsync(100)

    // A (outbound) arrives, claims B (status processing, nothing posted yet) and must wait for it.
    const aDone = createSmsTransaction(svc, outLeg(), opts).then((r) => { promote('log-out', r); return r })
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.expenses).toHaveLength(0) // A posted nothing yet: it is waiting on B

    state.gate.release()
    await settleAll([bDone, aDone])

    expect((await aDone).outcome).toBe('transfer_paired')
    expectOneTransferNoIncome()
  })

  it('outbound leg still posting when the inbound leg claims it: one Transfer, no phantom income', async () => {
    const svc = makeService(state)
    state.gate = newGate('log-out')
    const aDone = createSmsTransaction(svc, outLeg(), opts).then((r) => { promote('log-out', r); return r })
    while (!state.gate.hit) await vi.advanceTimersByTimeAsync(100)

    const bDone = createSmsTransaction(svc, inLeg(), opts).then((r) => { promote('log-in', r); return r })
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.incomes).toHaveLength(0)

    state.gate.release()
    await settleAll([aDone, bDone])

    expect((await bDone).outcome).toBe('transfer_paired')
    expectOneTransferNoIncome()
  })

  it('a claimed leg never claims another: its own retry finds nothing', async () => {
    const svc = makeService(state)
    state.gate = newGate('log-in')
    const bDone = createSmsTransaction(svc, inLeg(), opts).then((r) => { promote('log-in', r); return r })
    while (!state.gate.hit) await vi.advanceTimersByTimeAsync(100)
    const aDone = createSmsTransaction(svc, outLeg(), opts).then((r) => { promote('log-out', r); return r })
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.logs.find((l) => l.id === 'log-in')!.paired).toBe(true)
    state.gate.release()
    await settleAll([bDone, aDone])
    expect((await bDone).outcome).toBe('income') // B posted its own row; A (the claimer) retracted it
  })

  it('outbound first, fully settled, then inbound: one Transfer, no income', async () => {
    const svc = makeService(state)
    await run(svc, outLeg())
    const b = await run(svc, inLeg())
    expect(b.outcome).toBe('transfer_paired')
    expectOneTransferNoIncome()
  })

  it('inbound first, fully settled, then outbound: one Transfer, no income', async () => {
    const svc = makeService(state)
    await run(svc, inLeg())
    const a = await run(svc, outLeg())
    expect(a.outcome).toBe('transfer_paired')
    expectOneTransferNoIncome()
  })
})
