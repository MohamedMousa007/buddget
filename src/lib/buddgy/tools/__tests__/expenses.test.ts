import { beforeEach, describe, expect, it } from 'vitest'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { refOf } from '@/lib/buddgy/tools/refs'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense, PaymentMethod } from '@/lib/store/types'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }

const pm = (id: string, name: string, isDefault: boolean): PaymentMethod =>
  ({ id, name, type: 'cash', currency: 'EGP', isDefault }) as PaymentMethod

const expense = (id: string, over: Partial<Expense> = {}): Expense => ({
  id,
  date: '2026-10-10',
  description: 'Lunch',
  category: 'Food',
  amount: 100,
  currency: 'EGP',
  amountInBaseCurrency: 100,
  paymentMethodId: 'aaaaaaaa-0000-0000-0000-000000000001',
  isRecurring: false,
  createdAt: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-10T10:00:00.000Z',
  ...over,
})

const write = (name: string) => {
  const w = TOOLS.get(name)?.write
  if (!w) throw new Error(`no write tool ${name}`)
  return w
}
const read = (name: string, args: Record<string, unknown> = {}) => {
  const r = TOOLS.get(name)?.read
  if (!r) throw new Error(`no read tool ${name}`)
  return r(args, ctx) as Record<string, unknown>
}

const E1 = 'b1b1b1b1-0000-0000-0000-000000000001'
const E2 = 'c2c2c2c2-0000-0000-0000-000000000002'

beforeEach(() => {
  useFinanceStore.setState({
    paymentMethods: [pm('aaaaaaaa-0000-0000-0000-000000000001', 'Cash', true), pm('d4d4d4d4-0000-0000-0000-000000000002', 'CIB Card', false)],
    expenses: [expense(E1), expense(E2, { description: 'Taxi', category: 'Transport', amount: 60, amountInBaseCurrency: 60, date: '2026-10-12' })],
    incomeSources: [],
    incomeEvents: [],
    debts: [],
    debtPayments: [],
    budgetPlans: [],
    budgetPlanActivations: [],
    activeBudgetPlanId: null,
    exchangeRates: {},
    settings: { ...useFinanceStore.getState().settings, baseCurrency: 'EGP' },
  })
})

