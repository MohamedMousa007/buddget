import { describe, expect, it } from 'vitest'
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
