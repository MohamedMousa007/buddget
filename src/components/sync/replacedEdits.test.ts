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
})
