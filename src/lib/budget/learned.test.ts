import { describe, expect, it } from 'vitest'
import { learnActual, learnBuild, learnEdit, learnedMultiplier } from '@/lib/budget/learned'

describe('learned', () => {
  it('moves toward what the person keeps doing, slower each time, and never past the clamp', () => {
    let l = learnEdit(undefined, { kind: 'everyday', key: 'dining' }, 1000, 600)
    const first = l.everyday!.dining!.mult
    expect(first).toBeLessThan(1)
    l = learnEdit(l, { kind: 'everyday', key: 'dining' }, 1000, 600)
    expect(l.everyday!.dining!.mult).toBeLessThan(first)
    for (let i = 0; i < 40; i++) l = learnEdit(l, { kind: 'everyday', key: 'dining' }, 1000, 0)
    expect(l.everyday!.dining!.mult).toBeGreaterThanOrEqual(0.6)
  })
  it('ignores impossible edits', () => {
    expect(learnEdit(undefined, { kind: 'safety' }, 0, 100)).toEqual({ v: 1 })
    expect(learnEdit(undefined, { kind: 'safety' }, 100, -5)).toEqual({ v: 1 })
  })
  it('trusts a multiplier more as signals build up', () => {
    expect(learnedMultiplier(undefined)).toBe(1)
    expect(learnedMultiplier({ mult: 0.7, n: 1 })).toBeCloseTo(1 - 0.3 / 3, 5)
    expect(learnedMultiplier({ mult: 0.7, n: 3 })).toBeCloseTo(0.7, 5)
  })
  it('learns from a month close only on a clear miss', () => {
    expect(learnActual(undefined, 'groceries', 1000, 1050)).toEqual({ v: 1 })
    expect(learnActual(undefined, 'groceries', 1000, 1500).everyday!.groceries!.mult).toBeGreaterThan(1)
  })
  it('counts a build soon after the last one as a rebuild', () => {
    const a = learnBuild(undefined, new Date('2026-11-01'))
    expect(a.rebuilds).toBe(0)
    expect(learnBuild(a, new Date('2026-11-05')).rebuilds).toBe(1)
    expect(learnBuild(a, new Date('2027-01-05')).rebuilds).toBe(0)
  })
})
