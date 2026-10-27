import { describe, expect, it } from 'vitest'
import type { Debt, DebtPayment, PaymentMethod } from '@/lib/store/types'
import { computeBalances, type LedgerInput } from '../balance'

const bank = { id: 'bank', name: 'bank', type: 'bank_account', currency: 'EGP', isDefault: false, openingBalance: 10000, openingAt: '2026-10-01T00:00:00.000Z', createdAt: '' } as PaymentMethod
const card = { id: 'cc', name: 'cc', type: 'credit_card', currency: 'EGP', isDefault: false, createdAt: '' } as PaymentMethod
const usdDebt = { id: 'd1', debtType: 'credit_card', direction: 'i_owe', currency: 'USD', isGold: false, status: 'active' } as Debt

describe('D2: a cross-currency debt payment with no expense debits the account by what was paid', () => {
  it('debits 4700 EGP, not the 94 USD debt units', () => {
    const p: DebtPayment = {
      id: 'p1', debtId: 'd1', date: '2026-10-05', amountPaid: 94, paymentCurrency: 'EGP',
      originalAmount: 4700, paymentMethodId: 'bank', createdAt: '',
    }
    const input: LedgerInput = {
      paymentMethods: [bank, card], expenses: [], incomeEvents: [], debts: [usdDebt], debtPayments: [p],
      savingsTransactions: [], savingsAccounts: [], adjustments: [], convert: (a) => a,
    }
    expect(computeBalances(input).get('bank')?.balance).toBe(5300)
  })
})
