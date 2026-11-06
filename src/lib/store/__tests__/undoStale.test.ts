import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Debt, SavingsAccount } from '@/lib/store/types'

const S = () => useFinanceStore.getState()
const ledger = (id: string) =>
  S().savingsTransactions.filter((t) => t.accountId === id).reduce((v, t) => v + (t.type === 'deposit' ? t.amount : -t.amount), 0)

beforeEach(() =>
  useFinanceStore.setState({
    savingsAccounts: [{ id: 'p', name: 'p', category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 0, createdAt: '2026-01-01' } as SavingsAccount],
    savingsTransactions: [], incomeEvents: [], expenses: [], goals: [], debtPayments: [], recurringDebtPayments: [],
    debts: [{ id: 'd', name: 'd', person: 'x', startingBalance: 1000, currency: 'EGP', isGold: false, status: 'active', debtType: 'personal', direction: 'i_owe', createdAt: '2026-01-01' } as Debt],
    exchangeRates: { USD_EGP: 50, EGP_USD: 0.02 },
  }),
)

describe('Undo after the returned money was spent is refused (FUZ-6)', () => {
  it('restoreDebtPayment: pocket spent before Undo -> refused, nothing minted', () => {
    S().depositToSavings('p', 100, 'EGP')
    const txId = crypto.randomUUID()
    S().withdrawFromSavings('p', 100, 'EGP', undefined, 'debt', { txId })
    S().addDebtPayment({ debtId: 'd', date: '2026-11-05', amountPaid: 100, paymentCurrency: 'EGP', originalAmount: 100, amountInPrimary: 100, fundedFromSavings: true, fundedFromSavingsTxId: txId } as never)
    const snap = S().deleteDebtPayment(S().debtPayments[0].id)!
    S().depositToSavings('p', 0.01, 'EGP')
    S().withdrawFromSavings('p', 100, 'EGP', undefined, 'spend')
    expect(S().restoreDebtPayment(snap)).toBe(false)
    expect(S().debtPayments).toHaveLength(0)
    expect(S().savingsAccounts[0].currentBalance).toBeCloseTo(0.01, 9)
    expect(ledger('p')).toBeCloseTo(S().savingsAccounts[0].currentBalance, 9)
  })

  it('restoreDebtPayment: an untouched pocket still undoes (returns true)', () => {
    S().depositToSavings('p', 100, 'EGP')
    const txId = crypto.randomUUID()
    S().withdrawFromSavings('p', 100, 'EGP', undefined, 'debt', { txId })
    S().addDebtPayment({ debtId: 'd', date: '2026-11-05', amountPaid: 100, paymentCurrency: 'EGP', originalAmount: 100, amountInPrimary: 100, fundedFromSavings: true, fundedFromSavingsTxId: txId } as never)
    const snap = S().deleteDebtPayment(S().debtPayments[0].id)!
    expect(S().restoreDebtPayment(snap)).toBe(true)
    expect(S().debtPayments).toHaveLength(1)
    expect(S().savingsAccounts[0].currentBalance).toBe(0)
  })

  it('restoreIncomeEvent: reversal deposit spent before Undo -> refused, pocket never negative, Undo works again once covered', () => {
    S().depositToSavings('p', 100, 'EGP')
    S().withdrawFromSavings('p', 100, 'EGP')
    const ev = S().incomeEvents[0]
    S().deleteIncomeEvent(ev.id)
    S().withdrawFromSavings('p', 100, 'EGP', undefined, 'spend')
    expect(S().restoreIncomeEvent(ev)).toBe(false)
    expect(S().incomeEvents).toHaveLength(0)
    expect(S().savingsAccounts[0].currentBalance).toBe(0)
    S().depositToSavings('p', 100, 'EGP')
    expect(S().restoreIncomeEvent(ev)).toBe(true)
    expect(S().incomeEvents).toHaveLength(1)
    expect(S().savingsAccounts[0].currentBalance).toBeGreaterThanOrEqual(0)
  })
})

describe('the store refuses a payment the debt cannot take (FRM-4)', () => {
  const pay = (amountPaid: number) => ({ debtId: 'd', date: '2026-11-05', amountPaid, paymentCurrency: 'EGP' as const })
  it('a payment above what is left is dropped', () => {
    S().addDebtPayment(pay(600))
    S().addDebtPayment(pay(500))
    expect(S().debtPayments.map((p) => p.amountPaid)).toEqual([600])
  })
  it('a second payment on a debt the first one cleared is dropped, with its expense', () => {
    const expense = { date: '2026-11-05', description: 'd', category: 'Debt', amount: 1000, currency: 'EGP' as const, paymentMethodId: 'x', isRecurring: false, linkedDebtId: 'd', isDebtPayment: true }
    S().addDebtPaymentWithExpense(pay(1000), expense)
    S().addDebtPaymentWithExpense(pay(1000), expense)
    expect(S().debtPayments).toHaveLength(1)
    expect(S().expenses).toHaveLength(1)
    expect(S().debts[0].status).toBe('cleared')
  })
  it('credit cards revolve and can still be overpaid', () => {
    useFinanceStore.setState({ debts: [{ ...S().debts[0], debtType: 'credit_card' }] })
    S().addDebtPayment(pay(1500))
    expect(S().debtPayments).toHaveLength(1)
  })
})
