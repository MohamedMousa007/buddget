import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { calculateCashOutflow } from '@/lib/utils/calculations'
import { computeBalances } from '@/lib/accounts/balance'
import type { Debt, Expense, PaymentMethod, SavingsAccount } from '@/lib/store/types'

const S = () => useFinanceStore.getState()
const pocket = (bal: number): SavingsAccount =>
  ({ id: 'p', name: 'p', category: 'savings', type: 'bank', currency: 'EGP', currentBalance: bal, createdAt: '2026-01-01' }) as SavingsAccount
const debt = (): Debt =>
  ({ id: 'd1', name: 'Loan', person: 'x', startingBalance: 100, currency: 'EGP', isGold: false, status: 'active', debtType: 'personal', direction: 'i_owe', createdAt: '2026-01-01' }) as Debt

beforeEach(() =>
  useFinanceStore.setState({
    savingsAccounts: [pocket(500)], savingsTransactions: [], incomeEvents: [], expenses: [], goals: [],
    debts: [debt()], debtPayments: [], recurringDebtPayments: [],
    exchangeRates: { USD_EGP: 50, EGP_USD: 0.02 },
  }),
)

const payFromPocket = (link: boolean) => {
  const txId = crypto.randomUUID()
  S().withdrawFromSavings('p', 100, 'EGP', undefined, 'debt', { txId })
  S().addDebtPayment({ debtId: 'd1', date: '2026-11-05', amountPaid: 100, paymentCurrency: 'EGP', amountInPrimary: 100, fundedFromSavings: true, ...(link ? { fundedFromSavingsTxId: txId } : {}) })
  return txId
}

describe('deleting a savings-funded debt payment returns the money (WLT9)', () => {
  it('a withdrawal can carry a caller-chosen id', () => {
    const txId = payFromPocket(true)
    expect(S().savingsTransactions.map((t) => t.id)).toEqual([txId])
    expect(S().savingsAccounts[0].currentBalance).toBe(400)
  })

  it('removes the withdrawal, restores the pocket and reopens the debt', () => {
    payFromPocket(true)
    expect(S().debts[0].status).toBe('cleared')
    const snap = S().deleteDebtPayment(S().debtPayments[0].id)
    expect(S().savingsAccounts[0].currentBalance).toBe(500)
    expect(S().savingsTransactions).toHaveLength(0)
    expect(S().debts[0].status).toBe('active')
    expect(snap?.savingsTx?.amount).toBe(100)
  })

  it('Undo puts the payment back and takes the money out of the pocket again', () => {
    payFromPocket(true)
    const snap = S().deleteDebtPayment(S().debtPayments[0].id)!
    S().restoreDebtPayment(snap)
    expect(S().savingsAccounts[0].currentBalance).toBe(400)
    expect(S().savingsTransactions).toHaveLength(1)
    expect(S().debts[0].status).toBe('cleared')
  })

  it('a legacy payment with no link leaves the pocket as it was', () => {
    payFromPocket(false)
    const snap = S().deleteDebtPayment(S().debtPayments[0].id)
    expect(S().savingsAccounts[0].currentBalance).toBe(400)
    expect(S().savingsTransactions).toHaveLength(1)
    expect(snap?.savingsTx).toBeUndefined()
  })
})

describe('an expense logged by a Spend withdrawal is not counted twice (WLT1)', () => {
  const exp = (over: Partial<Expense> = {}): Expense => ({
    id: 'e1', date: '2026-11-05', description: 'Fridge', category: 'Shopping', amount: 100, currency: 'EGP', amountInBaseCurrency: 100,
    paymentMethodId: 'pm_default_cash', isRecurring: false, createdAt: '', updatedAt: '', ...over,
  })

  it('stays out of cash outflow when it carries the withdrawal id, counts when it does not', () => {
    const run = (e: Expense) => calculateCashOutflow({ monthExpenses: [e], monthDebtPayments: [], debts: [], monthSavingsDeposits: 0, baseCurrency: 'EGP', exchangeRates: {} })
    expect(run(exp())).toBe(100)
    expect(run(exp({ fundedFromSavingsTxId: 'tx1' }))).toBe(0)
  })

  it('does not drain the Cash account', () => {
    const cash = { id: 'cash', name: 'Cash', type: 'cash', currency: 'EGP', isDefault: true, openingBalance: 200, openingAt: '2026-10-01T00:00:00.000Z' } as PaymentMethod
    const ledger = (e: Expense) => ({ paymentMethods: [cash], expenses: [e], incomeEvents: [], debtPayments: [], debts: [], savingsTransactions: [], savingsAccounts: [], adjustments: [], convert: (a: number) => a })
    expect(computeBalances(ledger(exp({ date: '2026-10-05' }))).get('cash')?.balance).toBe(100)
    expect(computeBalances(ledger(exp({ date: '2026-10-05', fundedFromSavingsTxId: 'tx1' }))).get('cash')?.balance).toBe(200)
  })
})
