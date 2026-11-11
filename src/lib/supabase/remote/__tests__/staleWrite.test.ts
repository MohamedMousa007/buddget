import { afterEach, describe, expect, it } from 'vitest'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { emptySnapshot, type Snapshot } from '@/lib/supabase/remote/snapshot'
import { applyDelta } from '@/lib/supabase/remote/delta'
import { noteServerTime, resetServerClock } from '@/lib/supabase/remote/serverClock'
import type { Expense } from '@/lib/store/types'
import { expenseAt, fakeEditTimeServer, pgTime } from './fakeEditTimeServer'

const T0 = Date.UTC(2026, 0, 1)
const H = 3_600_000
const MIN = 60_000
const withExpenses = (...e: Expense[]): Snapshot => ({ ...emptySnapshot(), expenses: e })

afterEach(() => resetServerClock())

describe('newest edit wins (edited_at), not first to reconnect', () => {
  it('B (edit +20 min) reconnects after A (edit +10 min): B wins; the other order leaves B too', async () => {
    for (const order of ['AB', 'BA'] as const) {
      const clock = { now: T0 + H }
      const s = fakeEditTimeServer(clock)
      const base = expenseAt('e1', 0, T0)
      await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses(base))
      const a = expenseAt('e1', 1, T0 + 10 * MIN)
      const b = expenseAt('e1', 2, T0 + 20 * MIN)
      const push = async (e: Expense, at: number) => { clock.now = at; return flushDiff(s.client as never, 'u', withExpenses(base), withExpenses(e)) }
      const results = order === 'AB' ? [await push(a, T0 + 100 * MIN), await push(b, T0 + 200 * MIN)] : [await push(b, T0 + 100 * MIN), await push(a, T0 + 200 * MIN)]
      expect(s.rows.get('e1')?.amount).toBe(2)
      expect(results[1].skippedWrites).toBe(order === 'AB' ? 0 : 1)
    }
  })

  it('the skipped device re-pulls and converges on the newer edit', async () => {
    const clock = { now: T0 + H }
    const s = fakeEditTimeServer(clock)
    const base = expenseAt('e1', 0, T0)
    await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses(base))
    await flushDiff(s.client as never, 'u', withExpenses(base), withExpenses(expenseAt('e1', 99, T0 + 30 * MIN)))
    clock.now = T0 + 5 * H
    const stale = expenseAt('e1', 55, T0 + 10 * MIN)
    const res = await flushDiff(s.client as never, 'u', withExpenses(base), withExpenses(stale))
    expect(res.skippedWrites).toBe(1)
    const merged = applyDelta(withExpenses(stale), s.delta(null), withExpenses(stale))
    expect(merged.expenses[0].amount).toBe(99)
  })

  it('never sends updated_at: it is the server write time', async () => {
    const s = fakeEditTimeServer({ now: T0 + H })
    await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses(expenseAt('e1', 1, T0)))
    expect(s.written[0][0]).not.toHaveProperty('updated_at')
    expect(s.written[0][0].edited_at).toBe(new Date(T0).toISOString())
  })
})

describe('REG-4: a server-side writer does not make a later user edit stale', () => {
  it('an SMS pairing bumps the row after the offline edit; the edit still lands', async () => {
    const clock = { now: T0 + H }
    const s = fakeEditTimeServer(clock)
    const base = expenseAt('e1', 10, T0)
    await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses(base))
    clock.now = T0 + 2 * H
    s.serverWrite('e1', { description: 'paired' }) // arrives after the user's offline edit, before its sync
    clock.now = T0 + 3 * H
    const res = await flushDiff(s.client as never, 'u', withExpenses(base), withExpenses(expenseAt('e1', 77, T0 + 90 * MIN)))
    expect(s.rows.get('e1')?.amount).toBe(77)
    expect(res.skippedWrites).toBe(0)
  })
})

describe('REG-1: a row created offline reaches other devices', () => {
  it('an insert carrying a 3 h old edit time is stored with updated_at = arrival, so a delta pull returns it', async () => {
    const clock = { now: T0 + 10 * H }
    const s = fakeEditTimeServer(clock)
    await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses(expenseAt('late', 5, T0 + 7 * H)))
    expect(Date.parse(s.rows.get('late')!.updated_at)).toBe(clock.now)
    const otherDeviceCursor = T0 + 9 * H
    expect(s.delta(otherDeviceCursor).expenses.upserts.map((e) => e.id)).toEqual(['late'])
  })
})

describe('OFS-1: a future-dated client time cannot be exploited', () => {
  it('an insert stamped a day ahead is clamped to now and does not block a later correct edit', async () => {
    const clock = { now: T0 + H }
    const s = fakeEditTimeServer(clock)
    await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses({ ...expenseAt('e1', 1, T0), updatedAt: new Date(T0 + 25 * H).toISOString() }))
    // The offset was unknown, so the device sent its (ahead) clock; the server clamps.
    expect(Date.parse(s.rows.get('e1')!.edited_at)).toBeLessThanOrEqual(clock.now)
    clock.now = T0 + 2 * H
    const res = await flushDiff(s.client as never, 'u', withExpenses(expenseAt('e1', 1, T0)), withExpenses(expenseAt('e1', 9, T0 + 90 * MIN + H)))
    expect(s.rows.get('e1')?.amount).toBe(9)
    expect(res.skippedWrites).toBe(0)
  })
})

describe('edit time on the server clock', () => {
  it('a device 2 h behind is not mistaken for stale once the offset is learned', async () => {
    const realNow = Date.now()
    noteServerTime(new Date(realNow + 2 * H).toISOString())
    const clock = { now: realNow + 2 * H }
    const s = fakeEditTimeServer(clock)
    s.rows.set('e1', { id: 'e1', amount: 10, edited_at: pgTime(realNow + 2 * H - 10 * MIN), updated_at: pgTime(realNow + 2 * H - 10 * MIN), deleted_at: null })
    const res = await flushDiff(s.client as never, 'u', withExpenses(expenseAt('e1', 10, realNow - 3 * H)), withExpenses(expenseAt('e1', 42, realNow - 1000)))
    expect(s.rows.get('e1')?.amount).toBe(42)
    expect(res.skippedWrites).toBe(0)
  })

  it('two quick edits on one device both land (offset noise below the tolerance)', async () => {
    const clock = { now: T0 + H }
    const s = fakeEditTimeServer(clock)
    const base = expenseAt('e1', 10, T0)
    await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses(base))
    const first = expenseAt('e1', 20, T0 + 30 * MIN)
    await flushDiff(s.client as never, 'u', withExpenses(base), withExpenses(first))
    const second = expenseAt('e1', 30, T0 + 30 * MIN - 1500)
    await flushDiff(s.client as never, 'u', withExpenses(first), withExpenses(second))
    expect(s.rows.get('e1')?.amount).toBe(30)
  })
})

describe('OFS-6 tombstone time', () => {
  it('stamps deleted_at on the server clock, not the raw device clock', async () => {
    const clock = { now: Date.now() }
    const s = fakeEditTimeServer(clock)
    const e = expenseAt('e1', 1, Date.now() - 1000)
    await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses(e))
    noteServerTime(new Date(Date.now() + 3 * H).toISOString())
    await flushDiff(s.client as never, 'u', withExpenses(e), withExpenses())
    const at = Date.parse(s.rows.get('e1')?.deleted_at as string)
    expect(Math.abs(at - (Date.now() + 3 * H))).toBeLessThan(5_000)
  })
})
