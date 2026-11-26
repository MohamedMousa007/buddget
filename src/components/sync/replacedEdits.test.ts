import { afterEach, describe, expect, it } from 'vitest'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { emptySnapshot, type Snapshot } from '@/lib/supabase/remote/snapshot'
import { applyDelta } from '@/lib/supabase/remote/delta'
import { resetServerClock } from '@/lib/supabase/remote/serverClock'
import type { Expense } from '@/lib/store/types'
import { expenseAt, fakeEditTimeServer } from '@/lib/supabase/remote/__tests__/fakeEditTimeServer'
import { countReplaced, sentRows } from './replacedEdits'

const T0 = Date.UTC(2026, 0, 1)
const MIN = 60_000
const withExpenses = (...e: Expense[]): Snapshot => ({ ...emptySnapshot(), expenses: e })

afterEach(() => resetServerClock())

describe('QA-106: the device whose edit was replaced by a newer one is told', () => {
  it('counts an edit the server skipped once the newer copy has come down', async () => {
    const clock = { now: T0 + 60 * MIN }
    const s = fakeEditTimeServer(clock)
    const base = expenseAt('e1', 0, T0)
    await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses(base))
    // Another device edits at +30 min; this one edited offline at +10 min and reconnects later.
    await flushDiff(s.client as never, 'u', withExpenses(base), withExpenses(expenseAt('e1', 99, T0 + 30 * MIN)))
    clock.now = T0 + 300 * MIN
    const mine = withExpenses(expenseAt('e1', 55, T0 + 10 * MIN))
    const res = await flushDiff(s.client as never, 'u', withExpenses(base), mine)
    expect(res.skippedWrites).toBe(1)
    const sent = sentRows(withExpenses(base), mine)
    expect(countReplaced(sent, mine)).toBe(0) // nothing pulled yet: still our own row
    const merged = applyDelta(mine, s.delta(null), mine)
    expect(merged.expenses[0].amount).toBe(99)
    expect(countReplaced(sent, merged)).toBe(1)
  })

  it('does not count a row that came back as it was sent, and counts one deleted elsewhere', () => {
    const mine = withExpenses(expenseAt('e1', 55, T0), expenseAt('e2', 7, T0))
    const sent = sentRows(emptySnapshot(), mine)
    const sameEdit = { ...mine.expenses[0], updatedAt: new Date(T0).toISOString().replace('Z', '+00:00') }
    expect(countReplaced(sent, withExpenses(sameEdit))).toBe(1) // e2 is gone
    expect(countReplaced(sent, withExpenses(sameEdit, mine.expenses[1]))).toBe(0)
  })

  it('W1/W2: a row this device deleted or edited again after the flush is its own doing, not a replaced edit', () => {
    const mine = withExpenses(expenseAt('e1', 55, T0), expenseAt('e2', 7, T0))
    const sent = sentRows(emptySnapshot(), mine)
    // Before the pull: e1 binned here, e2 edited again here a minute later.
    const local = withExpenses(expenseAt('e2', 8, T0 + MIN))
    expect(countReplaced(sent, local, local)).toBe(0)
    // Without the local copy the same picture reads as two lost edits (the false toast).
    expect(countReplaced(sent, local)).toBe(2)
  })

  it('W1: a delete made after a replaced edit sticks on the server and on both devices', async () => {
    const clock = { now: T0 + 60 * MIN }
    const s = fakeEditTimeServer(clock)
    const base = expenseAt('e1', 0, T0)
    await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses(base))
    // B edits at +30 min; A's offline edit at +10 min is skipped and A pulls B's copy.
    const b = withExpenses(expenseAt('e1', 99, T0 + 30 * MIN))
    await flushDiff(s.client as never, 'u', withExpenses(base), b)
    clock.now = T0 + 120 * MIN
    const aStale = withExpenses(expenseAt('e1', 55, T0 + 10 * MIN))
    expect((await flushDiff(s.client as never, 'u', withExpenses(base), aStale)).skippedWrites).toBe(1)
    const cursor = clock.now
    const aMerged = applyDelta(aStale, s.delta(null), aStale)
    // A bins the row while the notice is up.
    clock.now = T0 + 125 * MIN
    const pending = { expenses: { e1: new Date(clock.now).toISOString() } }
    await flushDiff(s.client as never, 'u', aMerged, emptySnapshot(), pending)
    expect(s.rows.get('e1')?.deleted_at).not.toBeNull()
    // B pushes nothing new and pulls; A pulls again: the row stays gone on both.
    clock.now = T0 + 130 * MIN
    expect(applyDelta(b, s.delta(cursor), b).expenses).toEqual([])
    expect(applyDelta(emptySnapshot(), s.delta(cursor), emptySnapshot()).expenses).toEqual([])
  })
})
