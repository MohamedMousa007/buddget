import { describe, expect, it } from 'vitest'
import { currentCycle, cycleKeyFor } from '@/lib/settings/payCycle'

const d = (s: string) => new Date(`${s}T12:00:00`)

describe('cycleKeyFor', () => {
  it('is the calendar month when the cycle starts on day 1', () => {
    expect(cycleKeyFor(d('2026-10-19'), 1)).toBe('2026-10')
    expect(cycleKeyFor(d('2026-10-01'), 1)).toBe('2026-10')
  })
  it('stays in the same month once the start day has passed', () => {
    expect(cycleKeyFor(d('2026-10-25'), 25)).toBe('2026-10')
    expect(cycleKeyFor(d('2026-10-31'), 25)).toBe('2026-10')
  })
  it('belongs to last month before the start day, across a year boundary too', () => {
    expect(cycleKeyFor(d('2026-10-19'), 25)).toBe('2026-09')
    expect(cycleKeyFor(d('2027-01-05'), 25)).toBe('2026-12')
  })
  it('clamps the day to 1-28', () => {
    expect(cycleKeyFor(d('2026-10-19'), 31)).toBe('2026-09')
    expect(cycleKeyFor(d('2026-10-19'), 0)).toBe('2026-10')
  })
})

describe('currentCycle', () => {
  it('spans a calendar month for day 1', () => {
    const c = currentCycle(d('2026-10-19'), 1)
    expect(format(c.start)).toBe('2026-10-01')
    expect(format(c.end)).toBe('2026-10-31')
    expect(c.elapsedDays).toBe(19)
    expect(c.totalDays).toBe(31)
  })
  it('runs from the start day to the day before the next one', () => {
    const c = currentCycle(d('2026-10-19'), 25)
    expect(format(c.start)).toBe('2026-09-25')
    expect(format(c.end)).toBe('2026-10-24')
    expect(c.elapsedDays).toBe(25)
    expect(c.totalDays).toBe(30)
  })
  it('puts today on the first day of a new cycle', () => {
    const c = currentCycle(d('2026-10-25'), 25)
    expect(c.elapsedDays).toBe(1)
    expect(format(c.start)).toBe('2026-10-25')
  })
})

function format(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}
