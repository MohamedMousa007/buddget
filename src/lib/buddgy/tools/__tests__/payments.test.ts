import { beforeEach, describe, expect, it } from 'vitest'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { refOf } from '@/lib/buddgy/tools/refs'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense, PaymentMethod } from '@/lib/store/types'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }

const write = (name: string) => {
  const w = TOOLS.get(name)?.write
  if (!w) throw new Error(`no write tool ${name}`)
  return w
}
const read = (name: string) => TOOLS.get(name)?.read?.({}, ctx) as { methods: unknown[] }

const CIB = 'a1a1a1a1-0000-0000-0000-000000000001'
const NBE = 'b2b2b2b2-0000-0000-0000-000000000002'
const state = () => useFinanceStore.getState()

const pm = (id: string, name: string, type: PaymentMethod['type'], isDefault = false, extra: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name, type, currency: 'EGP', isDefault, ...extra }) as PaymentMethod

const expense = (id: string, paymentMethodId: string): Expense => ({
  id,
  date: '2026-10-10',
  description: 'Lunch',
  category: 'Food',
  amount: 100,
  currency: 'EGP',
  amountInBaseCurrency: 100,
  paymentMethodId,
  isRecurring: false,
  createdAt: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-10T10:00:00.000Z',
})

beforeEach(() => {
  useFinanceStore.setState({
    paymentMethods: [pm(DEFAULT_CASH_ID, 'Cash', 'cash', true), pm(CIB, 'CIB ••1234', 'debit_card', false, { last4: '1234', color: '#2E5AAC' }), pm(NBE, 'NBE', 'bank_account')],
    expenses: [expense('e1e1e1e1-0', CIB), expense('e2e2e2e2-0', CIB), expense('e3e3e3e3-0', NBE)],
    subscriptions: [],
    incomeSources: [],
    incomeEvents: [],
    debts: [],
    settings: { ...state().settings, baseCurrency: 'EGP' },
  })
})

describe('list_payment_methods', () => {
  it('returns refs, types and the default flag', () => {
    const res = read('list_payment_methods')
    expect(res.methods).toEqual([
      { ref: refOf(DEFAULT_CASH_ID), name: 'Cash', type: 'cash', cur: 'EGP', default: true },
      { ref: refOf(CIB), name: 'CIB ••1234', type: 'debit_card', cur: 'EGP' },
      { ref: refOf(NBE), name: 'NBE', type: 'bank_account', cur: 'EGP' },
    ])
  })
})

