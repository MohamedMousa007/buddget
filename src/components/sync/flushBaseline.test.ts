import { describe, it, expect } from 'vitest'
import { baselineAfterFlush, flushRetryDelay } from './flushBaseline'
import { emptySnapshot } from '@/lib/supabase/remote/snapshot'

describe('baselineAfterFlush', () => {
  const previous = emptySnapshot()
  const current = { ...emptySnapshot(), financialGoalsNotes: 'x' }

  it('advances the baseline after a successful flush', () => {
    expect(baselineAfterFlush(previous, current, true)).toBe(current)
  })

  it('keeps the old baseline after a failed flush so the diff is retried', () => {
    expect(baselineAfterFlush(previous, current, false)).toBe(previous)
  })
})

describe('flushRetryDelay', () => {
  it('backs off for three attempts then stops', () => {
    expect([0, 1, 2].map(flushRetryDelay)).toEqual([2_000, 6_000, 15_000])
    expect(flushRetryDelay(3)).toBeNull()
  })
})
