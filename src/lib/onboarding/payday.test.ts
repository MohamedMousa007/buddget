import { describe, expect, it } from 'vitest'
import { dailyAllowance, nextPayday } from './payday'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

describe('nextPayday', () => {
  it('is this month when payday has not passed, counting today', () => {
    expect(nextPayday(d(2026, 11, 13), 25)).toEqual(d(2026, 11, 25))
    expect(nextPayday(d(2026, 11, 25), 25)).toEqual(d(2026, 11, 25))
  })
  it('rolls to next month once passed, across the year end', () => {
    expect(nextPayday(d(2026, 11, 26), 25)).toEqual(d(2026, 12, 25))
    expect(nextPayday(d(2026, 12, 30), 5)).toEqual(d(2027, 1, 5))
  })
  it('a 31st lands on the last day of a short month', () => {
    expect(nextPayday(d(2027, 2, 10), 31)).toEqual(d(2027, 2, 28))
    expect(nextPayday(d(2028, 2, 10), 31)).toEqual(d(2028, 2, 29))
  })
})

describe('dailyAllowance', () => {
  it('spreads the balance over the days left, rounded down', () => {
    expect(dailyAllowance(18_400, d(2026, 11, 13), 25)).toMatchObject({ days: 12, perDay: 1533 })
  })
  it('has no per-day number on payday itself or with nothing to spread', () => {
    expect(dailyAllowance(18_400, d(2026, 11, 25), 25)).toMatchObject({ days: 0, perDay: null })
    expect(dailyAllowance(0, d(2026, 11, 13), 25).perDay).toBeNull()
    expect(dailyAllowance(-50, d(2026, 11, 13), 25).perDay).toBeNull()
  })
})
