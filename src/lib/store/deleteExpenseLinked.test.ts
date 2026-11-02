import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const today = '2026-10-30'

function addPaidDebt() {
  const debtId = useFinanceStore.getState().addDebt({
    name: 'Phone', creditor: 'Shop', amount: 500, startingBalance: 500, remainingAmount: 500, currency: 'EGP',
    debtType: 'loan_taken', direction: 'owe', status: 'active', interestRate: 0, startedAt: today, notes: '', isGold: false,
  } as never)
  useFinanceStore.getState().addDebtPaymentWithExpense(
    { debtId, amountPaid: 500, paidDate: today, currency: 'EGP' } as never,
    { name: 'Phone', amount: 500, currency: 'EGP', category: 'loans', date: today, description: 'pay', isRecurring: false } as never,
  )
  return debtId
}

describe('deleteExpense on a debt payment expense', () => {
  beforeEach(() => useFinanceStore.setState({ debts: [], debtPayments: [], expenses: [], recurringDebtPayments: [], goals: [] }))

  it('removes the paired payment and reopens the debt it had cleared', () => {
    const debtId = addPaidDebt()
    expect(useFinanceStore.getState().debts.find((d) => d.id === debtId)!.status).toBe('cleared')

    useFinanceStore.getState().deleteExpense(useFinanceStore.getState().expenses[0].id)

    const s = useFinanceStore.getState()
    expect(s.expenses).toHaveLength(0)
    expect(s.debtPayments).toHaveLength(0)
    expect(s.debts.find((d) => d.id === debtId)!.status).toBe('active')
  })

  it('still deletes an ordinary expense without touching payments', () => {
    addPaidDebt()
    useFinanceStore.getState().addExpense({ date: today, description: 'coffee', category: 'Food', amount: 5, currency: 'EGP', paymentMethodId: '', isRecurring: false })
    const coffee = useFinanceStore.getState().expenses.find((e) => e.description === 'coffee')!

    useFinanceStore.getState().deleteExpense(coffee.id)

    const s = useFinanceStore.getState()
    expect(s.expenses.some((e) => e.description === 'coffee')).toBe(false)
    expect(s.debtPayments).toHaveLength(1)
  })
})
