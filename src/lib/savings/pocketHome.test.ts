import { describe, expect, it } from 'vitest'
import { availableIn, pocketHome } from './pocketHome'
import type { LedgerInput } from '@/lib/accounts/balance'
import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'

const pm = (id: string, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2020-01-01', openingBalance: 10000, openingAt: '2020-01-01T00:00:00.000Z', ...over }) as PaymentMethod
const pocket = (id: string, currentBalance: number, heldInPaymentMethodId?: string): SavingsAccount =>
  ({ id, name: id, category: 'savings', type: 'bank', currency: 'EGP', currentBalance, createdAt: '2020-01-01', heldInPaymentMethodId }) as SavingsAccount
const ledger = (paymentMethods: PaymentMethod[], savingsAccounts: SavingsAccount[]): LedgerInput => ({
  paymentMethods, savingsAccounts, expenses: [], incomeEvents: [], debtPayments: [], debts: [], savingsTransactions: [], adjustments: [], convert: (a) => a,
})

describe('pocketHome', () => {
  const methods = [pm('H'), pm('U', { openingBalance: undefined, openingAt: undefined }), pm('Card', { type: 'credit_card' })]

  it('is reserved only when the holder is a tracked account', () => {
    expect(pocketHome(pocket('a', 1, 'H'), methods)).toEqual({ kind: 'reserved', accountId: 'H' })
    expect(pocketHome(pocket('b', 1), methods)).toEqual({ kind: 'outside' })
    expect(pocketHome(pocket('c', 1, 'U'), methods)).toEqual({ kind: 'outside' })
    expect(pocketHome(pocket('d', 1, 'Card'), methods)).toEqual({ kind: 'outside' })
    expect(pocketHome(pocket('e', 1, 'gone'), methods)).toEqual({ kind: 'outside' })
  })
})

describe('availableIn', () => {
  it('is the balance minus what is set aside, never below zero, and zero when untracked', () => {
    const methods = [pm('H'), pm('S', { openingBalance: 100 }), pm('U', { openingBalance: undefined, openingAt: undefined })]
    const l = ledger(methods, [pocket('a', 3000, 'H'), pocket('b', 500, 'S'), pocket('c', 900)])
    expect(availableIn('H', l)).toBe(7000)
    expect(availableIn('S', l)).toBe(0)
    expect(availableIn('U', l)).toBe(0)
  })
})
