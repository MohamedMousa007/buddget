import { describe, it, expect } from 'vitest'
import { format } from 'date-fns'
import { borrowGoalSchedule, borrowScheduleStart, goalTargetDate } from '@/lib/debts/borrowGoal'

const day = (d: Date) => format(d, 'yyyy-MM-dd')

describe('borrow pay-off schedule counts from the borrow date (QA W4 P3)', () => {
  it('starts from the picked borrow date, not the day the debt was added', () => {
    const start = borrowScheduleStart({ startDate: '2026-09-10', createdAt: '2026-11-26T06:15:55Z' })
    expect(day(start)).toBe('2026-09-10')
    expect(day(borrowGoalSchedule(start, 'monthly', new Date(2026, 10, 26, 12)).next)).toBe('2026-12-10')
    expect(borrowGoalSchedule(start, 'monthly', new Date(2026, 10, 26, 12)).elapsed).toBe(2)
  })

  it('the first payment is one period after the borrow date', () => {
    const start = borrowScheduleStart({ startDate: '2026-11-20', createdAt: '2026-11-26T06:15:55Z' })
    expect(day(borrowGoalSchedule(start, 'monthly', new Date(2026, 10, 26, 12)).next)).toBe('2026-12-20')
    expect(day(borrowGoalSchedule(start, 'weekly', new Date(2026, 10, 26, 12)).next)).toBe('2026-11-27')
    expect(day(borrowGoalSchedule(start, 'quarterly', new Date(2026, 10, 26, 12)).next)).toBe('2027-02-20')
  })

  it('an empty borrow date falls back to the day it was added', () => {
    expect(day(borrowScheduleStart({ startDate: '', createdAt: '2026-11-26T12:00:00Z' }))).toBe('2026-11-26')
  })

  it('the target date runs from the borrow date', () => {
    expect(goalTargetDate(12, 'months', borrowScheduleStart({ startDate: '2026-09-10', createdAt: '2026-11-26T00:00:00Z' }))).toBe('2027-09-10')
  })
})
