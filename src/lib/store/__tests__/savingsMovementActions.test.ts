import { describe, it, expect, beforeEach } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { SavingsAccount } from '@/lib/store/types'

const pocket = (id: string, currency: SavingsAccount['currency'], bal: number, category: SavingsAccount['category'] = 'savings'): SavingsAccount => ({
  id,
  name: id,
  category,
  type: 'bank',
  currency,
  currentBalance: bal,
  createdAt: '2026-01-01',
})

const seed = (accounts: SavingsAccount[]) =>
  useFinanceStore.setState({
    savingsAccounts: accounts,
    savingsTransactions: [],
    incomeEvents: [],
    goals: [],
    exchangeRates: { USD_EGP: 50, EGP_USD: 0.02 },
  })

const S = () => useFinanceStore.getState()

describe('depositToSavings — declare vs allocate', () => {
  beforeEach(() => seed([pocket('p1', 'EGP', 0)]))

  it('allocate (default) is cash flow — counts against left-to-spend', () => {
    S().depositToSavings('p1', 100, 'EGP')
    const tx = S().savingsTransactions.at(-1)!
    expect(tx.isCashFlow).toBeUndefined() // undefined === true downstream
    expect(S().savingsAccounts[0].currentBalance).toBe(100)
  })

  it('declare marks the row non-cash-flow (raises net worth, not spent this month)', () => {
    S().depositToSavings('p1', 100, 'EGP', undefined, { mode: 'declare' })
    expect(S().savingsTransactions.at(-1)!.isCashFlow).toBe(false)
  })
})

describe('withdrawFromSavings — purpose gates the income event', () => {
  beforeEach(() => seed([pocket('p1', 'EGP', 500)]))

  it('income (default) creates one confirmed income event', () => {
    S().withdrawFromSavings('p1', 200, 'EGP')
    expect(S().incomeEvents).toHaveLength(1)
    expect(S().savingsAccounts[0].currentBalance).toBe(300)
  })

  it('spend / transfer / debt create NO income event', () => {
    S().withdrawFromSavings('p1', 100, 'EGP', undefined, 'spend')
    S().withdrawFromSavings('p1', 100, 'EGP', undefined, 'debt')
    expect(S().incomeEvents).toHaveLength(0)
    expect(S().savingsAccounts[0].currentBalance).toBe(300)
  })
})

describe('transferBetweenPockets', () => {
  it('same currency: two legs share a group id, both non-cash-flow, balances move', () => {
    seed([pocket('a', 'EGP', 500), pocket('b', 'EGP', 0)])
    S().transferBetweenPockets('a', 'b', 200)
    const s = S()
    expect(s.savingsAccounts.find((x) => x.id === 'a')!.currentBalance).toBe(300)
    expect(s.savingsAccounts.find((x) => x.id === 'b')!.currentBalance).toBe(200)
    const legs = s.savingsTransactions.filter((t) => t.transferGroupId)
    expect(legs).toHaveLength(2)
    expect(new Set(legs.map((l) => l.transferGroupId)).size).toBe(1)
    expect(legs.every((l) => l.isCashFlow === false)).toBe(true)
    expect(s.incomeEvents).toHaveLength(0)
  })

  it('FX-converts fiat to fiat on the destination leg', () => {
    seed([pocket('a', 'EGP', 500), pocket('b', 'USD', 0)])
    S().transferBetweenPockets('a', 'b', 100) // 100 EGP -> 2 USD at 0.02
    expect(S().savingsAccounts.find((x) => x.id === 'b')!.currentBalance).toBeCloseTo(2, 5)
  })

  it('rejects a move with no conversion path (a buy, not a transfer)', () => {
    seed([pocket('a', 'EGP', 500), pocket('g', 'XAU', 0, 'investment')])
    S().transferBetweenPockets('a', 'g', 100)
    // Nothing moved — EGP -> XAU grams has no FX path, so it is rejected.
    expect(S().savingsAccounts.find((x) => x.id === 'a')!.currentBalance).toBe(500)
    expect(S().savingsTransactions).toHaveLength(0)
  })

  it('rejects an overdraw', () => {
    seed([pocket('a', 'EGP', 50), pocket('b', 'EGP', 0)])
    S().transferBetweenPockets('a', 'b', 100)
    expect(S().savingsAccounts.find((x) => x.id === 'a')!.currentBalance).toBe(50)
  })
})

