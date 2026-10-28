import { describe, expect, it } from 'vitest'
import { daysInRange, formatCustomRange, resolveRange, type ExpenseRange } from './dateRange'

const range = (preset: ExpenseRange['preset'], from: string | null = null, to: string | null = null): ExpenseRange => ({
  preset,
  from,
  to,
})

// Wed 15 Jul 2026, 10:00 local.
const REF = new Date(2026, 6, 15, 10, 0, 0)

describe('resolveRange', () => {
  it('today spans the whole local day, not a single instant', () => {
    const { start, end } = resolveRange(range('today'), '2026-07', 1, REF)
    expect(start.getHours()).toBe(0)
    expect(start.getDate()).toBe(15)
    // An expense parsed at local midnight on the 15th must fall inside.
    expect(end.getDate()).toBe(15)
    expect(end.getHours()).toBe(23)
  })

  it('week opens on the chosen first day (Sat, Sun, Mon)', () => {
    const day = (d: Date) => d.getDate()
    const sat = resolveRange(range('week'), '2026-07', 1, REF, 6)
    expect([day(sat.start), day(sat.end)]).toEqual([11, 17])
    const sun = resolveRange(range('week'), '2026-07', 1, REF, 0)
    expect([day(sun.start), day(sun.end)]).toEqual([12, 18])
    const mon = resolveRange(range('week'), '2026-07', 1, REF, 1)
    expect([day(mon.start), day(mon.end)]).toEqual([13, 19])
  })

  it('formats a custom range with Arabic month names when given the ar locale', () => {
    const r = resolveRange(range('custom', '2026-10-05', '2026-10-27'), '2026-10', 1, REF)
    expect(formatCustomRange(r, 'ar')).toContain('أكتوبر')
    expect(formatCustomRange(r)).toBe('5 – 27 Oct')
  })

  it('yesterday is the previous local day', () => {
    const { start, end } = resolveRange(range('yesterday'), '2026-07', 1, REF)
    expect(start.getDate()).toBe(14)
    expect(end.getDate()).toBe(14)
  })

  it('month honours a custom pay-cycle start rather than the calendar month', () => {
    const { start, end } = resolveRange(range('month'), '2026-07', 25, REF)
    expect(start.getDate()).toBe(25)
    expect(start.getMonth()).toBe(6) // July
    expect(end.getDate()).toBe(24)
    expect(end.getMonth()).toBe(7) // runs into August
  })

  it('month with monthStartDay=1 is the plain calendar month', () => {
    const { start, end } = resolveRange(range('month'), '2026-07', 1, REF)
    expect(start.getDate()).toBe(1)
    expect(end.getDate()).toBe(31)
  })

  it('custom uses its own bounds', () => {
    const { start, end } = resolveRange(range('custom', '2026-07-12', '2026-07-18'), '2026-07', 1, REF)
    expect(start.getDate()).toBe(12)
    expect(end.getDate()).toBe(18)
  })

  it.each([
    ['inverted', '2026-07-18', '2026-07-12'],
    ['missing to', '2026-07-12', null],
    ['missing from', null, '2026-07-18'],
  ])('custom falls back to the month when %s', (_label, from, to) => {
    const { start, end } = resolveRange(range('custom', from, to), '2026-07', 1, REF)
    expect(start.getDate()).toBe(1)
    expect(end.getDate()).toBe(31)
  })
})

describe('daysInRange', () => {
  // The bug this replaces: daysElapsed() took a yyyy-MM string and returned 31 for the
  // month, so "Today" would have divided one day's spend by 31.
  it('today divides by 1', () => {
    expect(daysInRange(resolveRange(range('today'), '2026-07', 1, REF), REF)).toBe(1)
  })

  it('counts elapsed days, not the full span, for a month in progress', () => {
    expect(daysInRange(resolveRange(range('month'), '2026-07', 1, REF), REF)).toBe(15)
  })

  it('counts the full span for a month already finished', () => {
    expect(daysInRange(resolveRange(range('month'), '2026-06', 1, REF), REF)).toBe(30)
  })

  it('never returns 0 for a range that has not started', () => {
    const future = { start: new Date(2026, 8, 1), end: new Date(2026, 8, 30) }
    expect(daysInRange(future, REF)).toBe(1)
  })

  it('counts a custom range inclusively', () => {
    expect(daysInRange(resolveRange(range('custom', '2026-07-12', '2026-07-14'), '2026-07', 1, REF), REF)).toBe(3)
  })
})

describe('formatCustomRange', () => {
  it('collapses the month when both ends share it', () => {
    expect(formatCustomRange({ start: new Date(2026, 6, 12), end: new Date(2026, 6, 18) })).toBe('12 – 18 Jul')
  })

  it('keeps both months when they differ', () => {
    expect(formatCustomRange({ start: new Date(2026, 5, 28), end: new Date(2026, 6, 4) })).toBe('28 Jun – 4 Jul')
  })
})
