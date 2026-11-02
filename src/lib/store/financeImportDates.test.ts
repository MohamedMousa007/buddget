import { describe, expect, it } from 'vitest'
import { importDataSchema } from '@/lib/store/financeImportSchema'

const sub = {
  id: 's1', name: 'Netflix', brandKey: null, planName: null, amount: 10, currency: 'EGP', billingCycle: 'monthly', billingDay: 5,
  startDate: '2026-10-01', nextBillingDate: '2026-11-05', paymentMethodId: null, expenseCategory: 'entertainment',
  linkedRecurringExpenseId: null, status: 'active', notes: null, createdAt: '2026-10-01T00:00:00.000Z', cancelledAt: null,
}
const parse = (over: Record<string, unknown>) => importDataSchema.shape.subscriptions.safeParse([{ ...sub, ...over }]).success

describe('import schema dates', () => {
  it('accepts a calendar date, an ISO timestamp and an empty date', () => {
    expect(parse({})).toBe(true)
    expect(parse({ nextBillingDate: '2026-11-05T09:30:00+02:00' })).toBe(true)
    expect(parse({ nextBillingDate: null })).toBe(true)
    expect(parse({ startDate: '' })).toBe(true)
  })

  it('accepts 29 February in a leap year', () => {
    expect(parse({ startDate: '2028-02-29' })).toBe(true)
  })

  it('rejects text that is not a date', () => {
    expect(parse({ nextBillingDate: 'garbage' })).toBe(false)
    expect(parse({ createdAt: 'yesterday' })).toBe(false)
  })

  it('rejects a calendar date that does not exist', () => {
    expect(parse({ startDate: '2026-02-30' })).toBe(false)
    expect(parse({ startDate: '2027-02-29' })).toBe(false)
    expect(parse({ startDate: '2026-13-01' })).toBe(false)
  })
})
