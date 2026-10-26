import { describe, it, expect } from 'vitest'
import { closedCycleKeys, pendingCarryKeys, cycleRange } from './carryDateLogic'

const at = (iso: string) => new Date(iso)

describe('closedCycleKeys', () => {
  it('start=1: the cycle closes the day after its boundary', () => {
    expect(closedCycleKeys(at('2026-08-01T06:00:00Z'), 1, 1)).toEqual(['2026-06'])
    expect(closedCycleKeys(at('2026-08-02T06:00:00Z'), 1, 1)).toEqual(['2026-07'])
  })
  it('is still the same cycle on later days (catch-up, not a single fire day)', () => {
    expect(closedCycleKeys(at('2026-08-15T06:00:00Z'), 1, 1)).toEqual(['2026-07'])
  })
  it('start=15', () => {
    expect(closedCycleKeys(at('2026-08-16T06:00:00Z'), 15, 1)).toEqual(['2026-07'])
    expect(closedCycleKeys(at('2026-08-15T06:00:00Z'), 15, 1)).toEqual(['2026-06'])
  })
  it('year rolls over and lists newest first', () => {
    expect(closedCycleKeys(at('2026-01-02T06:00:00Z'), 1, 2)).toEqual(['2025-12', '2025-11'])
  })
  it('clamps out-of-range and 29-31 start days to 28', () => {
    expect(closedCycleKeys(at('2026-08-02T06:00:00Z'), 0, 1)).toEqual(['2026-07'])
    expect(closedCycleKeys(at('2026-08-30T06:00:00Z'), 31, 1)).toEqual(closedCycleKeys(at('2026-08-30T06:00:00Z'), 28, 1))
  })
  it('start=28 in a non-leap year: the Jan cycle is carried on 1 March', () => {
    expect(closedCycleKeys(at('2026-03-01T06:00:00Z'), 28, 1)).toEqual(['2026-01'])
  })
  it('judges the boundary in the local date, not UTC', () => {
    // 22:30 UTC on Aug 1 is already Aug 2 in Cairo (UTC+3 in summer).
    expect(closedCycleKeys(at('2026-08-01T22:30:00Z'), 1, 1, 'Africa/Cairo')).toEqual(['2026-07'])
    expect(closedCycleKeys(at('2026-08-01T22:30:00Z'), 1, 1, 'UTC')).toEqual(['2026-06'])
  })
})

describe('pendingCarryKeys', () => {
  const now = at('2026-08-10T06:00:00Z')
  it('a user with no summary gets only the newest closed cycle', () => {
    expect(pendingCarryKeys(now, 1, null)).toEqual(['2026-07'])
  })
  it('catches up cycles newer than the latest summary, oldest first', () => {
    expect(pendingCarryKeys(now, 1, '2026-05')).toEqual(['2026-06', '2026-07'])
  })
  it('caps the catch-up at 3 cycles', () => {
    expect(pendingCarryKeys(now, 1, '2025-01')).toEqual(['2026-05', '2026-06', '2026-07'])
  })
  it('nothing owed when up to date', () => {
    expect(pendingCarryKeys(now, 1, '2026-07')).toEqual([])
  })
})

describe('cycleRange', () => {
  it('spans start-day to next start-day', () => {
    const { start, end } = cycleRange('2026-07', 1)
    expect(start.toISOString().slice(0, 10)).toBe('2026-07-01')
    expect(end.toISOString().slice(0, 10)).toBe('2026-08-01')
  })
  it('mid-month cycle', () => {
    const { start, end } = cycleRange('2026-07', 15)
    expect(start.toISOString().slice(0, 10)).toBe('2026-07-15')
    expect(end.toISOString().slice(0, 10)).toBe('2026-08-15')
  })
  it('29-31 clamp to 28', () => {
    expect(cycleRange('2026-01', 31).end.toISOString().slice(0, 10)).toBe('2026-02-28')
  })
})
