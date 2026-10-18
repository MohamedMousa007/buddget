import { describe, expect, it } from 'vitest'
import { startDateFromBillingDay } from './subscriptionStartDate'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

describe('startDateFromBillingDay', () => {
  it('uses this month once the day has been reached', () => {
    expect(startDateFromBillingDay(10, d(2026, 10, 17))).toBe('2026-10-10')
    expect(startDateFromBillingDay(17, d(2026, 10, 17))).toBe('2026-10-17')
  })
  it('uses last month when the day is still ahead', () => {
    expect(startDateFromBillingDay(25, d(2026, 10, 17))).toBe('2026-09-25')
  })
  it('crosses the year boundary', () => {
    expect(startDateFromBillingDay(20, d(2026, 1, 5))).toBe('2025-12-20')
  })
  it('clamps the 31st into a 30-day previous month', () => {
    expect(startDateFromBillingDay(31, d(2026, 10, 17))).toBe('2026-09-30')
  })
  it('clamps out-of-range input', () => {
    expect(startDateFromBillingDay(99, d(2026, 10, 31))).toBe('2026-10-31')
    expect(startDateFromBillingDay(0, d(2026, 10, 17))).toBe('2026-10-01')
  })
})
