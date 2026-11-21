import { describe, it, expect } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

describe('updateExpense date move (L14)', () => {
  it('moves occurredAt with the date', () => {
    const s = useFinanceStore.getState()
    s.addExpense({ date: '2026-10-01', description: 'x', category: 'Food', amount: 5, currency: 'EGP', paymentMethodId: '', isRecurring: false, occurredAt: '2026-10-01T20:00:00.000Z' })
    const id = useFinanceStore.getState().expenses.at(-1)!.id
    useFinanceStore.getState().updateExpense(id, { date: '2026-10-05' })
    const e = useFinanceStore.getState().expenses.find((x) => x.id === id)!
    expect(e.occurredAt!.slice(0, 10)).toBe('2026-10-05')
  })
})

describe('S-6: updateIncomeEvent date move', () => {
  it('drops the old exact time when the received date moves to another day', () => {
    useFinanceStore.setState({ incomeEvents: [{ id: 'ie1', name: 'x', amount: 5, currency: 'EGP', receivedDate: '2026-10-01', status: 'received', occurredAt: '2026-10-01T20:00:00.000Z', createdAt: '2026-10-01T20:00:00.000Z' }] as never })
    useFinanceStore.getState().updateIncomeEvent('ie1', { receivedDate: '2026-10-05' })
    const e = useFinanceStore.getState().incomeEvents.find((x) => x.id === 'ie1')!
    expect(e.occurredAt === undefined || e.occurredAt.slice(0, 10) === '2026-10-05').toBe(true)
  })
})
