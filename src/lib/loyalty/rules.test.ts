import { describe, expect, it } from 'vitest'
import { freezeEvery, isRealWeek, keepWeek, multiplierOf, stepForStreak, streakGift, tierFor, tierGifts, weekPoints, type StreakState } from './rules'

describe('tierFor', () => {
  it('assigns by lifetime points at 0 / 300 / 800', () => {
    expect(tierFor(0, false, false)).toBe('silver')
    expect(tierFor(299, false, false)).toBe('silver')
    expect(tierFor(300, false, false)).toBe('emerald')
    expect(tierFor(800, false, false)).toBe('diamond')
  })
  it('Elite needs active Pro (the trial counts); without it the member shows as Diamond', () => {
    expect(tierFor(1500, true, false)).toBe('elite')
    expect(tierFor(5000, false, false)).toBe('diamond')
  })
  it('Elite Founder is a founder at Elite, never a founder without Pro', () => {
    expect(tierFor(1500, true, true)).toBe('founder')
    expect(tierFor(1500, false, true)).toBe('diamond')
    expect(tierFor(100, true, true)).toBe('silver')
  })
})

describe('multiplier', () => {
  it('x1.5 from week 4, x2 from week 8', () => {
    expect([1, 3, 4, 7, 8, 30].map(stepForStreak)).toEqual([0, 0, 1, 1, 2, 2])
    expect([0, 1, 2].map((s) => multiplierOf(s as 0 | 1 | 2))).toEqual([1, 1.5, 2])
    expect([0, 1, 2].map((s) => weekPoints(s as 0 | 1 | 2))).toEqual([10, 15, 20])
  })
})

const base: StreakState = { streakWeeks: 9, step: 2, freezes: 0, keptWeeksTotal: 9, tier: 'silver' }

describe('keepWeek', () => {
  it('continues a streak with no gap and pays at the multiplier', () => {
    const r = keepWeek(base, 0)
    expect(r).toMatchObject({ streakWeeks: 10, step: 2, points: 20 })
  })
  it('a missed week without a freeze drops one step, not to zero', () => {
    const r = keepWeek(base, 1)
    expect(r).toMatchObject({ streakWeeks: 1, step: 1, points: 15 })
    expect(keepWeek({ ...base, step: 1 }, 1)).toMatchObject({ step: 0, points: 10 })
    expect(keepWeek(base, 3)).toMatchObject({ step: 0 })
  })
  it('banked freezes cover a gap only when they cover all of it', () => {
    expect(keepWeek({ ...base, freezes: 2 }, 2)).toMatchObject({ streakWeeks: 10, freezes: 0, freezesUsed: 2, step: 2 })
    expect(keepWeek({ ...base, freezes: 1 }, 2)).toMatchObject({ streakWeeks: 1, freezes: 1, freezesUsed: 0, step: 0 })
  })
  it('the step rises again with the new streak', () => {
    let s: StreakState = { streakWeeks: 0, step: 0, freezes: 0, keptWeeksTotal: 0, tier: 'silver' }
    const points: number[] = []
    for (let i = 0; i < 8; i++) { const r = keepWeek(s, 0, i === 0); points.push(r.points); s = r }
    expect(points).toEqual([10, 10, 10, 15, 15, 15, 15, 20])
  })
  it('earns 1 freeze per 8 kept weeks, 1 per 4 from Emerald, max 2', () => {
    expect(keepWeek({ ...base, keptWeeksTotal: 7 }, 0).freezes).toBe(1)
    expect(keepWeek({ ...base, keptWeeksTotal: 6 }, 0).freezes).toBe(0)
    expect(keepWeek({ ...base, keptWeeksTotal: 3, tier: 'emerald' }, 0).freezes).toBe(1)
    expect(keepWeek({ ...base, keptWeeksTotal: 7, freezes: 2 }, 0).freezes).toBe(2)
    expect(freezeEvery(null)).toBe(8)
    expect(freezeEvery('diamond')).toBe(4)
  })
})

describe('kept week, gifts', () => {
  it('a week needs at least 3 records', () => {
    expect(isRealWeek(2)).toBe(false)
    expect(isRealWeek(3)).toBe(true)
  })
  it('streak gifts at 12, 26 and 52 weeks', () => {
    expect([11, 12, 26, 52, 53].map(streakGift)).toEqual([0, 10, 20, 40, 0])
  })
  it('tier gifts 10 / 20 / 30, each once, Elite Founder paying the Elite gift', () => {
    expect(tierGifts(0, 'diamond')).toEqual([{ key: 'emerald', sparks: 10 }, { key: 'diamond', sparks: 20 }])
    expect(tierGifts(2, 'founder')).toEqual([{ key: 'elite', sparks: 30 }])
    expect(tierGifts(3, 'founder')).toEqual([])
  })
})
