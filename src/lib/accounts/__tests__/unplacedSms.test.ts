import { describe, expect, it } from 'vitest'
import type { Expense } from '@/lib/store/types'
import { totalsByCurrency, unplacedSmsExpenses } from '../unplacedSms'

const e = (o: Partial<Expense>): Expense =>
  ({ id: 'x', amount: 10, currency: 'EGP', date: '2026-10-31', description: 'x', category: 'Food', isRecurring: false, createdAt: '', updatedAt: '', ...o }) as Expense

describe('unplacedSmsExpenses', () => {
  it('lists bank-message expenses with no account or only the cash stand-in, and nothing else', () => {
    const rows = [
      e({ id: 'a', smsLogId: 'l1' }),
      e({ id: 'b', smsLogId: 'l2', paymentMethodId: 'pm_default_cash' }),
      e({ id: 'placed', smsLogId: 'l3', paymentMethodId: 'bank' }),
      e({ id: 'manual' }),
      e({ id: 'reversed', smsLogId: 'l4', refundedAt: '2026-10-31' }),
      e({ id: 'payoff', smsLogId: 'l5', category: 'CC Payoff' }),
    ]
    expect(unplacedSmsExpenses(rows).map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('totalsByCurrency', () => {
  it('adds per currency without float drift', () => {
    expect(totalsByCurrency([e({ amount: 0.1 }), e({ amount: 0.2 }), e({ amount: 5, currency: 'USD' })])).toEqual({ EGP: 0.3, USD: 5 })
  })
})