describe('add_payment_method', () => {
  it('composes the name with last4, applies, and undoes', () => {
    const add = write('add_payment_method')
    const p = add.propose({ name: 'Banque Misr', type: 'debit_card', last4: '9876' }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(state().paymentMethods).toHaveLength(3)
    const applied = add.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(state().paymentMethods.at(-1)).toMatchObject({ name: 'Banque Misr ••9876', type: 'debit_card', currency: 'EGP', last4: '9876', isDefault: false })
    if (applied.ok) applied.undo?.()
    expect(state().paymentMethods).toHaveLength(3)
  })

  it('creates the linked debt for a credit card and removes both on undo', () => {
    const add = write('add_payment_method')
    const p = add.propose({ name: 'Visa', type: 'credit_card', last4: '1111' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    expect(p.proposal.preview.effect).toBeTruthy()
    const applied = add.apply(p.proposal, ctx)
    const card = state().paymentMethods.at(-1)!
    expect(state().debts).toHaveLength(1)
    expect(state().debts[0]).toMatchObject({ debtType: 'credit_card', linkedPaymentMethodId: card.id })
    if (applied.ok) applied.undo?.()
    expect(state().debts).toHaveLength(0)
    expect(state().paymentMethods).toHaveLength(3)
  })

  it('makes the new method the default and undo restores the old default', () => {
    const add = write('add_payment_method')
    const p = add.propose({ name: 'Telda', type: 'wallet', makeDefault: true }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = add.apply(p.proposal, ctx)
    expect(state().paymentMethods.filter((m) => m.isDefault).map((m) => m.name)).toEqual(['Telda'])
    if (applied.ok) applied.undo?.()
    expect(state().paymentMethods.filter((m) => m.isDefault).map((m) => m.id)).toEqual([DEFAULT_CASH_ID])
  })

  it('validates type, last4, color, currency and duplicates', () => {
    const add = write('add_payment_method')
    expect(add.propose({ name: 'X', type: 'cash' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'X', type: 'nonsense' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'X', type: 'debit_card', last4: '12' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'X', type: 'bnpl', last4: '1234' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'X', type: 'wallet', color: 'blue' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'X', type: 'wallet', currency: 'ZZZ' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'nbe', type: 'bank_account' }, ctx).ok).toBe(false)
    expect(add.propose({ name: '  ', type: 'wallet' }, ctx).ok).toBe(false)
  })

  it('rejects a stale add whose name was taken meanwhile', () => {
    const add = write('add_payment_method')
    const p = add.propose({ name: 'Telda', type: 'wallet' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    state().addPaymentMethod({ name: 'Telda', type: 'wallet', currency: 'EGP', isDefault: false })
    expect(add.apply(p.proposal, ctx).ok).toBe(false)
  })
})

describe('update_payment_method', () => {
  it('renames while keeping last4 in the name, and undoes', () => {
    const upd = write('update_payment_method')
    const p = upd.propose({ ref: refOf(CIB), name: 'CIB Platinum' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    expect(p.proposal.preview.rows[0]).toMatchObject({ before: 'CIB ••1234', value: 'CIB Platinum ••1234' })
    const applied = upd.apply(p.proposal, ctx)
    expect(state().paymentMethods.find((m) => m.id === CIB)).toMatchObject({ name: 'CIB Platinum ••1234', last4: '1234' })
    if (applied.ok) applied.undo?.()
    expect(state().paymentMethods.find((m) => m.id === CIB)).toMatchObject({ name: 'CIB ••1234', last4: '1234' })
  })

  it('changes and clears last4', () => {
    const upd = write('update_payment_method')
    const p = upd.propose({ ref: 'CIB ••1234', last4: '' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    upd.apply(p.proposal, ctx)
    expect(state().paymentMethods.find((m) => m.id === CIB)).toMatchObject({ name: 'CIB', last4: undefined })
  })

  it('moves the default and undo gives it back', () => {
    const upd = write('update_payment_method')
    const p = upd.propose({ ref: refOf(NBE), makeDefault: true }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = upd.apply(p.proposal, ctx)
    expect(state().paymentMethods.filter((m) => m.isDefault).map((m) => m.id)).toEqual([NBE])
    if (applied.ok) applied.undo?.()
    expect(state().paymentMethods.filter((m) => m.isDefault).map((m) => m.id)).toEqual([DEFAULT_CASH_ID])
  })

  it('changes color', () => {
    const upd = write('update_payment_method')
    const p = upd.propose({ ref: refOf(NBE), color: '#22C55E' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    upd.apply(p.proposal, ctx)
    expect(state().paymentMethods.find((m) => m.id === NBE)?.color).toBe('#22C55E')
  })

  it('fails on unknown, no-op, default off, duplicate names and the built-in cash', () => {
    const upd = write('update_payment_method')
    const unknown = upd.propose({ ref: 'Amex', name: 'x' }, ctx)
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.choices).toHaveLength(3)
    expect(upd.propose({ ref: refOf(NBE), name: 'NBE' }, ctx).ok).toBe(false)
    expect(upd.propose({ ref: refOf(NBE), makeDefault: false }, ctx).ok).toBe(false)
    expect(upd.propose({ ref: refOf(NBE), name: 'cib ••1234' }, ctx).ok).toBe(false)
    expect(upd.propose({ ref: refOf(DEFAULT_CASH_ID), name: 'Wallet cash' }, ctx).ok).toBe(false)
    expect(upd.propose({ ref: refOf(NBE), last4: '12' }, ctx).ok).toBe(false)
  })

  it('does not apply when the method disappeared', () => {
    const upd = write('update_payment_method')
    const p = upd.propose({ ref: refOf(NBE), name: 'NBE Plus' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    state().deletePaymentMethod(NBE)
    expect(upd.apply(p.proposal, ctx).ok).toBe(false)
  })
})

describe('delete_payment_method', () => {
  it('is strong, summarizes the cascade, and applies the store cascade', () => {
    useFinanceStore.setState({
      subscriptions: [{ id: 's1s1s1s1-0', paymentMethodId: CIB } as never],
      incomeSources: [{ id: 'i1i1i1i1-0', paymentMethodId: CIB } as never],
      debts: [{ id: 'd1d1d1d1-0', name: 'CIB card', linkedPaymentMethodId: CIB } as never],
      paymentMethods: [pm(DEFAULT_CASH_ID, 'Cash', 'cash'), pm(CIB, 'CIB ••1234', 'debit_card', true), pm(NBE, 'NBE', 'bank_account')],
    })
    const del = write('delete_payment_method')
    const p = del.propose({ ref: refOf(CIB) }, ctx)
    expect(p.ok && p.proposal.risk).toBe('strong')
    if (!p.ok) return
    const effect = p.proposal.preview.effect ?? ''
    expect(effect).toContain('closed')
    expect(effect).toContain('NBE becomes the default')

    const applied = del.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    const closed = state().paymentMethods.find((m) => m.id === CIB)
    expect(closed?.closedAt).toBeTruthy()
    expect(closed?.isDefault).toBe(false)
    expect(state().paymentMethods.find((m) => m.id === NBE)?.isDefault).toBe(true)
    expect(state().expenses.filter((e) => e.paymentMethodId === CIB)).toHaveLength(2)
    expect(state().expenses.filter((e) => e.paymentMethodId === DEFAULT_CASH_ID)).toHaveLength(0)
    if (!applied.ok) return
    expect(applied.undo).toBeTypeOf('function')
  })

  it('undo restores the method, default flag and every rewritten dependent with the same ids', () => {
    useFinanceStore.setState({
      subscriptions: [{ id: 's1s1s1s1-0', paymentMethodId: CIB } as never],
      incomeSources: [{ id: 'i1i1i1i1-0', paymentMethodId: CIB } as never],
      incomeEvents: [{ id: 'v1v1v1v1-0', paymentMethodId: CIB } as never],
      debts: [{ id: 'd1d1d1d1-0', name: 'CIB card', linkedPaymentMethodId: CIB } as never],
      paymentMethods: [pm(DEFAULT_CASH_ID, 'Cash', 'cash', false), pm(CIB, 'CIB ••1234', 'debit_card', true), pm(NBE, 'NBE', 'bank_account')],
    })
    const pre = structuredClone({
      paymentMethods: state().paymentMethods,
      expenses: state().expenses,
      debts: state().debts,
      subscriptions: state().subscriptions,
      incomeSources: state().incomeSources,
      incomeEvents: state().incomeEvents,
    })
    const del = write('delete_payment_method')
    const p = del.propose({ ref: refOf(CIB) }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = del.apply(p.proposal, ctx)
    if (!applied.ok) throw new Error('apply failed')
    applied.undo?.()
    const s = state()
    expect(s.paymentMethods.map((m) => ({ id: m.id, isDefault: m.isDefault }))).toEqual(pre.paymentMethods.map((m) => ({ id: m.id, isDefault: m.isDefault })))
    expect(s.paymentMethods.find((m) => m.id === CIB)).toEqual(pre.paymentMethods.find((m) => m.id === CIB))
    expect(s.expenses).toEqual(pre.expenses)
    expect(s.debts).toEqual(pre.debts)
    expect(s.subscriptions).toEqual(pre.subscriptions)
    expect(s.incomeSources).toEqual(pre.incomeSources)
    expect(s.incomeEvents).toEqual(pre.incomeEvents)
  })

  it('undo leaves a dependent edited after the delete alone', () => {
    const del = write('delete_payment_method')
    const p = del.propose({ ref: refOf(CIB) }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = del.apply(p.proposal, ctx)
    if (!applied.ok) throw new Error('apply failed')
    state().updateExpense('e1e1e1e1-0', { paymentMethodId: NBE, description: 'moved' })
    applied.undo?.()
    const e1 = state().expenses.find((e) => e.id === 'e1e1e1e1-0')
    expect(e1).toMatchObject({ paymentMethodId: NBE, description: 'moved' })
    expect(state().expenses.find((e) => e.id === 'e2e2e2e2-0')?.paymentMethodId).toBe(CIB)
  })

  it('refuses to delete cash, fails on unknown and on stale proposals', () => {
    const del = write('delete_payment_method')
    expect(del.propose({ ref: refOf(DEFAULT_CASH_ID) }, ctx).ok).toBe(false)
    expect(del.propose({ ref: 'zzzzzz' }, ctx).ok).toBe(false)
    const p = del.propose({ ref: refOf(NBE) }, ctx)
    if (!p.ok) throw new Error('propose failed')
    state().deletePaymentMethod(NBE)
    expect(del.apply(p.proposal, ctx).ok).toBe(false)
  })

  it('localizes the cascade summary to Arabic', () => {
    const p = write('delete_payment_method').propose({ ref: refOf(CIB) }, { ...ctx, locale: 'ar' })
    expect(p.ok && p.proposal.preview.effect).toContain('تُغلق')
  })
})
