import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { emptySnapshot } from '@/lib/supabase/remote/snapshot'
import type { Expense } from '@/lib/store/types'

const expense = (id: string, amount: number): Expense => ({
  id,
  date: '2026-10-10',
  description: 'Lunch',
  category: 'Food',
  amount,
  currency: 'EGP',
  amountInBaseCurrency: amount,
  paymentMethodId: '',
  isRecurring: false,
  createdAt: '2026-10-10T00:00:00Z',
  updatedAt: '2026-10-10T00:00:00Z',
})

function recorder() {
  const writes: { rows: Record<string, unknown>[] }[] = []
  const client = {
    from: (table: string) => ({
      upsert: (rows: Record<string, unknown>[]) => {
        if (table === 'expenses') writes.push({ rows })
        return Promise.resolve({ error: null })
      },
      update: () => ({ in: () => Promise.resolve({ error: null }) }),
    }),
  }
  return { client, writes }
}

describe('flushDiff tombstones', () => {
  it('clears deleted_at when a deleted row is re-added, so undoing a delete survives sync', async () => {
    const { client, writes } = recorder()
    const prev = emptySnapshot()
    const next = { ...emptySnapshot(), expenses: [expense('e1', 50)] }
    await flushDiff(client as never, 'u1', prev, next)
    expect(writes[0].rows[0]).toMatchObject({ id: 'e1', deleted_at: null })
  })

  it('leaves deleted_at out of plain edits so an offline edit cannot resurrect a remote delete', async () => {
    const { client, writes } = recorder()
    const prev = { ...emptySnapshot(), expenses: [expense('e1', 50)] }
    const next = { ...emptySnapshot(), expenses: [expense('e1', 75)] }
    await flushDiff(client as never, 'u1', prev, next)
    expect(writes[0].rows[0]).toMatchObject({ id: 'e1', amount: 75 })
    expect(writes[0].rows[0]).not.toHaveProperty('deleted_at')
  })
})

describe('QA-41: a delete can only be undone by an action newer than the delete', () => {
  const T0 = Date.UTC(2026, 10, 1)
  const MIN = 60_000
  const withExpenses = (...e: Expense[]) => ({ ...emptySnapshot(), expenses: e })

  async function deletedOnServer() {
    const { fakeEditTimeServer, expenseAt } = await import('./fakeEditTimeServer')
    const clock = { now: T0 }
    const s = fakeEditTimeServer(clock)
    const row = expenseAt('e1', 50, T0)
    vi.setSystemTime(T0)
    await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses(row))
    // Another device deletes it ten minutes later.
    clock.now = T0 + 10 * MIN
    vi.setSystemTime(clock.now)
    await flushDiff(s.client as never, 'u', withExpenses(row), emptySnapshot())
    expect(s.rows.get('e1')?.deleted_at).toBeTruthy()
    return { s, clock, row, expenseAt }
  }

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a stale device re-sending the unchanged row as an insert does not bring it back', async () => {
    const { s, clock, row } = await deletedOnServer()
    clock.now = T0 + 20 * MIN
    vi.setSystemTime(clock.now)
    // Warm start with no stored fingerprint for the row: it is offered as an insert, edit time unchanged.
    await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses(row))
    expect(s.rows.get('e1')?.deleted_at).toBeTruthy()
  })

  it('an undo made after the delete, with its fresh stamp, brings the row back', async () => {
    const { s, clock, row } = await deletedOnServer()
    clock.now = T0 + 11 * MIN
    vi.setSystemTime(clock.now)
    useFinanceStore.setState({ expenses: [], receipts: [] })
    useFinanceStore.getState().restoreExpense(row)
    const restored = useFinanceStore.getState().expenses[0]
    expect(Date.parse(restored.updatedAt!)).toBe(clock.now)
    await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses(restored))
    expect(s.rows.get('e1')?.deleted_at).toBeNull()
  })

  it('an undo that is older than a later delete elsewhere is refused, and the device is told once', async () => {
    const { s, clock, row } = await deletedOnServer()
    const { noteRestored, refusedUndos } = await import('@/lib/store/undoWatch')
    // Undone offline five minutes before the other device's delete, delivered afterwards.
    const undone = { ...row, updatedAt: new Date(T0 + 5 * MIN).toISOString() }
    noteRestored('e1')
    clock.now = T0 + 30 * MIN
    vi.setSystemTime(clock.now)
    await flushDiff(s.client as never, 'u', emptySnapshot(), withExpenses(undone))
    expect(s.rows.get('e1')?.deleted_at).toBeTruthy()
    expect(refusedUndos(s.delta(T0).expenses.deletedIds)).toEqual(['e1'])
    expect(refusedUndos(['e1'])).toEqual([])
  })
})
