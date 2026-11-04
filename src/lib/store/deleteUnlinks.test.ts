import { beforeEach, describe, expect, it } from 'vitest'
import type { Debt, Expense, IncomeEvent, SavingsAccount, Subscription } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const exp = (o: Partial<Expense>): Expense => ({ id: 'e', date: '2026-10-01', description: 'x', category: 'Food', amount: 10, currency: 'EGP', amountInBaseCurrency: 10, paymentMethodId: '', isRecurring: false, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', ...o }) as Expense
const inc = (o: Partial<IncomeEvent>): IncomeEvent => ({ id: 'i', name: 'x', amount: 5, currency: 'EGP', sourceType: 'other', receivedDate: '2026-10-01', status: 'confirmed', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', ...o }) as IncomeEvent

beforeEach(() => {
  useFinanceStore.setState({
    debts: [{ id: 'd1', name: 'Loan', person: 'A', currency: 'EGP', startingBalance: 100, direction: 'i_owe', status: 'active', debtType: 'personal', isGold: false, linkedDebtIds: [] } as unknown as Debt],
    debtPayments: [{ id: 'p1', debtId: 'd1', amountPaid: 10, date: '2026-10-01', createdAt: '' } as never],
    expenses: [exp({ id: 'paired', linkedDebtId: 'd1', linkedDebtPaymentId: 'p1' }), exp({ id: 'plain' })],
    incomeEvents: [inc({ id: 'repay', linkedDebtId: 'd1' }), inc({ id: 'dep', linkedSavingsAccountId: 's1' }), inc({ id: 'other' })],
    incomeSources: [], savingsAccounts: [{ id: 's1', name: 'Pocket' } as unknown as SavingsAccount], savingsTransactions: [], recurringSavingsDeposits: [], goals: [],
    recurringExpenses: [{ id: 'r1', description: 'Netflix' } as never],
    subscriptions: [{ id: 'sub1', name: 'Netflix', linkedRecurringExpenseId: 'r1' } as unknown as Subscription],
  })
})

describe('deleting a parent clears the ids that pointed at it, and keeps the rows', () => {
  it('deleteDebt', () => {
    useFinanceStore.getState().deleteDebt('d1')
    const s = useFinanceStore.getState()
    expect(s.debtPayments).toHaveLength(0)
    const paired = s.expenses.find((e) => e.id === 'paired')!
    expect(paired.linkedDebtId).toBeUndefined()
    expect(paired.linkedDebtPaymentId).toBeUndefined()
    expect(s.expenses).toHaveLength(2)
    expect(s.incomeEvents.find((e) => e.id === 'repay')!.linkedDebtId).toBeUndefined()
    expect(s.incomeEvents.find((e) => e.id === 'other')).toBeDefined()
  })
  it('deleteSavingsAccount', () => {
    useFinanceStore.getState().deleteSavingsAccount('s1')
    expect(useFinanceStore.getState().incomeEvents.find((e) => e.id === 'dep')!.linkedSavingsAccountId).toBeUndefined()
  })
  it('deleteRecurringExpense', () => {
    useFinanceStore.getState().deleteRecurringExpense('r1')
    expect(useFinanceStore.getState().subscriptions[0].linkedRecurringExpenseId).toBeNull()
  })
})
