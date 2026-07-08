import { describe, it, expect, beforeEach } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import type { PaymentMethod, Debt, Expense, Subscription } from '@/lib/store/types'

const pm = (id: string, isDefault: boolean): PaymentMethod =>
  ({ id, name: id, type: 'card_credit', currency: 'EGP', isDefault }) as PaymentMethod

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

  it('promotes a new default, unlinks debt, and reassigns dependents to cash/null', () => {
    useFinanceStore.getState().deletePaymentMethod('pm1')
    const s = useFinanceStore.getState()
    expect(s.paymentMethods.map((m) => m.id)).toEqual(['pm2'])
    expect(s.paymentMethods.filter((m) => m.isDefault)).toHaveLength(1)
    expect(s.paymentMethods[0].isDefault).toBe(true)
    expect(s.debts[0].linkedPaymentMethodId).toBeUndefined()
    expect(s.expenses[0].paymentMethodId).toBe(DEFAULT_CASH_ID)
    expect(s.subscriptions[0].paymentMethodId).toBeNull()
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
