import { describe, it, expect, beforeEach } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { IncomeEvent, Debt, DebtPayment, RecurringDebtPayment } from '@/lib/store/types'

const seed = () =>
  useFinanceStore.setState({
    incomeEvents: [{ id: 'ev1', name: 'Loan from Ahmed', amount: 10000, currency: 'EGP', receivedDate: '2026-07-01', status: 'confirmed', linkedDebtId: 'd1' } as IncomeEvent],
    debts: [{ id: 'd1', name: 'Ahmed', debtType: 'personal' } as Debt],
    debtPayments: [{ id: 'p1', debtId: 'd1' } as DebtPayment],
    recurringDebtPayments: [{ id: 'r1', debtId: 'd1' } as RecurringDebtPayment],
    goals: [],
  })

describe('deleteIncomeEvent + borrowed-money debt', () => {
  beforeEach(() => seed())

  it('cascades the debt and its payments when deleteLinkedDebt=true', () => {
    useFinanceStore.getState().deleteIncomeEvent('ev1', true)
    const s = useFinanceStore.getState()
    expect(s.incomeEvents.find((e) => e.id === 'ev1')).toBeUndefined()
    expect(s.debts.find((d) => d.id === 'd1')).toBeUndefined()
    expect(s.debtPayments.filter((p) => p.debtId === 'd1')).toHaveLength(0)
    expect(s.recurringDebtPayments.filter((r) => r.debtId === 'd1')).toHaveLength(0)
  })

  it('keeps the debt when deleteLinkedDebt is falsy', () => {
    useFinanceStore.getState().deleteIncomeEvent('ev1')
    const s = useFinanceStore.getState()
    expect(s.incomeEvents.find((e) => e.id === 'ev1')).toBeUndefined()
    expect(s.debts.find((d) => d.id === 'd1')).toBeDefined()
    expect(s.debtPayments.filter((p) => p.debtId === 'd1')).toHaveLength(1)
  })
})
