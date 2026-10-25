import { describe, it, expect, beforeEach } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { confirmRecurringDebtPayment } from '@/lib/debts/recurringDebtDueHandlers'
import { settlesWithoutExpense } from '@/lib/debts/debtDirection'
import { computeMonthlyStats } from '@/lib/utils/monthlyStats'
import { computeBalances } from '@/lib/accounts/balance'
import type { Debt, PaymentMethod, RecurringDebtPayment } from '@/lib/store/types'

const base = () => useFinanceStore.getState().settings.baseCurrency
const cash = (): PaymentMethod =>
  ({ id: 'cash1', name: 'Cash', type: 'cash', currency: base(), isDefault: true, openingBalance: 100, openingAt: '2026-01-01T00:00:00.000Z' }) as PaymentMethod
const debt = (direction: 'i_owe' | 'they_owe'): Debt => ({
  id: 'd1', name: 'Ali', person: 'Ali', startingBalance: 500, currency: base(), isGold: false,
  debtType: 'general', direction, status: 'active', createdAt: '2026-07-01',
})
const sched = (): RecurringDebtPayment => ({
  id: 's1', debtId: 'd1', amount: 100, currency: base(), paymentMethodId: 'cash1',
  frequency: 'monthly', nextDueDate: '2026-08-01', isActive: true, createdAt: '2026-07-01',
})

describe('they_owe repayments', () => {
  beforeEach(() => {
    useFinanceStore.setState({ paymentMethods: [cash()], debts: [debt('they_owe')], recurringDebtPayments: [sched()], debtPayments: [], expenses: [], goals: [] })
  })

  it('predicate: card and owed-to-you skip the expense, i_owe does not', () => {
    expect(settlesWithoutExpense(debt('they_owe'))).toBe(true)
    expect(settlesWithoutExpense({ ...debt('i_owe'), debtType: 'credit_card' })).toBe(true)
    expect(settlesWithoutExpense(debt('i_owe'))).toBe(false)
  })

  it('recurring handler records the payment but no expense', () => {
    expect(confirmRecurringDebtPayment('s1')).toBe(true)
    const s = useFinanceStore.getState()
    expect(s.debtPayments).toHaveLength(1)
    expect(s.expenses).toHaveLength(0)
  })

  it('i_owe still creates the Debt expense', () => {
    useFinanceStore.setState({ debts: [debt('i_owe')] })
    confirmRecurringDebtPayment('s1')
    expect(useFinanceStore.getState().expenses).toHaveLength(1)
  })

  it('received repayment credits the account instead of debiting it', () => {
    const payment = { id: 'p1', debtId: 'd1', date: '2026-10-05', amountPaid: 100, paymentMethodId: 'cash1', paymentCurrency: base() } as never
    const mk = (d: Debt) => ({
      paymentMethods: [cash()], expenses: [], incomeEvents: [], debtPayments: [payment], debts: [d],
      savingsTransactions: [], savingsAccounts: [], adjustments: [], convert: (a: number) => a,
    })
    expect(computeBalances(mk(debt('they_owe'))).get('cash1')?.balance).toBe(200)
    expect(computeBalances(mk(debt('i_owe'))).get('cash1')?.balance).toBe(0)
  })

  it('net worth debt total excludes they_owe balances', () => {
    const st = useFinanceStore.getState()
    const stats = (debts: Debt[]) => computeMonthlyStats({
      expenses: [], incomeSources: [], incomeEvents: [], budgetCategories: [], budgetPlans: [], budgetPlanActivations: [],
      activeBudgetPlanId: null, savingsHoldings: [], savingsAccounts: [], savingsTransactions: [], debts, debtPayments: [],
      settings: st.settings, exchangeRates: st.exchangeRates,
      goldPricePerGram: 0, goldPriceAvailable: false, monthFilter: '2026-10', trustLocalFinance: true,
    } as never).debtRemainingTotal
    expect(stats([debt('they_owe')])).toBe(0)
    expect(stats([debt('i_owe')])).toBe(500)
  })
})
