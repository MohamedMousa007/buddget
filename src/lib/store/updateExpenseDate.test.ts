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
