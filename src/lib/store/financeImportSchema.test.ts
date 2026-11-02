import { describe, expect, it } from 'vitest'
import { importDataSchema } from './financeImportSchema'

const subscription = (over: Record<string, unknown> = {}) => ({
  id: 's1', name: 'Netflix', brandKey: null, planName: null, amount: 100, currency: 'EGP', billingCycle: 'monthly', billingDay: 5,
  startDate: '2026-01-05', nextBillingDate: '2026-11-05', paymentMethodId: null, expenseCategory: 'Entertainment',
  linkedRecurringExpenseId: null, status: 'active', notes: null, createdAt: '2026-01-05T00:00:00Z', cancelledAt: null, ...over,
})
const parse = (s: Record<string, unknown>) => importDataSchema.safeParse({ subscriptions: [subscription(s)] })

describe('import schema dates', () => {
  it('accepts real calendar dates, with or without a time, and a null next billing date', () => {
    expect(parse({}).success).toBe(true)
    expect(parse({ startDate: '2026-02-28T10:00:00Z' }).success).toBe(true)
    expect(parse({ nextBillingDate: null }).success).toBe(true)
  })
  it('rejects text, impossible days and malformed dates that would crash the Subscriptions page', () => {
    expect(parse({ nextBillingDate: 'garbage' }).success).toBe(false)
    expect(parse({ startDate: '2026-02-30' }).success).toBe(false)
    expect(parse({ startDate: '2026-13-01' }).success).toBe(false)
    expect(parse({ startDate: '' }).success).toBe(false)
  })
})
