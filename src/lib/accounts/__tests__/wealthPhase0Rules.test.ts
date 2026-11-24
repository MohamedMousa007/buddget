import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { accountsBasisFor } from '../netWorthBasis'
import { computeBalances } from '../balance'
import { setAside } from '../actions'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { tryConvertCurrency } from '@/lib/utils/currency'
import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'

const S = () => useFinanceStore.getState()
const pm = (id: string, openingBalance: number, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: `2020-01-0${id === 'H' ? 1 : 2}`, openingBalance, openingAt: '2020-01-01T00:00:00.000Z', ...over }) as PaymentMethod
const pocket = (id: string, currentBalance: number, over: Partial<SavingsAccount> = {}): SavingsAccount =>
  ({ id, name: id, category: 'savings', type: 'bank', currency: 'EGP', currentBalance, createdAt: '2020-01-01', ...over }) as SavingsAccount

const ledger = () => {
  const s = S()
  return {
    paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debtPayments: s.debtPayments, debts: s.debts,
    savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts, adjustments: s.accountAdjustments,
    convert: (a: number, from: string, to: string) => tryConvertCurrency(a, from, to, s.exchangeRates),
  }
}
const netWorth = () => {
  const s = S()
  return computeNetWorth({
    ...accountsBasisFor(ledger(), 'EGP'), savingsAccounts: s.savingsAccounts, investmentHoldings: [], debts: [], settings: s.settings,
    exchangeRates: s.exchangeRates, goldPricePerGram: 0, goldPriceAvailable: true, lookup: (() => null) as never, monthlyIncome: 0, cashOutflow: 0,
    debtRemaining: 0,
  }).netWorth
}
const acct = (id: string) => computeBalances(ledger()).get(id)!
const pocketBalance = (id: string) => S().savingsAccounts.find((p) => p.id === id)!.currentBalance
const rows = () => S().savingsTransactions.length

beforeEach(() =>
  useFinanceStore.setState({
    paymentMethods: [pm('H', 10000), pm('L', 1000)],
    savingsAccounts: [pocket('Trip', 3000, { heldInPaymentMethodId: 'H' }), pocket('Q', 500), pocket('U', 0, { currency: 'USD' })],
    savingsTransactions: [], incomeEvents: [], expenses: [], goals: [], debts: [], debtPayments: [], recurringDebtPayments: [], accountAdjustments: [],
    exchangeRates: { USD_EGP: 50, EGP_USD: 0.02 },
    settings: { ...S().settings, baseCurrency: 'EGP' },
  }),
)

