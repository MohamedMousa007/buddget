import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { confirmRecurringDebtPayment, snoozeRecurringDebtPayment } from '@/lib/debts/recurringDebtDueHandlers'
import { installmentPaymentsCompleted } from '@/lib/debts/installmentSchedule'
import { perFromTotal } from '@/lib/debts/installmentPlan'
import type { Debt, RecurringDebtPayment } from '@/lib/store/types'

const S = () => useFinanceStore.getState()

function plan(total: number, count: number): Debt {
  return {
    id: 'inst', name: 'Car', person: 'Installment', startingBalance: total, currency: 'EGP', isGold: false,
    debtType: 'installment', direction: 'i_owe', status: 'active', createdAt: '2026-01-01',
    installmentCount: count, installmentAmount: perFromTotal(total, count), installmentFrequency: 'monthly', startDate: '2026-01-15',
  } as Debt
}

function load(total: number, count: number, over: Partial<RecurringDebtPayment> = {}) {
  useFinanceStore.setState({
    debts: [plan(total, count)], debtPayments: [], expenses: [], goals: [],
    paymentMethods: [{ id: 'pm1', name: 'Cash', type: 'cash', isDefault: true }] as never,
    recurringDebtPayments: [{
      id: 'r1', debtId: 'inst', amount: perFromTotal(total, count), currency: 'EGP', paymentMethodId: 'pm1',
      frequency: 'monthly', nextDueDate: '2026-03-05', dueDay: 5, isActive: true, createdAt: '2026-01-01', ...over,
    }],
  })
}

const next = () => S().recurringDebtPayments[0].nextDueDate

describe('DEB-6 / DEB-7: odd plans end on their last installment and read fully paid', () => {
  it('100 over 48 clears on the 48th confirmation with no 49th reminder', () => {
    load(100, 48, { nextDueDate: '2026-02-05' })
    for (let k = 0; k < 48; k++) expect(confirmRecurringDebtPayment('r1')).toBe(true)
    expect(S().debtPayments).toHaveLength(48)
    expect(S().debts[0].status).toBe('cleared')
    expect(S().recurringDebtPayments[0].isActive).toBe(false)
  })

  it('1000 over 36: a cleared plan reports 36 of 36', () => {
    load(1000, 36, { nextDueDate: '2026-02-05' })
    for (let k = 0; k < 36; k++) confirmRecurringDebtPayment('r1')
    expect(installmentPaymentsCompleted(S().debts[0], S().debtPayments)).toBe(36)
  })
})

describe('DEB-8: deleting the payment that advanced a reminder rolls the reminder back', () => {
  it('the instalment is reminded again, and Undo advances it again', () => {
    load(1200, 12)
    confirmRecurringDebtPayment('r1')
    expect(next()).toBe('2026-04-05')
    const snap = S().deleteDebtPayment(S().debtPayments[0].id)
    expect(next()).toBe('2026-03-05')
    expect(S().recurringDebtPayments[0].isActive).toBe(true)
    expect(S().restoreDebtPayment(snap!)).toBe(true)
    expect(next()).toBe('2026-04-05')
  })

  it('deleting an older payment leaves a newer advance alone', () => {
    load(1200, 12)
    confirmRecurringDebtPayment('r1')
    confirmRecurringDebtPayment('r1')
    expect(next()).toBe('2026-05-05')
    S().deleteDebtPayment(S().debtPayments[0].id)
    expect(next()).toBe('2026-05-05')
  })

  it('a manual payment on an unrelated date does not move the reminder', () => {
    load(1200, 12)
    S().addDebtPayment({ debtId: 'inst', date: '2026-03-19', amountPaid: 100, paymentCurrency: 'EGP' })
    const id = S().debtPayments[0].id
    S().deleteDebtPayment(id)
    expect(next()).toBe('2026-03-05')
  })
})

describe('DEB-9: a snooze never moves the monthly due day', () => {
  it('snooze one day then confirm: the next reminder is still the 5th', () => {
    load(1200, 12)
    snoozeRecurringDebtPayment('r1')
    expect(next()).toBe('2026-03-06')
    confirmRecurringDebtPayment('r1')
    expect(next()).toBe('2026-04-05')
  })

  it('several snoozes in a row, still the anchor day', () => {
    load(1200, 12)
    for (let k = 0; k < 4; k++) snoozeRecurringDebtPayment('r1')
    confirmRecurringDebtPayment('r1')
    expect(next()).toBe('2026-04-05')
  })

  it('a 31st reminder snoozed over the month end lands on the short month clamp', () => {
    load(1200, 12, { nextDueDate: '2026-01-31', dueDay: 31 })
    snoozeRecurringDebtPayment('r1')
    expect(next()).toBe('2026-02-01')
    confirmRecurringDebtPayment('r1')
    expect(next()).toBe('2026-02-28')
  })

  it('weekly reminders keep their existing behaviour', () => {
    load(1200, 12, { frequency: 'weekly', nextDueDate: '2026-03-02', dueDay: undefined })
    snoozeRecurringDebtPayment('r1')
    confirmRecurringDebtPayment('r1')
    expect(next()).toBe('2026-03-10')
  })
})
