import { describe, it, expect, beforeEach } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { PaymentMethod, Debt, Expense, Subscription } from '@/lib/store/types'

const pm = (id: string, isDefault: boolean): PaymentMethod =>
  ({ id, name: id, type: 'credit_card', currency: 'EGP', isDefault }) as PaymentMethod

const seed = (over: Partial<Parameters<typeof useFinanceStore.setState>[0]> = {}) =>
  useFinanceStore.setState({
    paymentMethods: [pm('pm1', true), pm('pm2', false)],
    debts: [{ id: 'd1', debtType: 'credit_card', linkedPaymentMethodId: 'pm1' } as Debt],
    expenses: [{ id: 'e1', paymentMethodId: 'pm1' } as Expense],
    subscriptions: [{ id: 's1', paymentMethodId: 'pm1' } as Subscription],
    incomeSources: [],
    incomeEvents: [],
    ...over,
  })

describe('deletePaymentMethod cascade', () => {
  beforeEach(() => seed())

  it('closes a referenced card instead of re-pointing its rows, and hands the default to an open method', () => {
    useFinanceStore.getState().deletePaymentMethod('pm1')
    const s = useFinanceStore.getState()
    expect(s.paymentMethods.find((m) => m.id === 'pm1')).toMatchObject({ closedAt: expect.any(String), isDefault: false })
    expect(s.paymentMethods.find((m) => m.id === 'pm2')).toMatchObject({ isDefault: true, updatedAt: expect.any(String) })
    expect(s.expenses[0].paymentMethodId).toBe('pm1')
    expect(s.subscriptions[0].paymentMethodId).toBe('pm1')
    expect(s.debts).toHaveLength(1)
  })

  it('hard-deletes an unreferenced card with its auto-created debt and promotes a default', () => {
    seed({ expenses: [], subscriptions: [], debts: [{ id: 'd1', debtType: 'credit_card', linkedPaymentMethodId: 'pm1', startingBalance: 0 } as Debt] })
    useFinanceStore.getState().deletePaymentMethod('pm1')
    const s = useFinanceStore.getState()
    expect(s.paymentMethods.map((m) => m.id)).toEqual(['pm2'])
    expect(s.paymentMethods[0].isDefault).toBe(true)
    expect(s.debts).toHaveLength(0)
  })

  it('closes an unused card whose debt carries a balance, and keeps the debt', () => {
    seed({ expenses: [], subscriptions: [], debts: [{ id: 'd1', debtType: 'credit_card', linkedPaymentMethodId: 'pm1', startingBalance: 500 } as Debt] })
    useFinanceStore.getState().deletePaymentMethod('pm1')
    const s = useFinanceStore.getState()
    expect(s.paymentMethods.find((m) => m.id === 'pm1')?.closedAt).toEqual(expect.any(String))
    expect(s.debts).toHaveLength(1)
  })

  it('never removes Cash and detaches child cards', () => {
    const bank = { ...pm('bk', false), type: 'bank_account' } as PaymentMethod
    const child = { ...pm('ch', false), type: 'debit_card', parentId: 'bk' } as PaymentMethod
    seed({ paymentMethods: [pm('pm1', true), bank, child, { ...pm('cash', false), type: 'cash' } as PaymentMethod], expenses: [], subscriptions: [], debts: [] })
    useFinanceStore.getState().deletePaymentMethod('cash')
    expect(useFinanceStore.getState().paymentMethods.some((m) => m.id === 'cash')).toBe(true)
    useFinanceStore.getState().deletePaymentMethod('bk')
    const s = useFinanceStore.getState()
    expect(s.paymentMethods.some((m) => m.id === 'bk')).toBe(false)
    expect(s.paymentMethods.find((m) => m.id === 'ch')?.parentId).toBeUndefined()
  })
})

describe('updatePaymentMethod single default', () => {
  beforeEach(() => seed())

  it('clears isDefault on the others when one is promoted', () => {
    useFinanceStore.getState().updatePaymentMethod('pm2', { isDefault: true })
    const defaults = useFinanceStore.getState().paymentMethods.filter((m) => m.isDefault)
    expect(defaults).toHaveLength(1)
    expect(defaults[0].id).toBe('pm2')
  })
})
