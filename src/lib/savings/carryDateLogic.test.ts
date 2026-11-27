import { describe, it, expect } from 'vitest'
import { dueCycle, legacyCycle, localDay, newestClosedCycle, nextCycle, startOfDayIn } from './carryDateLogic'

describe('nextCycle (T35)', () => {
  it('a start-day change: Nov 1–Dec 1, then day 15 gives Dec 1–Dec 15 and Dec 15–Jan 15', () => {
    const dec = nextCycle('2026-12-01', 15)
    expect(dec).toEqual({ start: '2026-12-01', end: '2026-12-15' })
    expect(nextCycle(dec.end, 15)).toEqual({ start: '2026-12-15', end: '2027-01-15' })
  })
  it('same start day: one month long, across the year', () => {
    expect(nextCycle('2026-12-01', 1)).toEqual({ start: '2026-12-01', end: '2027-01-01' })
  })
  it('clamps 29-31 to 28', () => {
    expect(nextCycle('2026-01-28', 31)).toEqual({ start: '2026-01-28', end: '2026-02-28' })
  })
})

describe('newestClosedCycle / dueCycle', () => {
  it('a cycle ends when its end date begins (T26: Nov proposed on Dec 1)', () => {
    expect(newestClosedCycle('2026-12-01', 1)).toEqual({ start: '2026-11-01', end: '2026-12-01' })
    expect(newestClosedCycle('2026-11-30', 1)).toEqual({ start: '2026-10-01', end: '2026-11-01' })
    expect(newestClosedCycle('2026-08-14', 15)).toEqual({ start: '2026-06-15', end: '2026-07-15' })
  })
  it('no month-end row yet: the newest ended cycle only', () => {
    expect(dueCycle(null, 1, '2026-12-03')).toEqual({ start: '2026-11-01', end: '2026-12-01' })
  })
  it('follows on from the last row; nothing until the next one ends', () => {
    expect(dueCycle('2026-12-01', 1, '2026-12-20')).toBeNull()
    expect(dueCycle('2026-12-01', 1, '2027-01-01')).toEqual({ start: '2026-12-01', end: '2027-01-01' })
    expect(dueCycle('2026-12-01', 15, '2026-12-20')).toEqual({ start: '2026-12-01', end: '2026-12-15' })
  })
  it('a gap of several ended cycles proposes only the newest', () => {
    expect(dueCycle('2026-09-01', 1, '2026-12-02')).toEqual({ start: '2026-11-01', end: '2026-12-01' })
  })
})

describe('localDay', () => {
  it('judges the date in the user zone, not UTC', () => {
    expect(localDay(new Date('2026-11-30T22:30:00Z'), 'Africa/Cairo')).toBe('2026-12-01')
    expect(localDay(new Date('2026-11-30T22:30:00Z'), 'America/New_York')).toBe('2026-11-30')
  })
})

describe('legacyCycle', () => {
  it('a YYYY-MM carry row spans its start day to the next', () => {
    expect(legacyCycle('2026-10', 1)).toEqual({ start: '2026-10-01', end: '2026-11-01' })
    expect(legacyCycle('2026-12', 25)).toEqual({ start: '2026-12-25', end: '2027-01-25' })
  })
})

describe('startOfDayIn', () => {
  it('is local midnight of the date in that zone', () => {
    expect(new Date(startOfDayIn('2026-12-01', 'Africa/Cairo')).toISOString()).toBe('2026-11-30T22:00:00.000Z')
    expect(new Date(startOfDayIn('2026-12-01', 'America/New_York')).toISOString()).toBe('2026-12-01T05:00:00.000Z')
  })
})
