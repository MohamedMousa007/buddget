import { describe, expect, it, vi } from 'vitest'
import { createSmsDebtPayment, type SmsRowData } from './createSmsExpense'

const row: SmsRowData = {
  userId: 'u1', amount: 500, currency: 'EGP', day: '2026-10-01', kind: 'cc_payoff', cleanTitle: null,
  merchantNormalized: null, merchant: null, bankName: 'Bank', categoryHint: null, source: 'sms', rawBody: '',
  logId: 'log1', last4: null,
}

type Tables = Record<string, { list?: unknown[]; one?: unknown; insert?: unknown }>

function mockService(tables: Tables, rpc: ReturnType<typeof vi.fn>) {
  const inserts: { table: string; values: Record<string, unknown> }[] = []
  const from = (table: string) => {
    const t = tables[table] ?? {}
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'is', 'not', 'limit', 'order']) b[m] = () => b
    b.maybeSingle = async () => ({ data: t.one ?? null, error: null })
    b.single = async () => ({ data: t.insert ?? { id: `${table}-new` }, error: null })
    b.insert = (values: Record<string, unknown>) => { inserts.push({ table, values }); return b }
    b.then = (res: (v: unknown) => unknown) => res({ data: t.list ?? [], error: null })
    return b
  }
  return { service: { from, rpc } as never, inserts }
}

const card = { id: 'd1', currency: 'EGP', is_gold: false, starting_balance: 9000, linked_payment_method_id: null }

describe('createSmsDebtPayment', () => {
  it('books through the idempotent RPC keyed on the sms log, with explicit debt units', async () => {
    const rpc = vi.fn(async () => ({ data: { outcome: 'created', debt_payment_id: 'p1', expense_id: 'e1' }, error: null }))
    const { service, inserts } = mockService({ debts: { list: [card] } }, rpc)
    const res = await createSmsDebtPayment(service, row)
    expect(res).toMatchObject({ expenseId: 'e1', debtPaymentId: 'p1', error: null })
    const args = rpc.mock.calls[0] as unknown as [string, { p_sms_log_id: string; p_payment: Record<string, unknown> }]
    expect(args[0]).toBe('add_sms_debt_payment_with_expense')
    expect(args[1].p_sms_log_id).toBe('log1')
    expect(args[1].p_payment).toMatchObject({ amount_in_debt_unit: 500, original_amount: 500, original_currency: 'EGP' })
    expect(inserts).toHaveLength(0)
  })

  it('asks for confirmation instead of posting when the RPC reports an overpay', async () => {
    const rpc = vi.fn(async () => ({ data: { outcome: 'overpay', remaining: 100 }, error: null }))
    const { service, inserts } = mockService({ debts: { list: [card] } }, rpc)
    const res = await createSmsDebtPayment(service, row)
    expect(res.needsConfirm).toBe(true)
    expect(inserts).toHaveLength(0)
  })

  it('falls back to the legacy two-insert path when the RPC is not deployed (PGRST202), writing the unit fields', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }))
    const { service, inserts } = mockService({ debts: { list: [card] }, debt_payments: { insert: { id: 'p9' } } }, rpc)
    const res = await createSmsDebtPayment(service, row)
    expect(res.debtPaymentId).toBe('p9')
    const pay = inserts.find((i) => i.table === 'debt_payments')!.values
    expect(pay).toMatchObject({ amount_in_debt_unit: 500, original_amount: 500, original_currency: 'EGP', debt_id: 'd1' })
    expect(inserts.find((i) => i.table === 'expenses')!.values).toMatchObject({ linked_debt_payment_id: 'p9', sms_log_id: 'log1' })
  })

  it('legacy fallback reuses the expense a previous attempt already booked, so a retry cannot pay twice', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'x' } }))
    const { service, inserts } = mockService(
      { debts: { list: [card] }, expenses: { one: { id: 'e-old', linked_debt_payment_id: 'p-old' } } }, rpc)
    const res = await createSmsDebtPayment(service, row)
    expect(res).toMatchObject({ expenseId: 'e-old', debtPaymentId: 'p-old' })
    expect(inserts).toHaveLength(0)
  })

  it('never stores a foreign-currency or gold amount as debt units: leaves it to the user', async () => {
    const rpc = vi.fn()
    const usdCard = { ...card, currency: 'USD' }
    const { service, inserts } = mockService({ debts: { list: [usdCard] } }, rpc)
    const res = await createSmsDebtPayment(service, row)
    expect(res.needsConfirm).toBe(true)
    expect(rpc).not.toHaveBeenCalled()
    expect(inserts).toHaveLength(0)
  })
})