describe('withdraw → pay a debt (net-worth-neutral)', () => {
  it('debits the pocket and records a debt payment, no income event', () => {
    useFinanceStore.setState({
      savingsAccounts: [pocket('p1', 'EGP', 5000)],
      savingsTransactions: [],
      incomeEvents: [],
      goals: [],
      debts: [{ id: 'd1', name: 'valU', person: '', startingBalance: 3000, currency: 'EGP', isGold: false, createdAt: '2026-01-01' }],
      debtPayments: [],
      exchangeRates: { USD_EGP: 50, EGP_USD: 0.02 },
    })
    S().withdrawFromSavings('p1', 1000, 'EGP', undefined, 'debt')
    S().addDebtPayment({ debtId: 'd1', date: '2026-07-29', amountPaid: 1000, paymentCurrency: 'EGP' })
    expect(S().savingsAccounts[0].currentBalance).toBe(4000)
    expect(S().debtPayments).toHaveLength(1)
    expect(S().debtPayments[0].amountPaid).toBe(1000)
    expect(S().incomeEvents).toHaveLength(0)
  })
})

describe('withdraw → top up an investment holding (net-worth-neutral)', () => {
  it('debits the pocket and raises the holding quantity, no income event', () => {
    useFinanceStore.setState({
      savingsAccounts: [pocket('p1', 'EGP', 10000)],
      savingsTransactions: [],
      incomeEvents: [],
      goals: [],
      investmentHoldings: [{ id: 'h1', assetType: 'gold', name: '21k gold', quantity: 10, currency: 'EGP', karat: 21, createdAt: '2026-01-01' }],
      exchangeRates: { USD_EGP: 50, EGP_USD: 0.02 },
    })
    // 2 more grams at an assumed 1000 EGP/g unit value.
    const existing = S().investmentHoldings[0]
    S().withdrawFromSavings('p1', 2000, 'EGP', undefined, 'transfer')
    S().updateInvestmentHolding('h1', { quantity: existing.quantity + 2 })
    expect(S().savingsAccounts[0].currentBalance).toBe(8000)
    expect(S().investmentHoldings[0].quantity).toBe(12)
    expect(S().incomeEvents).toHaveLength(0)
  })
})

describe('deleteSavingsTransaction', () => {
  it('reverses a deposit', () => {
    seed([pocket('p1', 'EGP', 0)])
    S().depositToSavings('p1', 300, 'EGP')
    expect(S().savingsAccounts[0].currentBalance).toBe(300)
    S().deleteSavingsTransaction(S().savingsTransactions.at(-1)!.id)
    expect(S().savingsAccounts[0].currentBalance).toBe(0)
    expect(S().savingsTransactions).toHaveLength(0)
  })

  it('reverses both legs of a transfer', () => {
    seed([pocket('a', 'EGP', 500), pocket('b', 'EGP', 0)])
    S().transferBetweenPockets('a', 'b', 200)
    const leg = S().savingsTransactions.find((t) => t.transferGroupId)!
    S().deleteSavingsTransaction(leg.id)
    expect(S().savingsAccounts.find((x) => x.id === 'a')!.currentBalance).toBe(500)
    expect(S().savingsAccounts.find((x) => x.id === 'b')!.currentBalance).toBe(0)
    expect(S().savingsTransactions.filter((t) => t.transferGroupId)).toHaveLength(0)
  })
})
