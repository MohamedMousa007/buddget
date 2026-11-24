import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { computeBalances } from '../balance'
import { detectGap, SKEW_MS } from '../gap'
import { depositsThatNeverLeft, resolveSurplus, transferSources } from '../gapSurplus'
import { accountsBasisFor } from '../netWorthBasis'
import { computeNetWorth } from '@/lib/savings/netWorth'
import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'

const S = () => useFinanceStore.getState()
const pm = (id: string, openingBalance: number, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2020-01-01', openingBalance, openingAt: '2020-01-01T00:00:00.000Z', ...over }) as PaymentMethod
const pocket = (id: string, currentBalance: number, over: Partial<SavingsAccount> = {}): SavingsAccount =>
  ({ id, name: id, category: 'savings', type: 'bank', currency: 'EGP', currentBalance, createdAt: '2020-01-01', ...over }) as SavingsAccount
const ledger = () => {
  const s = S()
  return {
    paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debtPayments: s.debtPayments, debts: s.debts,
    savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts, adjustments: s.accountAdjustments, convert: (a: number) => a,
  }
}
const netWorth = () => {
  const s = S()
  return computeNetWorth({
    ...accountsBasisFor(ledger(), 'EGP'), savingsAccounts: s.savingsAccounts, investmentHoldings: [], debts: [], settings: s.settings,
    exchangeRates: {}, goldPricePerGram: 0, goldPriceAvailable: true, lookup: (() => null) as never, debtRemaining: 0,
  }).netWorth
}

// Two bank reports, both 5,000 above the ledger: a persistent positive gap.
const HOUR = 3600_000
const now = Date.now()
const reports = (bankNow: number) => [
  { balance: bankNow, reportedAt: new Date(now - 2 * HOUR).toISOString() },
  { balance: bankNow, reportedAt: new Date(now - 26 * HOUR).toISOString() },
]
const gapOf = (bankNow: number) => detectGap(reports(bankNow), (instant) => computeBalances(ledger(), instant).get('H')?.balance, 1, now)
/** The ledger as the gap detector reads it: at the newest report, not now. */
const atReport = (bankNow: number) => computeBalances(ledger(), new Date(reports(bankNow)[0].reportedAt).getTime() + SKEW_MS).get('H')!.balance
const H = () => S().paymentMethods.find((m) => m.id === 'H')!

beforeEach(() =>
  useFinanceStore.setState({
    paymentMethods: [pm('H', 10000), pm('L', 8000), pm('D', 500, { currency: 'USD' })],
    savingsAccounts: [pocket('Q', 0), pocket('Trip', 1000, { heldInPaymentMethodId: 'H' })],
    savingsTransactions: [], incomeEvents: [], expenses: [], goals: [], debts: [], debtPayments: [], accountAdjustments: [],
    exchangeRates: {}, settings: { ...S().settings, baseCurrency: 'EGP' },
  }),
)

describe('a bank balance above the ledger (R24): every answer moves the ledger up to the bank', () => {
  it('the gap is signed: positive when the bank shows more', () => {
    expect(gapOf(15000)!.amount).toBe(5000)
    expect(gapOf(7000)!.amount).toBe(-3000)
  })

  it('income not logged: the account rises, net worth rises once, the report matches', () => {
    const before = netWorth()
    expect(resolveSurplus('income', { account: H(), amount: 5000, reportedAt: reports(15000)[0].reportedAt })).toBe(true)
    expect(atReport(15000)).toBe(15000)
    expect(gapOf(15000)).toBeNull()
    expect(netWorth()).toBe(before + 5000)
    expect(S().incomeEvents[0]).toMatchObject({ amount: 5000, paymentMethodId: 'H', status: 'confirmed' })
  })

  it('moved from another account: that account falls, net worth unchanged, the report matches', () => {
    const before = netWorth()
    expect(transferSources(S().paymentMethods, H()).map((m) => m.id)).toEqual(['L'])
    expect(resolveSurplus('transfer', { account: H(), amount: 5000, reportedAt: reports(15000)[0].reportedAt, fromAccountId: 'L' })).toBe(true)
    expect(atReport(15000)).toBe(15000)
    expect(gapOf(15000)).toBeNull()
    expect(computeBalances(ledger()).get('L')!.balance).toBe(3000)
    expect(netWorth()).toBe(before)
    expect(resolveSurplus('transfer', { account: H(), amount: 5000, reportedAt: reports(15000)[0].reportedAt })).toBe(false)
  })

  it('a pocket deposit that never left the bank: undoing it restores the account and leaves net worth unchanged', () => {
    // The app booked 5,000 out of H into an outside pocket two days ago; the bank still has it.
    const old = new Date(now - 48 * HOUR)
    useFinanceStore.setState({
      savingsAccounts: [pocket('Q', 5000), pocket('Trip', 1000, { heldInPaymentMethodId: 'H' })],
      savingsTransactions: [
        { id: 't1', accountId: 'Q', type: 'deposit', amount: 5000, currency: 'EGP', date: old.toISOString().slice(0, 10), occurredAt: old.toISOString(), paymentMethodId: 'H' },
        { id: 't2', accountId: 'Trip', type: 'deposit', amount: 1000, currency: 'EGP', date: old.toISOString().slice(0, 10), occurredAt: old.toISOString(), paymentMethodId: 'H', isCashFlow: false },
      ] as never,
    })
    expect(gapOf(10000)!.amount).toBe(5000)
    const before = netWorth()
    const found = depositsThatNeverLeft(ledger(), H(), gapOf(10000)!)
    expect(found.map((t) => t.id)).toEqual(['t1'])
    expect(resolveSurplus('pocket', { account: H(), amount: 5000, reportedAt: reports(10000)[0].reportedAt, deposits: found })).toBe(true)
    expect(atReport(10000)).toBe(10000)
    expect(gapOf(10000)).toBeNull()
    expect(S().savingsAccounts.find((p) => p.id === 'Q')!.currentBalance).toBe(0)
    expect(netWorth()).toBe(before)
  })

  it('only deposits that fit inside the surplus are offered', () => {
    const old = new Date(now - 48 * HOUR).toISOString()
    useFinanceStore.setState({
      savingsAccounts: [pocket('Q', 9000)],
      savingsTransactions: [
        { id: 'big', accountId: 'Q', type: 'deposit', amount: 7000, currency: 'EGP', date: old.slice(0, 10), occurredAt: old, paymentMethodId: 'H' },
        { id: 'fit', accountId: 'Q', type: 'deposit', amount: 2000, currency: 'EGP', date: old.slice(0, 10), occurredAt: old, paymentMethodId: 'H' },
      ] as never,
    })
    expect(depositsThatNeverLeft(ledger(), H(), gapOf(6000)!).map((t) => t.id)).toEqual(['fit'])
    expect(resolveSurplus('pocket', { account: H(), amount: 5000, reportedAt: new Date(now).toISOString(), deposits: [] })).toBe(false)
  })

  it('a deposit older than a bank report that matched the ledger did leave the bank and is never offered', () => {
    // Deposit two days ago; the report 26h ago matched the ledger (5,000); the newest shows 5,000 more.
    const old = new Date(now - 48 * HOUR).toISOString()
    useFinanceStore.setState({
      savingsAccounts: [pocket('Q', 5000)],
      savingsTransactions: [{ id: 'left', accountId: 'Q', type: 'deposit', amount: 5000, currency: 'EGP', date: old.slice(0, 10), occurredAt: old, paymentMethodId: 'H' }] as never,
    })
    const rs = [{ balance: 10000, reportedAt: new Date(now - 2 * HOUR).toISOString() }, { balance: 5000, reportedAt: new Date(now - 26 * HOUR).toISOString() }]
    const gap = detectGap(rs, (instant) => computeBalances(ledger(), instant).get('H')?.balance, 1, now)!
    expect(gap.amount).toBe(5000)
    expect(depositsThatNeverLeft(ledger(), H(), gap)).toEqual([])
  })

  it('a deposit from before the account had a balance never moved it and is never offered; nor is anything for a negative gap', () => {
    useFinanceStore.setState({
      savingsAccounts: [pocket('Q', 5000)],
      savingsTransactions: [{ id: 'ancient', accountId: 'Q', type: 'deposit', amount: 5000, currency: 'EGP', date: '2019-06-01', paymentMethodId: 'H' }] as never,
    })
    expect(gapOf(15000)!.amount).toBe(5000)
    expect(depositsThatNeverLeft(ledger(), H(), gapOf(15000)!)).toEqual([])
    expect(depositsThatNeverLeft(ledger(), H(), gapOf(7000)!)).toEqual([])
  })

  it('correct the balance: an adjustment dated before the report, so the report matches', () => {
    expect(resolveSurplus('correct', { account: H(), amount: 5000, reportedAt: reports(15000)[0].reportedAt })).toBe(true)
    expect(atReport(15000)).toBe(15000)
    expect(gapOf(15000)).toBeNull()
    expect(S().accountAdjustments[0]).toMatchObject({ delta: 5000, reason: 'gap', paymentMethodId: 'H' })
  })
})
