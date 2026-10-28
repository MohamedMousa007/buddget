import { describe, expect, it } from 'vitest'
import { closeKey, isSuppressed, mergeClosedCycles, nextCloseMemory } from './closeMemory'
import { buildClose, type CloseLine } from './monthClose'
import type { CloseMemory } from '@/lib/store/types'

const proposal = (key: string, kind: 'raise' | 'lower' = 'raise') => ({ key, lineId: `id-${key}`, kind })

describe('nextCloseMemory', () => {
  it('records applied and passed proposals under the line\'s stable key', () => {
    const m = nextCloseMemory(undefined, [proposal('everyday:dining'), proposal('everyday:fun', 'lower')], new Set(['id-everyday:fun']), '2026-10')
    expect(m['everyday:dining']).toEqual({ kind: 'raise', cycle: '2026-10', outcome: 'passed' })
    expect(m['everyday:fun']).toEqual({ kind: 'lower', cycle: '2026-10', outcome: 'applied' })
  })
  it('forgets old decisions and keeps the memory small', () => {
    const old: CloseMemory = { 'everyday:old': { kind: 'raise', cycle: '2026-01', outcome: 'passed' }, 'everyday:recent': { kind: 'raise', cycle: '2026-09', outcome: 'passed' } }
    const m = nextCloseMemory(old, [], new Set(), '2026-10')
    expect(Object.keys(m)).toEqual(['everyday:recent'])
    const many = Array.from({ length: 40 }, (_, i) => proposal(`everyday:l${i}`))
    expect(Object.keys(nextCloseMemory(undefined, many, new Set(), '2026-10'))).toHaveLength(30)
  })
  it('ignores proposals without a key', () => {
    expect(nextCloseMemory(undefined, [{ lineId: 'x', kind: 'raise' }], new Set(), '2026-10')).toEqual({})
  })
})

describe('isSuppressed', () => {
  const memory: CloseMemory = { 'everyday:dining': { kind: 'raise', cycle: '2026-09', outcome: 'passed' } }
  it('holds a passed proposal back for three cycles, only for the same kind', () => {
    expect(isSuppressed(memory, 'everyday:dining', 'raise', '2026-10')).toBe(true)
    expect(isSuppressed(memory, 'everyday:dining', 'raise', '2026-11')).toBe(true)
    expect(isSuppressed(memory, 'everyday:dining', 'raise', '2026-12')).toBe(false)
    expect(isSuppressed(memory, 'everyday:dining', 'lower', '2026-10')).toBe(false)
    expect(isSuppressed({ 'everyday:dining': { kind: 'raise', cycle: '2026-09', outcome: 'applied' } }, 'everyday:dining', 'raise', '2026-10')).toBe(false)
    expect(isSuppressed(undefined, 'x', 'raise', '2026-10')).toBe(false)
  })
  it('works across a year boundary', () => {
    expect(isSuppressed({ k: { kind: 'raise', cycle: '2026-12', outcome: 'passed' } }, 'k', 'raise', '2027-01')).toBe(true)
  })
})

describe('buildClose with memory', () => {
  const dining: CloseLine = { id: 'd', key: closeKey('everyday', 'Dining'), name: 'Dining', block: 'everyday', cap: 1000, spent: 1250, average: 1200, monthsOver: 3, locked: false, linked: false }
  it('does not repeat what the user passed on, and asks again once it has aged out', () => {
    const past: CloseMemory = { [dining.key!]: { kind: 'raise', cycle: '2026-09', outcome: 'passed' } }
    expect(buildClose([dining], { past, cycleKey: '2026-10' }).proposals).toEqual([])
    expect(buildClose([dining], { past, cycleKey: '2026-12' }).proposals).toHaveLength(1)
    expect(buildClose([dining]).proposals).toHaveLength(1)
  })
  it('the key is the same whatever the casing or spacing of the name', () => {
    expect(closeKey('everyday', '  Dining Out ')).toBe(closeKey('everyday', 'dining out'))
  })
})

describe('mergeClosedCycles', () => {
  it('unions device and account cycles, sorted, capped at 24, and keeps identity when nothing is new', () => {
    const local = ['2026-09']
    expect(mergeClosedCycles(local, ['2026-08', '2026-09'])).toEqual(['2026-08', '2026-09'])
    expect(mergeClosedCycles(local, undefined)).toBe(local)
    expect(mergeClosedCycles(local, ['2026-09'])).toBe(local)
    const many = Array.from({ length: 30 }, (_, i) => `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`)
    expect(mergeClosedCycles([], many)).toHaveLength(24)
  })
})
