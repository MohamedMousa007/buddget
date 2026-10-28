import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense, IncomeEvent } from '@/lib/store/types'
import { isOwed, recordRepayment, repaymentCandidates } from './receivable'

const expense = { id: 'e1', date: '2026-10-01', description: 'Hotel', category: 'Other', amount: 5000, currency: 'EGP', paymentMethodId: 'pm', isRecurring: false, spendExclusion: 'for_someone', owedBy: 'Dad' } as Expense
const income = (id: string, amount: number, receivedDate: string, extra: Partial<IncomeEvent> = {}) =>
  ({ id, name: 'Transfer', amount, currency: 'EGP', receivedDate, status: 'confirmed', paymentMethodId: 'pm', ...extra }) as IncomeEvent

describe('receivable', () => {
  it('is owed until settled', () => {
    expect(isOwed(expense)).toBe(true)
    expect(isOwed({ ...expense, owedSettledAt: 'x' })).toBe(false)
    expect(isOwed({ ...expense, spendExclusion: 'manual' })).toBe(false)
  })
  it('offers the closest recent one-off income, never salary or debt money', () => {
    const list = [income('a', 4000, '2026-10-05'), income('b', 5000, '2026-10-07'), income('c', 5000, '2026-10-07', { templateId: 't' }), income('d', 5000, '2026-08-01'), income('e', 5000, '2026-10-07', { linkedDebtId: 'x' })]
    expect(repaymentCandidates(expense, list, 'EGP').map((i) => i.id)).toEqual(['b', 'a'])
  })
  describe('recordRepayment', () => {
    beforeEach(() => {
      useFinanceStore.setState({
        expenses: [expense],
        paymentMethods: [{ id: 'pm', name: 'Bank', type: 'bank_account', currency: 'EGP', isDefault: false } as never],
        incomeEvents: [income('inc', 5000, '2026-10-07')],
        accountAdjustments: [],
      })
    })
    it('credits the account as an adjustment, not income, and settles the expense', () => {
      expect(recordRepayment({ expenseId: 'e1', accountId: 'pm', amount: 5000 })).toBe(true)
      const s = useFinanceStore.getState()
      expect(s.accountAdjustments).toHaveLength(1)
      expect(s.accountAdjustments[0]!.delta).toBe(5000)
      expect(s.incomeEvents).toHaveLength(1)
      expect(s.expenses[0]!.owedSettledAt).toBeTruthy()
    })
    it('replaces an already-captured income so the balance is credited once', () => {
      recordRepayment({ expenseId: 'e1', accountId: 'pm', amount: 5000, fromIncomeId: 'inc' })
      const s = useFinanceStore.getState()
      expect(s.incomeEvents).toHaveLength(0)
      expect(s.accountAdjustments.map((a) => a.delta)).toEqual([5000])
    })
  })
})
