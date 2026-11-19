import { describe, expect, it } from 'vitest'
import { largestPurchase } from '@/hooks/useReportsPage'
import type { Expense } from '@/lib/store/types'

const e = (over: Partial<Expense>): Expense => ({
  id: 'x', date: '2026-10-01', description: 'x', category: 'Food', amount: 1, currency: 'EGP', amountInBaseCurrency: 1,
  paymentMethodId: 'pm', isRecurring: false, createdAt: '', updatedAt: '', ...over,
}) as Expense

describe('largestPurchase (QA-95)', () => {
  it('skips a bigger debt payment and picks the biggest real purchase', () => {
    const rows = [e({ id: 'd', category: 'Debt', amount: 500, amountInBaseCurrency: 500 }), e({ id: 'g', description: 'Groceries', amount: 300, amountInBaseCurrency: 300 })]
    expect(largestPurchase(rows, 'EGP', {})?.id).toBe('g')
  })
  it('is null when only debt payments exist', () => {
    expect(largestPurchase([e({ category: 'Debt', amount: 5 })], 'EGP', {})).toBeNull()
  })
})
