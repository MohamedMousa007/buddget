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

  it('QA-16: a row the server set aside stays out of the new baseline, so the next flush offers it again', () => {
    const delivered = { ...emptySnapshot(), expenses: [{ id: 'old', amount: 1 }] } as never
    const store = { ...emptySnapshot(), expenses: [{ id: 'old', amount: 2 }, { id: 'ok', amount: 3 }], debtPayments: [{ id: 'new' }] } as never
    const parked = [{ table: 'debt_payments', id: 'new', rootId: 'new', code: '22P02' }, { table: 'expenses', id: 'old', rootId: 'old', code: '23503' }] as never
    const next = baselineAfterFlush(delivered, store, true, parked)!
    expect(next.debtPayments).toEqual([])
    expect(next.expenses).toEqual([{ id: 'old', amount: 1 }, { id: 'ok', amount: 3 }])
  })
})

describe('flushRetryDelay', () => {
  it('backs off for three attempts then stops', () => {
    expect([0, 1, 2].map(flushRetryDelay)).toEqual([2_000, 6_000, 15_000])
    expect(flushRetryDelay(3)).toBeNull()
  })
})
