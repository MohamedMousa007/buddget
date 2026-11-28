import { describe, expect, it } from 'vitest'
import type { Expense, PaymentMethod } from '@/lib/store/types'
import { removePaymentMethod } from '@/lib/accounts/removePaymentMethod'
import { resolveAccountId } from '@/lib/accounts/resolve'

const pm = (id: string, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2025-11-01', ...over }) as PaymentMethod
const spend = (id: string, paymentMethodId: string): Expense =>
  ({ id, amount: 100, currency: 'EGP', category: 'Food', description: id, date: '2025-11-05', paymentMethodId, isRecurring: false, createdAt: '2025-11-05' }) as Expense

const base = (expenses: Expense[]) => ({
  paymentMethods: [pm('CIB', { openingBalance: 5000 }), pm('CIB-debit', { type: 'debit_card', parentId: 'CIB' })],
  expenses, incomeEvents: [], debts: [], debtPayments: [], savingsTransactions: [], accountAdjustments: [],
  recurringDebtPayments: [], subscriptions: [], incomeSources: [], savingsAccounts: [],
})

describe('removing a bank account whose only history is on its debit card', () => {
  it('closes it instead of deleting, and the card history still moves that account', () => {
    const r = removePaymentMethod(base([spend('lunch', 'CIB-debit')]), 'CIB')
    if (!r || r === 'needs_answer') throw new Error('expected a removal')
    expect(r.closed).toBe(true)
    expect(r.paymentMethods.find((m) => m.id === 'CIB')?.closedAt).toBeTruthy()
    expect(resolveAccountId('CIB-debit', r.paymentMethods)).toBe('CIB')
  })

  it('still deletes it when neither it nor its cards have history, and frees the card', () => {
    const r = removePaymentMethod(base([]), 'CIB')
    if (!r || r === 'needs_answer') throw new Error('expected a removal')
    expect(r.closed).toBe(false)
    expect(r.paymentMethods.find((m) => m.id === 'CIB')).toBeUndefined()
    expect(r.paymentMethods.find((m) => m.id === 'CIB-debit')?.parentId).toBeUndefined()
  })
})
