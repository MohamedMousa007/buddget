import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { confirmRecurringDebtPayment } from '@/lib/debts/recurringDebtDueHandlers'
import { installmentPaymentsCompleted } from '@/lib/debts/installmentSchedule'
import { perFromTotal } from '@/lib/debts/installmentPlan'
import type { Debt } from '@/lib/store/types'

const S = () => useFinanceStore.getState()

function plan(total: number, count: number): Debt {
  return {
    id: 'inst', name: 'Car', person: 'Installment', startingBalance: total, currency: 'EGP', isGold: false,
    debtType: 'installment', direction: 'i_owe', status: 'active', createdAt: '2026-01-01',
    installmentCount: count, installmentAmount: perFromTotal(total, count), installmentFrequency: 'monthly', startDate: '2026-01-15',
  } as Debt
}

function load(total: number, count: number) {
  useFinanceStore.setState({
    debts: [plan(total, count)], debtPayments: [], expenses: [], goals: [],
    paymentMethods: [{ id: 'pm1', name: 'Cash', type: 'cash', isDefault: true }] as never,
    recurringDebtPayments: [{
      id: 'r1', debtId: 'inst', amount: perFromTotal(total, count), currency: 'EGP', paymentMethodId: 'pm1',
      frequency: 'monthly', nextDueDate: '2026-02-15', dueDay: 15, isActive: true, createdAt: '2026-01-01',
    }],
  })
}

beforeEach(() => load(328264.39, 24))

describe('a scheduled installment plan clears on its last confirmed payment (FUZ-4)', () => {
  it('24 installments of 328,264.39: the 24th pays the remainder, the debt clears, the reminder stops', () => {
    for (let k = 0; k < 24; k++) expect(confirmRecurringDebtPayment('r1')).toBe(true)
    const paid = S().debtPayments.reduce((s, p) => s + Math.round(p.amountPaid * 100), 0)
    expect(S().debtPayments).toHaveLength(24)
    expect(paid).toBe(32826439)
    expect(S().debts[0].status).toBe('cleared')
    expect(S().recurringDebtPayments[0].isActive).toBe(false)
    expect(installmentPaymentsCompleted(S().debts[0], S().debtPayments)).toBe(24)
  })

  it('a plan whose slices overshoot the total (10.01 over 3) also ends on exactly 3 payments', () => {
    load(10.01, 3)
    for (let k = 0; k < 3; k++) confirmRecurringDebtPayment('r1')
    expect(S().debtPayments.map((p) => p.amountPaid)).toEqual([3.34, 3.34, 3.33])
    expect(S().debts[0].status).toBe('cleared')
    expect(installmentPaymentsCompleted(S().debts[0], S().debtPayments)).toBe(3)
  })
})