describe('Phase 0 wealth rules, through the real store actions', () => {
  it('baseline: net worth 11,500, H available 7,000', () => {
    expect(netWorth()).toBe(11500)
    expect(acct('H').free).toBe(7000)
  })

  describe('R5 reserving never changes net worth', () => {
    it('from the holder itself (Accounts > Set aside): only available falls', () => {
      setAside('H', 'Trip', 1000, 'EGP')
      expect(pocketBalance('Trip')).toBe(4000)
      expect(acct('H').balance).toBe(10000)
      expect(acct('H').free).toBe(6000)
      expect(netWorth()).toBe(11500)
    })

    it('a budget deposit with no other account is a reserve of the holder', () => {
      expect(S().depositToSavings('Trip', 1000, 'EGP', undefined, { fromAccountId: null })).toBe(true)
      expect(acct('H').balance).toBe(10000)
      expect(acct('H').free).toBe(6000)
      expect(netWorth()).toBe(11500)
    })

    it('from another tracked account: that account falls, the holder rises, net worth unchanged', () => {
      expect(S().depositToSavings('Trip', 600, 'EGP', undefined, { fromAccountId: 'L' })).toBe(true)
      expect(acct('L').balance).toBe(400)
      expect(acct('H').balance).toBe(10600)
      expect(acct('H').free).toBe(7000)
      expect(netWorth()).toBe(11500)
    })

    it('round trip: reserve then release leaves every number where it started', () => {
      setAside('H', 'Trip', 1000, 'EGP')
      expect(S().withdrawFromSavings('Trip', 1000, 'EGP', undefined, 'income', { toAccountId: null })).toBe(true)
      expect(acct('H').balance).toBe(10000)
      expect(acct('H').free).toBe(7000)
      expect(netWorth()).toBe(11500)
    })
  })

  describe('R6 reserve cap', () => {
    it('refuses a reserve above what is available and writes nothing', () => {
      expect(S().depositToSavings('Trip', 7000.5, 'EGP', undefined, { mode: 'declare', paymentMethodId: 'H' })).toBe(false)
      expect(S().depositToSavings('Trip', 7000.5, 'EGP', undefined, { fromAccountId: null })).toBe(false)
      expect(rows()).toBe(0)
      expect(pocketBalance('Trip')).toBe(3000)
    })

    it('accepts exactly what is available', () => {
      expect(S().depositToSavings('Trip', 7000, 'EGP', undefined, { mode: 'declare', paymentMethodId: 'H' })).toBe(true)
      expect(acct('H').free).toBe(0)
      expect(netWorth()).toBe(11500)
    })

    it('editing a reserved pocket upward is capped the same way; downward always passes', () => {
      expect(S().correctSavingsBalance('Trip', 10000.5)).toBe(false)
      expect(pocketBalance('Trip')).toBe(3000)
      expect(S().correctSavingsBalance('Trip', 10000)).toBe(true)
      expect(acct('H').free).toBe(0)
      expect(S().correctSavingsBalance('Trip', 1000)).toBe(true)
      expect(acct('H').free).toBe(9000)
      expect(acct('H').balance).toBe(10000)
      expect(netWorth()).toBe(11500)
    })

    it('an outside pocket is edited freely', () => {
      expect(S().correctSavingsBalance('Q', 90000)).toBe(true)
      expect(netWorth()).toBe(101000)
    })
  })

  describe('R7 and R8: over-reserved account', () => {
    const overspend = () =>
      S().addExpense({ date: new Date().toISOString().slice(0, 10), occurredAt: new Date().toISOString(), description: 'x', category: 'Food', amount: 9000, currency: 'EGP', paymentMethodId: 'H', isRecurring: false })

    it('spending below the reserved total changes no pocket; available is zero; new reserves are refused', () => {
      overspend()
      expect(acct('H').balance).toBe(1000)
      expect(pocketBalance('Trip')).toBe(3000)
      expect(acct('H').free).toBe(0)
      expect(netWorth()).toBe(2500)
      expect(S().depositToSavings('Trip', 1, 'EGP', undefined, { mode: 'declare', paymentMethodId: 'H' })).toBe(false)
    })

    it('release is always allowed, also with nothing available, and moves no balance', () => {
      overspend()
      expect(S().withdrawFromSavings('Trip', 3000, 'EGP', undefined, 'income', { toAccountId: null })).toBe(true)
      expect(pocketBalance('Trip')).toBe(0)
      expect(acct('H').balance).toBe(1000)
      expect(acct('H').free).toBe(1000)
      expect(netWorth()).toBe(2500)
    })
  })

  describe('R9 external money is counted once', () => {
    it('new money into an outside pocket raises net worth by exactly that amount; deleting the row reverses it', () => {
      expect(S().depositToSavings('Q', 800, 'EGP', undefined, { mode: 'declare' })).toBe(true)
      expect(netWorth()).toBe(12300)
      expect(acct('H').balance).toBe(10000)
      expect(acct('L').balance).toBe(1000)
      expect(S().deleteSavingsTransaction(S().savingsTransactions[0].id).ok).toBe(true)
      expect(netWorth()).toBe(11500)
    })
  })

  describe('R10 external money cannot enter a reserved pocket directly', () => {
    it('refuses declared money that names no account', () => {
      expect(S().depositToSavings('Trip', 2000, 'EGP', undefined, { mode: 'declare' })).toBe(false)
      expect(rows()).toBe(0)
      expect(pocketBalance('Trip')).toBe(3000)
      expect(acct('H').free).toBe(7000)
    })

    it('the opening amount at creation still works', () => {
      const id = S().addSavingsAccount({ name: 'New', category: 'savings', type: 'bank', currency: 'EGP', heldInPaymentMethodId: 'H', openingBalance: 500 })
      expect(pocketBalance(id)).toBe(500)
      expect(acct('H').free).toBe(6500)
      expect(netWorth()).toBe(11500)
    })
  })

  describe('R16 a deposit that claims to come from an account must debit one', () => {
    it('refuses a budget deposit no account can fund', () => {
      expect(S().depositToSavings('U', 10, 'USD')).toBe(false)
      expect(S().depositToSavings('Q', 100, 'EGP', undefined, { fromAccountId: null })).toBe(false)
      expect(rows()).toBe(0)
      expect(netWorth()).toBe(11500)
    })

    it('"New money" is accepted and counted once', () => {
      expect(S().depositToSavings('U', 10, 'USD', undefined, { mode: 'declare' })).toBe(true)
      expect(netWorth()).toBe(12000)
    })

    it('with a valid account it is a transfer: account down, pocket up, net worth unchanged; deleting restores both', () => {
      expect(S().depositToSavings('Q', 400, 'EGP')).toBe(true)
      expect(S().savingsTransactions[0].paymentMethodId).toBe('H')
      expect(acct('H').balance).toBe(9600)
      expect(pocketBalance('Q')).toBe(900)
      expect(netWorth()).toBe(11500)
      S().deleteSavingsTransaction(S().savingsTransactions[0].id)
      expect(acct('H').balance).toBe(10000)
      expect(netWorth()).toBe(11500)
    })

    it('a user who tracks no account keeps today\'s leg-less budget deposit', () => {
      useFinanceStore.setState({ paymentMethods: [pm('H', 0, { openingBalance: undefined, openingAt: undefined })], savingsAccounts: [pocket('Q', 500)] })
      expect(S().depositToSavings('Q', 100, 'EGP')).toBe(true)
      expect(S().savingsTransactions[0].paymentMethodId).toBeUndefined()
      expect(S().savingsTransactions[0].isCashFlow).toBeUndefined()
    })
  })
})
