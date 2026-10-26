import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { reconcileDebtSchedule } from '@/lib/debts/recurringDebtDueHandlers'
import type { Debt, RecurringDebtPayment } from '@/lib/store/types'

const base = () => useFinanceStore.getState().settings.baseCurrency
const debt = (over: Partial<Debt> = {}): Debt => ({
  id: 'd1', name: 'Loan', person: 'Ahmed', startingBalance: 1000, currency: base(), isGold: false,
  debtType: 'personal', direction: 'i_owe', status: 'active', createdAt: '2026-07-01', ...over,
})
const pay = (amountPaid: number, id = 'd1') => ({ debtId: id, date: '2026-10-01', amountPaid, paymentCurrency: base() })
const status = (id = 'd1') => useFinanceStore.getState().debts.find((d) => d.id === id)?.status

beforeEach(() => {
  useFinanceStore.setState({ debts: [debt()], debtPayments: [], recurringDebtPayments: [], expenses: [], goals: [] })
})

describe('recurring reminder anchor', () => {
  it('follows the schedule day, not the debt start date', () => {
    useFinanceStore.setState({
      debts: [debt({ startDate: '2026-01-31' })],
      recurringDebtPayments: [{
        id: 's1', debtId: 'd1', amount: 100, currency: base(), paymentMethodId: 'x',
        frequency: 'monthly', nextDueDate: '2026-02-28', isActive: true, createdAt: '2026-01-31',
      }],
    })
    reconcileDebtSchedule('d1')
    expect(useFinanceStore.getState().recurringDebtPayments[0].nextDueDate).toBe('2026-03-28')
  })
})

describe('paying a debt in full', () => {
  it('keeps the debt active until it is covered, then clears it', () => {
    useFinanceStore.getState().addDebtPayment(pay(400))
    expect(status()).toBe('active')
    useFinanceStore.getState().addDebtPayment(pay(600))
    expect(status()).toBe('cleared')
    expect(useFinanceStore.getState().debts[0].clearedAt).toBeTruthy()
  })

  it('clears through the expense path too', () => {
    useFinanceStore.getState().addDebtPaymentWithExpense(pay(1000), {
      date: '2026-10-01', description: 'Loan', category: 'Debt', amount: 1000, currency: base(),
      paymentMethodId: 'x', isRecurring: false, linkedDebtId: 'd1', isDebtPayment: true,
    })
    expect(status()).toBe('cleared')
  })

  it('reopens when the covering payment is deleted', () => {
    useFinanceStore.getState().addDebtPayment(pay(1000))
    const id = useFinanceStore.getState().debtPayments[0].id
    useFinanceStore.getState().deleteDebtPayment(id)
    expect(status()).toBe('active')
  })

  it('never clears a revolving credit card', () => {
    useFinanceStore.setState({ debts: [debt({ debtType: 'credit_card' })] })
    useFinanceStore.getState().addDebtPayment(pay(1000))
    expect(status()).toBe('active')
  })

  it('a final payment deactivates the reminder instead of advancing it', () => {
    const sched: RecurringDebtPayment = {
      id: 's1', debtId: 'd1', amount: 500, currency: base(), paymentMethodId: 'x',
      frequency: 'monthly', nextDueDate: '2026-10-05', isActive: true, createdAt: '2026-07-01',
    }
    useFinanceStore.setState({ recurringDebtPayments: [sched] })
    useFinanceStore.getState().addDebtPayment(pay(500))
    reconcileDebtSchedule('d1')
    expect(useFinanceStore.getState().recurringDebtPayments[0].nextDueDate).toBe('2026-11-05')
    useFinanceStore.getState().addDebtPayment(pay(500))
    reconcileDebtSchedule('d1')
    expect(status()).toBe('cleared')
    expect(useFinanceStore.getState().recurringDebtPayments[0].isActive).toBe(false)
  })
})
