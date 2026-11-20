import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { accountsBasisFor } from '../netWorthBasis'
import { computeBalances } from '../balance'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { DEFAULT_CASH_ID } from '../kinds'
import type { Debt, PaymentMethod, SavingsAccount } from '@/lib/store/types'

const S = () => useFinanceStore.getState()
const pm = (id: string, openingBalance: number): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2026-01-01', openingBalance, openingAt: '2026-01-01T00:00:00.000Z' }) as PaymentMethod
const pocket = (id: string, currentBalance: number, over: Partial<SavingsAccount> = {}): SavingsAccount =>
  ({ id, name: id, category: 'savings', type: 'bank', currency: 'EGP', currentBalance, createdAt: '2026-01-01', ...over }) as SavingsAccount
const card = (): Debt =>
  ({ id: 'card', name: 'Card', person: 'x', startingBalance: 2000, currency: 'EGP', isGold: false, status: 'active', debtType: 'personal', direction: 'i_owe', createdAt: '2026-01-01' }) as Debt

const ledger = () => {
  const s = S()
  return {
    paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debtPayments: s.debtPayments, debts: s.debts,
    savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts, adjustments: s.accountAdjustments, convert: (a: number) => a,
  }
}
/** Invested money is a holding outside the store here: the invest test adds it back explicitly. */
const netWorth = (invested = 0) => {
  const s = S()
  const paid = s.debtPayments.reduce((n, p) => n + p.amountPaid, 0)
  return computeNetWorth({
    ...accountsBasisFor(ledger(), 'EGP'), savingsAccounts: s.savingsAccounts, investmentHoldings: [], debts: [], settings: s.settings,
    exchangeRates: {}, goldPricePerGram: 0, goldPriceAvailable: true, lookup: (() => null) as never, monthlyIncome: 0, cashOutflow: 0,
    debtRemaining: 2000 - paid,
  }).netWorth + invested
}
const acct = (id: string) => computeBalances(ledger()).get(id)!

beforeEach(() =>
  useFinanceStore.setState({
    paymentMethods: [pm('H', 10000), pm('L', 1000)],
    savingsAccounts: [pocket('Trip', 3000, { heldInPaymentMethodId: 'H' }), pocket('Trip2', 0, { heldInPaymentMethodId: 'H' }), pocket('Q', 500)],
    savingsTransactions: [], incomeEvents: [], expenses: [], goals: [], debts: [card()], debtPayments: [], recurringDebtPayments: [], accountAdjustments: [],
    exchangeRates: { USD_EGP: 50, EGP_USD: 0.02 },
  }),
)

describe('S-2: every exit of a held pocket, through the real store actions', () => {
  it('baseline is 9,500 with H free 7,000', () => {
    expect(netWorth()).toBe(9500)
    expect(acct('H').free).toBe(7000)
  })

  it('1a income that stays in H: nothing moves', () => {
    S().withdrawFromSavings('Trip', 600, 'EGP', undefined, 'income', { toAccountId: null })
    expect(acct('H').balance).toBe(10000)
    expect(acct('H').free).toBe(7600)
    expect(netWorth()).toBe(9500)
  })

  it('1b income sent to L: H drops, L rises, net worth unchanged', () => {
    S().withdrawFromSavings('Trip', 600, 'EGP', undefined, 'income', { toAccountId: 'L' })
    expect(acct('H').balance).toBe(9400)
    expect(acct('L').balance).toBe(1600)
    expect(acct('H').free).toBe(7000)
    expect(netWorth()).toBe(9500)
  })

  it('2 spend, with and without the logged expense: H drops once', () => {
    S().withdrawFromSavings('Trip', 600, 'EGP', undefined, 'spend')
    expect(acct('H').balance).toBe(9400)
    expect(acct('H').free).toBe(7000)
    expect(netWorth()).toBe(8900)
    const txId = crypto.randomUUID()
    S().withdrawFromSavings('Trip', 100, 'EGP', undefined, 'spend', { txId })
    S().addExpense({ date: '2026-11-20', description: 'x', category: 'Food', amount: 100, currency: 'EGP', paymentMethodId: DEFAULT_CASH_ID, isRecurring: false, fundedFromSavingsTxId: txId })
    expect(acct('H').balance).toBe(9300)
    expect(netWorth()).toBe(8800)
  })

  it('3 pay a debt: net worth unchanged, then delete and Undo reverse and restore the leg', () => {
    const txId = crypto.randomUUID()
    S().withdrawFromSavings('Trip', 600, 'EGP', undefined, 'debt', { txId })
    S().addDebtPayment({ debtId: 'card', date: '2026-11-20', amountPaid: 600, paymentCurrency: 'EGP', amountInPrimary: 600, fundedFromSavings: true, fundedFromSavingsTxId: txId })
    expect(acct('H').balance).toBe(9400)
    expect(netWorth()).toBe(9500)
    const snap = S().deleteDebtPayment(S().debtPayments[0].id)!
    expect(acct('H').balance).toBe(10000)
    expect(netWorth()).toBe(9500)
    S().restoreDebtPayment(snap)
    expect(acct('H').balance).toBe(9400)
    expect(netWorth()).toBe(9500)
  })

  it('4a move held -> standalone and 4b standalone -> held', () => {
    expect(S().transferBetweenPockets('Trip', 'Q', 600)).toBe(true)
    expect(acct('H').balance).toBe(9400)
    expect(netWorth()).toBe(9500)
    expect(S().transferBetweenPockets('Q', 'Trip', 1100)).toBe(true)
    expect(acct('H').balance).toBe(10500)
    expect(netWorth()).toBe(9500)
  })

  it('4c move between two pockets of the same holder changes nothing', () => {
    S().transferBetweenPockets('Trip', 'Trip2', 600)
    expect(acct('H').balance).toBe(10000)
    expect(netWorth()).toBe(9500)
  })

  it('5 invest: H drops by the invested amount', () => {
    S().withdrawFromSavings('Trip', 600, 'EGP', undefined, 'transfer')
    expect(acct('H').balance).toBe(9400)
    expect(netWorth(600)).toBe(9500)
  })

  it('deleting the withdrawal of a spend gives the money back', () => {
    S().withdrawFromSavings('Trip', 600, 'EGP', undefined, 'spend')
    expect(S().deleteSavingsTransaction(S().savingsTransactions[0].id).ok).toBe(true)
    expect(acct('H').balance).toBe(10000)
    expect(netWorth()).toBe(9500)
  })

  it('every row the actions write has an exact timestamp, shared by both transfer legs', () => {
    S().withdrawFromSavings('Trip', 100, 'EGP', undefined, 'spend')
    S().transferBetweenPockets('Trip', 'Q', 100)
    const txs = S().savingsTransactions
    expect(txs).toHaveLength(3)
    expect(txs.every((t) => !!t.occurredAt)).toBe(true)
    const [a, b] = txs.filter((t) => t.transferGroupId)
    expect(a.occurredAt).toBe(b.occurredAt)
  })
})
