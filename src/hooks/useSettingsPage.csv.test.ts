import { describe, expect, it } from 'vitest'
import { expensesCsv } from './useSettingsPage'
import type { Expense } from '@/lib/store/types'

const exp = (over: Partial<Expense>): Expense => ({
  id: 'e', date: '2026-11-05', description: 'Shop', category: 'Shopping', amount: 10, currency: 'EGP', amountInBaseCurrency: 10,
  paymentMethodId: 'pm', isRecurring: false, createdAt: '', updatedAt: '', ...over,
})

describe('expensesCsv', () => {
  it('ends with a Counted column that is no for excluded and refunded rows', () => {
    const lines = expensesCsv(
      [exp({}), exp({ spendExclusion: 'manual' }), exp({ refundKind: 'refunded' })],
      () => 'Cash',
      { counted: 'Counted', yes: 'yes', no: 'no' },
    ).split('\n')
    expect(lines[0]).toBe('Date,Description,Category,Amount,Currency,Payment Method,"Counted"')
    expect(lines.slice(1).map((l) => l.split(',').pop())).toEqual(['"yes"', '"no"', '"no"'])
  })
})
