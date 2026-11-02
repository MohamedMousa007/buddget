import { describe, expect, it } from 'vitest'
import type { Expense } from '@/lib/store/types'
import { expensesForTail } from '../unplacedForTail'

const e = (id: string, o: Partial<Expense> = {}): Expense =>
  ({ id, amount: 10, currency: 'EGP', date: '2026-10-31', description: id, category: 'Food', isRecurring: false, smsLogId: `l-${id}`, createdAt: '', updatedAt: '', ...o }) as Expense

describe('expensesForTail', () => {
  const expenses = [e('a'), e('b'), e('placed', { paymentMethodId: 'bank' }), e('other')]
  const logs = [
    { expense_id: 'a', account_last4: '001' },
    { expense_id: 'b', account_last4: '0001' },
    { expense_id: 'placed', account_last4: '001' },
    { expense_id: 'other', account_last4: '5950' },
  ]
  it('picks the unplaced expenses whose message printed the same number, in either form', () => {
    expect(expensesForTail(expenses, logs, '0001').map((x) => x.id)).toEqual(['a', 'b'])
    expect(expensesForTail(expenses, logs, '5950').map((x) => x.id)).toEqual(['other'])
  })
  it('never touches expenses that already have an account, or messages with no number', () => {
    expect(expensesForTail(expenses, logs, '0001').some((x) => x.id === 'placed')).toBe(false)
    expect(expensesForTail(expenses, [{ expense_id: 'a', account_last4: null }], '0001')).toEqual([])
  })
})
