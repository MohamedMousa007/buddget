import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { accountsBasisFor } from '@/lib/accounts/netWorthBasis'
import { computeBalances } from '@/lib/accounts/balance'
import { setAside } from '@/lib/accounts/actions'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { defaultDepositSourceId } from '@/lib/savings/legChoices'
import { ledgerOf } from '@/lib/savings/pocketHome'
import type { PaymentMethod } from '@/lib/store/types'

const S = () => useFinanceStore.getState()
const pm = (id: string, openingBalance: number): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: id === 'qnb' ? '2026-01-01' : '2026-01-02', openingBalance, openingAt: '2026-01-01T00:00:00.000Z' }) as PaymentMethod
const balances = () => computeBalances(ledgerOf(S()))
const netWorth = () => {
  const s = S()
  return computeNetWorth({
    ...accountsBasisFor(ledgerOf(s), 'EGP'), savingsAccounts: s.savingsAccounts, investmentHoldings: [], debts: [], settings: s.settings,
    exchangeRates: {}, goldPricePerGram: 0, goldPriceAvailable: true, lookup: (() => null) as never, debtRemaining: 0,
  }).netWorth
}
const rainy = () => S().savingsAccounts[0]
/** What Wealth > Add money submits with nothing but the pocket and the amount chosen. */
const addMoney = (amount: number, fromAccountId = defaultDepositSourceId(S().paymentMethods, rainy(), 'EGP')) =>
  S().depositToSavings(rainy().id, amount, 'EGP', undefined, { mode: 'allocate', fromAccountId })

describe('L1-A: Wealth > Add money into a pocket held in an account', () => {
  // QNB is the primary account (older); the pocket is held in CIB: 5,000 with 500 set aside.
  beforeEach(() => {
    useFinanceStore.setState({
      paymentMethods: [pm('qnb', 1000), pm('cib', 5000)], savingsAccounts: [], savingsTransactions: [], incomeEvents: [], goals: [], expenses: [], debtPayments: [], debts: [], accountAdjustments: [],
      settings: { ...S().settings, baseCurrency: 'EGP' },
    })
    S().addSavingsAccount({ name: 'Rainy day', category: 'savings', type: 'bank', currency: 'EGP', openingBalance: 500, heldInPaymentMethodId: 'cib' } as never)
  })

  it('the default source is the holding account: its own money is set aside, nothing moves, net worth is unchanged', () => {
    expect(netWorth()).toBe(6000)
    expect(addMoney(2000)).toBe(true)
    expect(S().savingsTransactions.at(-1)!.paymentMethodId).toBeUndefined()
    expect(balances().get('cib')).toMatchObject({ balance: 5000, held: 2500, free: 2500 })
    expect(balances().get('qnb')).toMatchObject({ balance: 1000, free: 1000 })
    expect(netWorth()).toBe(6000)
  })

  it('more than the holder has free is refused', () => {
    expect(addMoney(4501)).toBe(false)
    expect(rainy().currentBalance).toBe(500)
    expect(balances().get('cib')).toMatchObject({ balance: 5000, held: 500, free: 4500 })
  })

  it('another account as the source is capped at its own free money: QNB never goes negative', () => {
    expect(addMoney(2000, 'qnb')).toBe(false)
    expect(rainy().currentBalance).toBe(500)
    expect(balances().get('qnb')).toMatchObject({ balance: 1000, free: 1000 })
    expect(balances().get('cib')).toMatchObject({ balance: 5000, held: 500, free: 4500 })
    expect(netWorth()).toBe(6000)
  })

  it('inside the cap it is a transfer: QNB down, CIB up, net worth unchanged', () => {
    expect(addMoney(800, 'qnb')).toBe(true)
    expect(S().savingsTransactions.at(-1)!.paymentMethodId).toBe('qnb')
    expect(balances().get('qnb')).toMatchObject({ balance: 200, free: 200 })
    expect(balances().get('cib')).toMatchObject({ balance: 5800, held: 1300, free: 4500 })
    expect(netWorth()).toBe(6000)
  })

  it('Accounts > Set aside from another account goes through the same cap', () => {
    setAside('qnb', rainy().id, 2000, 'EGP')
    expect(rainy().currentBalance).toBe(500)
    expect(balances().get('qnb')!.balance).toBe(1000)
    setAside('qnb', rainy().id, 1000, 'EGP')
    expect(balances().get('qnb')!.balance).toBe(0)
    expect(balances().get('cib')).toMatchObject({ balance: 6000, held: 1500 })
    expect(netWorth()).toBe(6000)
  })
})

describe('a pocket outside the accounts funded from a tracked account', () => {
  beforeEach(() => {
    useFinanceStore.setState({
      paymentMethods: [pm('qnb', 1000), pm('cib', 5000)], savingsAccounts: [], savingsTransactions: [], incomeEvents: [], goals: [], expenses: [], debtPayments: [], debts: [], accountAdjustments: [],
      settings: { ...S().settings, baseCurrency: 'EGP' },
    })
    S().addSavingsAccount({ name: 'Trip', category: 'savings', type: 'vault', currency: 'EGP' } as never)
  })
  const deposit = (amount: number, fromAccountId?: string) => S().depositToSavings(rainy().id, amount, 'EGP', undefined, fromAccountId ? { fromAccountId } : undefined)

  it('more than the account has free is refused: the account never goes below zero, net worth unchanged', () => {
    expect(deposit(2000)).toBe(false)
    expect(deposit(2000, 'qnb')).toBe(false)
    expect(rainy().currentBalance).toBe(0)
    expect(balances().get('qnb')!.balance).toBe(1000)
    expect(netWorth()).toBe(6000)
  })

  it('inside its free money the account goes down, the pocket up, net worth unchanged', () => {
    expect(deposit(1000)).toBe(true)
    expect(balances().get('qnb')!.balance).toBe(0)
    expect(rainy().currentBalance).toBe(1000)
    expect(deposit(1)).toBe(false)
    expect(deposit(5000, 'cib')).toBe(true)
    expect(netWorth()).toBe(6000)
  })
})

