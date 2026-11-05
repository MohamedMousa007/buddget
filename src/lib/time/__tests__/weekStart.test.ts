import { describe, expect, it } from 'vitest'
import { defaultWeekStart, resolveWeekStart, weekColumn, weekendFirstDayFor } from '@/lib/time/weekStart'

describe('week start', () => {
  it('defaults to Saturday for Egypt and Gulf zones, Sunday elsewhere', () => {
    expect(defaultWeekStart('Africa/Cairo')).toBe(6)
    expect(defaultWeekStart('Asia/Dubai')).toBe(6)
    expect(defaultWeekStart('Asia/Riyadh')).toBe(6)
    expect(defaultWeekStart('America/New_York')).toBe(0)
    expect(defaultWeekStart(null)).toBe(0)
  })
  it('prefers the saved choice, including Sunday in Cairo', () => {
    expect(resolveWeekStart({ weekStartDay: 0, timezone: 'Africa/Cairo' })).toBe(0)
    expect(resolveWeekStart({ weekStartDay: 1, timezone: 'Africa/Cairo' })).toBe(1)
    expect(resolveWeekStart({ timezone: 'Africa/Cairo' })).toBe(6)
  })
  it('maps weekdays to grid columns', () => {
    expect(weekColumn(6, 6)).toBe(0)
    expect(weekColumn(0, 6)).toBe(1)
    expect(weekColumn(5, 6)).toBe(6)
    expect(weekColumn(1, 1)).toBe(0)
    expect(weekColumn(0, 1)).toBe(6)
  })
})

describe('weekendFirstDayFor (MON-3)', () => {
  it('a Saturday-first week has a Fri+Sat weekend (Friday first)', () => {
    expect(weekendFirstDayFor({ weekStartDay: 6, timezone: 'Africa/Cairo' })).toBe(5)
    expect(weekendFirstDayFor({ timezone: 'Africa/Cairo' })).toBe(5)
    expect(weekendFirstDayFor({ timezone: 'Asia/Riyadh' })).toBe(5)
  })
  it('Sunday- or Monday-first weeks keep Sat+Sun', () => {
    expect(weekendFirstDayFor({ weekStartDay: 1, timezone: 'Africa/Cairo' })).toBe(6)
    expect(weekendFirstDayFor({ timezone: 'Europe/London' })).toBe(6)
  })
  it('the UAE keeps Sat+Sun though its week opens on Saturday', () => {
    expect(weekendFirstDayFor({ timezone: 'Asia/Dubai' })).toBe(6)
  })
})
