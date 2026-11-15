import { describe, expect, it } from 'vitest'
import { computeBalances } from '@/lib/accounts/balance'
import type { Expense, PaymentMethod } from '@/lib/store/types'

const cash = { id: 'cash', name: 'Cash', type: 'cash', currency: 'EGP', isDefault: true, openingBalance: 200, openingAt: '2026-10-01T00:00:00.000Z' } as PaymentMethod
const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e', date: '2026-10-05', description: 'x', category: 'Shopping', amount: 100, currency: 'EGP', amountInBaseCurrency: 100,
  paymentMethodId: 'pm_default_cash', isRecurring: false, createdAt: '', updatedAt: '', ...over,
})
const balance = (e: Expense) =>
  computeBalances({ paymentMethods: [cash], expenses: [e], incomeEvents: [], debtPayments: [], debts: [], savingsTransactions: [], savingsAccounts: [], adjustments: [], convert: (a) => a }).get('cash')?.balance

describe('computeBalances unplaced SMS transfer', () => {
  it('credits the destination account and debits nothing when the source is unknown', () => {
    expect(balance(exp({ category: 'Transfer', paymentMethodId: undefined, smsLogId: 'log', toPaymentMethodId: 'cash' }))).toBe(300)
    expect(balance(exp({ smsLogId: 'log' }))).toBe(200)
  })
})

describe('computeBalances partial refund', () => {
  it('debits only the part of the purchase that was not refunded', () => {
    expect(balance(exp())).toBe(100)
    expect(balance(exp({ refundedAmount: 30 }))).toBe(130)
    expect(balance(exp({ refundedAmount: 100 }))).toBe(200)
  })
})