describe('add_expense', () => {
  it('proposes without mutating, then applies and undoes', () => {
    const p = write('add_expense').propose({ description: 'Coffee', amount: 45, category: 'Food' }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(useFinanceStore.getState().expenses).toHaveLength(2)
    expect(p.proposal.summary).toMatch(/pending/i)
    expect(p.proposal.preview.fields?.some((f) => f.key === 'amount')).toBe(true)

    const applied = write('add_expense').apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(useFinanceStore.getState().expenses).toHaveLength(3)
    expect(useFinanceStore.getState().expenses.at(-1)).toMatchObject({ description: 'Coffee', amount: 45, date: '2026-10-19' })

    if (applied.ok) applied.undo?.()
    expect(useFinanceStore.getState().expenses).toHaveLength(2)
  })

  it('rejects a non-positive amount, a bad date and an unknown category', () => {
    const add = write('add_expense')
    expect(add.propose({ description: 'x', amount: 0, category: 'Food' }, ctx).ok).toBe(false)
    expect(add.propose({ description: 'x', amount: 5, category: 'Food', date: '2026-02-31' }, ctx).ok).toBe(false)
    expect(add.propose({ description: 'x', amount: 5, category: 'Nonsense' }, ctx).ok).toBe(false)
  })

  it('never falls back to the first method when the named one is unknown', () => {
    const r = write('add_expense').propose({ description: 'x', amount: 5, category: 'Food', method: 'Amex' }, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.choices?.map((c) => c.label)).toEqual(['Cash', 'CIB Card'])
  })

  it('resolves a method by exact name or ref', () => {
    const byName = write('add_expense').propose({ description: 'x', amount: 5, category: 'Food', method: 'cib card' }, ctx)
    expect(byName.ok && byName.proposal.args.method).toBe(refOf('d4d4d4d4-0000-0000-0000-000000000002'))
  })

  it('needs approval, not auto-apply, when the category was not given', () => {
    useFinanceStore.setState({ incomeSources: [{ id: 'i1', amount: 100000, currency: 'EGP' } as never] })
    const r = write('add_expense').propose({ description: 'x', amount: 5, category: undefined }, ctx)
    expect(r.ok && r.proposal.risk).toBe('approve')
  })

  it('flags a just-added duplicate and refuses auto-apply', () => {
    useFinanceStore.setState({
      incomeSources: [{ id: 'i1', amount: 100000, currency: 'EGP' } as never],
      expenses: [expense(E1, { description: 'Coffee', amount: 45, date: '2026-10-19', createdAt: new Date().toISOString() })],
    })
    const r = write('add_expense').propose({ description: 'Coffee', amount: 45, category: 'Food', date: '2026-10-19' }, ctx)
    expect(r.ok && r.proposal.risk).toBe('approve')
    expect(r.ok && r.proposal.preview.effect).toBeTruthy()
  })

  it('auto-applies a small, fully specified add', () => {
    useFinanceStore.setState({ incomeSources: [{ id: 'i1', amount: 100000, currency: 'EGP' } as never] })
    const r = write('add_expense').propose({ description: 'Coffee', amount: 45, category: 'Food' }, ctx)
    expect(r.ok && r.proposal.risk).toBe('auto')
  })
})

describe('update_expense', () => {
  it('diffs before and after, recomputes the base amount and undoes', () => {
    const upd = write('update_expense')
    const p = upd.propose({ ref: refOf(E1), amount: 120, category: 'Groceries' }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.preview.rows.map((r) => r.label)).toEqual(['Amount', 'Category'])
    const applied = upd.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    const after = useFinanceStore.getState().expenses.find((e) => e.id === E1)
    expect(after).toMatchObject({ amount: 120, amountInBaseCurrency: 120, category: 'Groceries' })
    if (applied.ok) applied.undo?.()
    expect(useFinanceStore.getState().expenses.find((e) => e.id === E1)).toMatchObject({ amount: 100, category: 'Food' })
  })

  it('fails on an unknown ref and on a no-op', () => {
    const upd = write('update_expense')
    expect(upd.propose({ ref: 'zzzzzz', amount: 5 }, ctx).ok).toBe(false)
    expect(upd.propose({ ref: refOf(E1), amount: 100 }, ctx).ok).toBe(false)
  })

  it('refuses to edit a debt-payment expense', () => {
    useFinanceStore.setState({ expenses: [expense(E1, { isDebtPayment: true, linkedDebtId: 'd1' })] })
    expect(write('update_expense').propose({ ref: refOf(E1), amount: 5 }, ctx).ok).toBe(false)
  })

  it('does not apply a proposal whose expense was deleted meanwhile', () => {
    const upd = write('update_expense')
    const p = upd.propose({ ref: refOf(E1), amount: 120 }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    useFinanceStore.getState().deleteExpense(E1)
    expect(upd.apply(p.proposal, ctx).ok).toBe(false)
  })
})

describe('delete_expense', () => {
  it('is strong risk, deletes, and restores on undo', () => {
    const del = write('delete_expense')
    const p = del.propose({ ref: refOf(E2) }, ctx)
    expect(p.ok && p.proposal.risk).toBe('strong')
    if (!p.ok) return
    const applied = del.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(useFinanceStore.getState().expenses.map((e) => e.id)).toEqual([E1])
    if (applied.ok) applied.undo?.()
    expect(useFinanceStore.getState().expenses.map((e) => e.id).sort()).toEqual([E1, E2])
  })

  it('undo restores the identical row and keeps later edits', () => {
    const before = structuredClone(useFinanceStore.getState().expenses)
    const del = write('delete_expense')
    const p = del.propose({ ref: refOf(E2) }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = del.apply(p.proposal, ctx)
    if (!applied.ok) throw new Error('apply failed')
    useFinanceStore.getState().updateExpense(E1, { description: 'Edited later' })
    applied.undo?.()
    const after = useFinanceStore.getState().expenses
    expect(after.find((e) => e.id === E2)).toEqual(before.find((e) => e.id === E2))
    expect(after.find((e) => e.id === E1)?.description).toBe('Edited later')
  })
})

describe('read tools', () => {
  it('search_expenses returns refs, totals and original currency, largest first on request', () => {
    const res = read('search_expenses', { sort: 'largest' }) as { count: number; total: number; rows: { ref: string; desc: string }[] }
    expect(res.count).toBe(2)
    expect(res.total).toBe(160)
    expect(res.rows[0]).toMatchObject({ desc: 'Lunch', ref: refOf(E1) })
  })

  it('search_expenses filters by text and category', () => {
    expect((read('search_expenses', { q: 'taxi' }) as { count: number }).count).toBe(1)
    expect((read('search_expenses', { category: 'Food' }) as { count: number }).count).toBe(1)
  })

  it('spend_breakdown groups and totals', () => {
    const res = read('spend_breakdown', { by: 'category' }) as { total: number; groups: { name: string; amount: number }[] }
    expect(res.total).toBe(160)
    expect(res.groups[0]).toMatchObject({ name: 'Food', amount: 100 })
  })

  it('get_summary reports the base currency and month', () => {
    const res = read('get_summary', { month: '2026-10' })
    expect(res).toMatchObject({ month: '2026-10', currency: 'EGP' })
  })
})
