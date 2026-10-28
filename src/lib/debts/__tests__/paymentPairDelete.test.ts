import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Debt, RecurringDebtPayment } from '@/lib/store/types'

const base = () => useFinanceStore.getState().settings.baseCurrency
const debt: Debt = {
  id: 'd1', name: 'Loan', person: 'Ahmed', startingBalance: 1000, currency: 'EGP', isGold: false,
  debtType: 'personal', direction: 'i_owe', status: 'active', createdAt: '2026-07-01',
}
const sched: RecurringDebtPayment = {
  id: 's1', debtId: 'd1', amount: 1000, currency: 'EGP', paymentMethodId: 'x',
  frequency: 'monthly', nextDueDate: '2026-11-05', isActive: true, createdAt: '2026-07-01',
}
const st = () => useFinanceStore.getState()

function payInFull() {
  st().addDebtPaymentWithExpense(
    { debtId: 'd1', date: '2026-10-01', amountPaid: 1000, paymentCurrency: base() },
    { date: '2026-10-01', description: 'Loan', category: 'Debt', amount: 1000, currency: base(), paymentMethodId: 'x', isRecurring: false, linkedDebtId: 'd1', isDebtPayment: true },
  )
  st().updateRecurringDebtPayment('s1', { isActive: false })
}

beforeEach(() => {
  useFinanceStore.setState({ debts: [debt], debtPayments: [], recurringDebtPayments: [sched], expenses: [], goals: [] })
})

describe('deleteDebtPayment pairs with its expense', () => {
  it('removes the paired expense, reopens the debt, wakes the reminder', () => {
    payInFull()
    const id = st().debtPayments[0].id
    const snap = st().deleteDebtPayment(id)
    expect(snap?.expenses).toHaveLength(1)
    expect(st().expenses).toHaveLength(0)
    expect(st().debts[0].status).toBe('active')
    expect(st().recurringDebtPayments[0].isActive).toBe(true)
  })

  it('undo restores the original rows and re-settles the debt', () => {
    payInFull()
    const payment = st().debtPayments[0]
    const expense = st().expenses[0]
    const snap = st().deleteDebtPayment(payment.id)!
    st().restoreDebtPayment(snap)
    expect(st().debtPayments[0]).toEqual(payment)
    expect(st().expenses[0]).toEqual(expense)
    expect(st().debts[0].status).toBe('cleared')
    expect(st().recurringDebtPayments[0].isActive).toBe(false)
  })

  it('does not wake a schedule when the debt has several, even if one is inactive', () => {
    payInFull()
    useFinanceStore.setState((s) => ({ recurringDebtPayments: [...s.recurringDebtPayments, { ...sched, id: 's2', isActive: false }] }))
    const id = st().debtPayments[0].id
    st().deleteDebtPayment(id)
    expect(st().recurringDebtPayments.every((r) => !r.isActive)).toBe(true)
  })

  it('returns null for an unknown payment', () => {
    expect(st().deleteDebtPayment('nope')).toBeNull()
  })
})
