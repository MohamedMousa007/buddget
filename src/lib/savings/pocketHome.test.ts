import { describe, expect, it } from 'vitest'
import { availableIn, depositLegId, depositRefusal, explainDepositRefusal, pocketHome } from './pocketHome'
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

describe('depositRefusal: a pocket held in an account (L1-A)', () => {
  // CIB holds the pocket: 5,000 with 500 set aside. QNB is another account with 1,000.
  const methods = [pm('CIB', { openingBalance: 5000 }), pm('QNB', { openingBalance: 1000 }), pm('USD', { currency: 'USD', openingBalance: 100 }), pm('U', { openingBalance: undefined, openingAt: undefined })]
  const rainy = pocket('rainy', 500, 'CIB')
  const l = ledger(methods, [rainy])

  it('the holder named as the source is a reserve of its own money: no leg, capped at its free money', () => {
    expect(depositLegId(methods, rainy, { fromAccountId: 'CIB' })).toBeUndefined()
    expect(depositRefusal(l, rainy, { amount: 4500, fromAccountId: 'CIB' })).toBeNull()
    expect(depositRefusal(l, rainy, { amount: 4501, fromAccountId: 'CIB' })).toBe('over_available')
  })

  it('another account as the source is a transfer, capped at that account\'s own free money', () => {
    expect(depositRefusal(l, rainy, { amount: 1000, fromAccountId: 'QNB' })).toBeNull()
    expect(depositRefusal(l, rainy, { amount: 2000, fromAccountId: 'QNB' })).toBe('over_available')
    const qnbBusy = ledger(methods, [rainy, pocket('other', 700, 'QNB')])
    expect(depositRefusal(qnbBusy, rainy, { amount: 301, fromAccountId: 'QNB' })).toBe('over_available')
    expect(depositRefusal(qnbBusy, rainy, { amount: 300, fromAccountId: 'QNB' })).toBeNull()
  })

  it('an explicit paymentMethodId cannot skip the cap, declared or not', () => {
    expect(depositRefusal(l, rainy, { amount: 2000, mode: 'declare', paymentMethodId: 'QNB' })).toBe('over_available')
    expect(depositRefusal(l, rainy, { amount: 2000, paymentMethodId: 'QNB' })).toBe('over_available')
    expect(depositRefusal(l, rainy, { amount: 1000, mode: 'declare', paymentMethodId: 'QNB' })).toBeNull()
    expect(depositRefusal(l, rainy, { amount: 4501, mode: 'declare', paymentMethodId: 'CIB' })).toBe('over_available')
  })

  it('a source with no known balance cannot fund a transfer', () => {
    expect(depositRefusal(l, rainy, { amount: 10, paymentMethodId: 'U' })).toBe('over_available')
    expect(depositRefusal(l, rainy, { amount: 10, paymentMethodId: 'gone' })).toBe('over_available')
  })

  it('a source in another currency is refused when there is no rate, and capped in its own currency when there is', () => {
    const noRate: LedgerInput = { ...l, convert: (a, from, to) => (from === to ? a : null) }
    expect(depositRefusal(noRate, rainy, { amount: 10, paymentMethodId: 'USD' })).toBe('no_rate')
    const rated: LedgerInput = { ...l, convert: (a, from, to) => (from === to ? a : from === 'EGP' ? a / 50 : a * 50) }
    expect(depositRefusal(rated, rainy, { amount: 5000, paymentMethodId: 'USD' })).toBeNull()
    expect(depositRefusal(rated, rainy, { amount: 5050, paymentMethodId: 'USD' })).toBe('over_available')
  })

  it('the refusal names the account that is short, not the holder', () => {
    expect(explainDepositRefusal(l, rainy, 'over_available', 'QNB').error).toContain('QNB only has 1000 EGP available')
    expect(explainDepositRefusal(l, rainy, 'over_available').error).toContain('CIB, which only has 4500 EGP available')
    expect(explainDepositRefusal(l, rainy, 'no_rate', 'USD').error).toContain('exchange rate')
  })
})
