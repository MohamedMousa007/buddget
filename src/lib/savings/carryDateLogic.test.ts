import { describe, it, expect } from 'vitest'
import { justClosedCycleKey, cycleRange } from './carryDateLogic'

const d = (s: string) => new Date(s + 'T06:00:00Z')

describe('justClosedCycleKey', () => {
  it('start=1 fires on the 2nd, carrying the previous month', () => {
    expect(justClosedCycleKey(d('2026-08-02'), 1)).toBe('2026-07')
  })
  it('does not fire on other days', () => {
    expect(justClosedCycleKey(d('2026-08-01'), 1)).toBeNull()
    expect(justClosedCycleKey(d('2026-08-15'), 1)).toBeNull()
  })
  it('start=15 fires on the 16th, carrying the cycle that started the 15th of last month', () => {
    expect(justClosedCycleKey(d('2026-08-16'), 15)).toBe('2026-07')
  })
  it('year rolls over', () => {
    expect(justClosedCycleKey(d('2026-01-02'), 1)).toBe('2025-12')
  })
  it('clamps out-of-range monthStartDay', () => {
    expect(justClosedCycleKey(d('2026-08-02'), 0)).toBe('2026-07') // clamped to 1
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
})
