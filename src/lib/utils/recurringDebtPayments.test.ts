import { describe, expect, it } from 'vitest'
import { advanceRecurringDebtDueDate } from './recurringDebtPayments'

describe('advanceRecurringDebtDueDate anchor day', () => {
  it('returns to day 31 after a short month instead of drifting to 28', () => {
    const feb = advanceRecurringDebtDueDate('2026-01-31', 'monthly', 31)
    expect(feb).toBe('2026-02-28')
    expect(advanceRecurringDebtDueDate(feb, 'monthly', 31)).toBe('2026-03-31')
    expect(advanceRecurringDebtDueDate('2026-03-31', 'monthly', 31)).toBe('2026-04-30')
    expect(advanceRecurringDebtDueDate('2026-04-30', 'quarterly', 31)).toBe('2026-07-31')
  })
  it('ignores an anchor that does not match the current due day (user-edited date)', () => {
    expect(advanceRecurringDebtDueDate('2026-01-15', 'monthly', 31)).toBe('2026-02-15')
  })
  it('without an anchor behaves as before', () => {
    expect(advanceRecurringDebtDueDate('2026-01-31', 'monthly')).toBe('2026-02-28')
  })
})
