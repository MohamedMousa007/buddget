import { describe, it, expect } from 'vitest'
import { capBar, coverGauge, cycleCloseDate, formatShare, planBar, railDots, railPosition } from './geometry'

describe('block geometry', () => {
  it('places days on the rail and clamps', () => {
    expect(railPosition(15, 30)).toBe(50)
    expect(railPosition(40, 30)).toBe(100)
    expect(railPosition(5, 0)).toBe(0)
  })

  it('merges bills on the same day and is paid only when all are', () => {
    const dots = railDots(
      [{ dueDay: 5, paid: true }, { dueDay: 5, paid: false }, { dueDay: 1, paid: true }, { dueDay: null, paid: false }],
      30
    )
    expect(dots.map((d) => [d.day, d.paid])).toEqual([[1, true], [5, false]])
  })

  it('cap bar spans 1.5x the cap and puts the cap line at two thirds', () => {
    const b = capBar(1380, 2100, 2040)
    expect(b.fill).toBeCloseTo(43.8, 1)
    expect(b.tick).toBeCloseTo(64.8, 1)
    expect(b.capAt).toBeCloseTo(66.7, 1)
    expect(capBar(5000, 100, null).fill).toBe(100)
    expect(capBar(10, 0, 5)).toEqual({ fill: 100, tick: null, capAt: 0 })
  })

  it('plan bar shares one scale between amount and average', () => {
    const b = planBar(100, 150)
    expect(b.tick).toBeGreaterThan(b.fill)
    expect(planBar(0, null)).toEqual({ fill: 0, tick: null })
  })

  it('cover gauge dedupes ticks and caps the planned extension', () => {
    const g = coverGauge(1.9, 3, 0.2)
    expect(g.ticks.map((t) => t.months)).toEqual([1, 3, 6])
    expect(g.ticks.find((t) => t.isTarget)?.left).toBe(50)
    expect(g.extra).toBeGreaterThan(0)
    expect(coverGauge(5.9, 6, 3).extra).toBeLessThanOrEqual(100 - coverGauge(5.9, 6, 3).held)
    expect(coverGauge(1, 6, 0).ticks.map((t) => t.months)).toEqual([1, 6])
  })

  it('derives the cycle close from today', () => {
    expect(cycleCloseDate(new Date(2026, 9, 19), 19, 31).getDate()).toBe(31)
  })

  it('formats share', () => {
    expect(formatShare(3.54)).toBe('3.5%')
    expect(formatShare(26.2)).toBe('26%')
  })
})
