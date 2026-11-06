import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import { addCalendarDays, addCalendarMonths, addCalendarWeeks, addCalendarYears, parseDateOnly, weeksElapsed } from './calendarDays'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

describe('calendar-day arithmetic (Cairo DST-start Fridays have no local 00:00)', () => {
  it('a weekly chain started before the DST Friday keeps landing on local midnight', () => {
    let d = new Date(2026, 0, 2)
    for (let i = 0; i < 104; i++) {
      d = addCalendarWeeks(d, 1)
      expect(d.getDay()).toBe(5)
      expect(d.getTime()).toBe(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())
    }
    expect(iso(d)).toBe('2027-12-31')
  })
  it('stepping from the DST Friday itself does not carry its 01:00', () => {
    const next = addCalendarDays(new Date(2026, 3, 24), 7)
    expect(iso(next)).toBe('2026-05-01')
    expect(next.getHours()).toBe(0)
  })
  it('months and years clamp like date-fns and return midnight', () => {
    expect(iso(addCalendarMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28')
    expect(iso(addCalendarYears(new Date(2028, 1, 29), 1))).toBe('2029-02-28')
    expect(addCalendarMonths(new Date(2026, 3, 24), 1).getHours()).toBe(0)
  })
  it('parseDateOnly is the local calendar day, never the UTC one', () => {
    const d = parseDateOnly('2027-01-01')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 0, 1])
    expect(format(parseDateOnly('2027-01-01T23:30:00Z'), 'd MMM yyyy')).toBe('1 Jan 2027')
  })
  it('weeksElapsed counts 7-day periods, not calendar-week boundaries', () => {
    expect(weeksElapsed(new Date(2026, 10, 8), new Date(2026, 10, 7))).toBe(0)
    expect(weeksElapsed(new Date(2026, 10, 14), new Date(2026, 10, 7))).toBe(1)
    expect(weeksElapsed(new Date(2026, 10, 1), new Date(2026, 10, 7))).toBe(0)
  })
})
