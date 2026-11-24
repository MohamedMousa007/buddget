import { describe, expect, it } from 'vitest'
import { cardDetails, sheetActivity } from './cardDetails'
import type { Debt, Expense, PaymentMethod } from '@/lib/store/types'

const bank = { id: 'bank', name: 'HSBC', type: 'bank_account', currency: 'EGP', isDefault: false } as PaymentMethod
const debit = { id: 'deb', name: 'HSBC', type: 'debit_card', currency: 'EGP', parentId: 'bank', isDefault: false } as PaymentMethod
const credit = { id: 'cc', name: 'HSBC', type: 'credit_card', currency: 'EGP', parentId: 'bank', isDefault: false } as PaymentMethod
const ccDebt = { id: 'd', debtType: 'credit_card', linkedPaymentMethodId: 'cc', currency: 'EGP', startingBalance: 200, creditLimit: 5000, status: 'active' } as unknown as Debt
const exp = (id: string, pm: string, date: string): Expense =>
  ({ id, date, description: id, category: 'Food', amount: 50, currency: 'EGP', amountInBaseCurrency: 50, paymentMethodId: pm, isRecurring: false, createdAt: `${date}T10:00:00Z` }) as Expense

describe('BUD-103 card details follow the carousel', () => {
  it('a debit card spends the account balance', () => {
    expect(cardDetails(debit, [], [], [], {})).toEqual({ kind: 'debit' })
  })
  it('a credit card shows its own outstanding and limit', () => {
    expect(cardDetails(credit, [ccDebt], [exp('c1', 'cc', '2026-11-02')], [], {})).toEqual({ kind: 'credit', outstanding: 250, limit: 5000, currency: 'EGP' })
  })
  it('a credit card with no linked debt has no outstanding to show', () => {
    expect(cardDetails(credit, [], [], [], {})).toMatchObject({ kind: 'credit', outstanding: null })
  })
})

describe('BUD-103 activity follows the selected card', () => {
  const methods = [bank, debit, credit]
  const expenses = [exp('a', 'deb', '2026-11-01'), exp('b', 'bank', '2026-11-02'), exp('c', 'cc', '2026-11-03')]
  it('lists only the selected card’s rows, and nothing (not the account) when it has none', () => {
    expect(sheetActivity(credit, 'bank', expenses, methods).map((e) => e.id)).toEqual(['c'])
    expect(sheetActivity({ ...debit, id: 'deb2' }, 'bank', expenses, methods)).toEqual([])
  })
  it('shows the whole account on the add-card slot', () => {
    expect(sheetActivity(undefined, 'bank', expenses, methods).map((e) => e.id)).toEqual(['b', 'a'])
  })
})
