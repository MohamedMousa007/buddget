import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { reconcileDebtSchedule } from '@/lib/debts/recurringDebtDueHandlers'
import { recurringDebtPaymentFromRow, recurringDebtPaymentToRow } from '@/lib/supabase/remote/mappers/recurringDebtPaymentMapper'

describe('recurring debt due_day anchor', () => {
  beforeEach(() => {
    useFinanceStore.setState({
      debts: [{ id: 'd1', name: 'Loan', debtType: 'personal', status: 'active', currency: 'EGP', totalAmount: 1000 } as never],
      debtPayments: [],
      expenses: [],
      recurringDebtPayments: [
        { id: 'r1', debtId: 'd1', amount: 100, currency: 'EGP', paymentMethodId: '', frequency: 'monthly', nextDueDate: '2026-02-28', dueDay: 31, isActive: true, createdAt: '2026-01-01' },
        { id: 'r2', debtId: 'd1', amount: 100, currency: 'EGP', paymentMethodId: '', frequency: 'monthly', nextDueDate: '2026-02-28', isActive: false, createdAt: '2026-01-01' },
      ],
    })
  })

  it('advances to the stored anchor day, not the clamped current day', () => {
    reconcileDebtSchedule('d1')
    expect(useFinanceStore.getState().recurringDebtPayments[0].nextDueDate).toBe('2026-03-31')
  })

  it('maps due_day both ways', () => {
    const r = useFinanceStore.getState().recurringDebtPayments[0]
    const row = recurringDebtPaymentToRow(r, 'u1')
    expect(row.due_day).toBe(31)
    expect(recurringDebtPaymentFromRow({ ...row, deleted_at: null, updated_at: '' } as never).dueDay).toBe(31)
    expect(recurringDebtPaymentToRow({ ...r, dueDay: undefined }, 'u1').due_day).toBeNull()
  })
})
