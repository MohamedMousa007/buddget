import { describe, expect, it } from 'vitest'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { emptySnapshot } from '@/lib/supabase/remote/snapshot'
import type { SavingsAccount } from '@/lib/store/types'

const pocket = (over: Partial<SavingsAccount> = {}): SavingsAccount =>
  ({
    id: 'p1',
    name: 'Rainy day',
    category: 'savings',
    type: 'bank',
    currency: 'EGP',
    currentBalance: 100,
    createdAt: '2026-10-01T00:00:00Z',
    ...over,
  }) as SavingsAccount

function recorder() {
  const writes: Record<string, unknown>[][] = []
  const client = {
    from: (table: string) => ({
      upsert: (rows: Record<string, unknown>[]) => {
        if (table === 'savings_accounts') writes.push(rows)
        return Promise.resolve({ error: null })
      },
      update: () => ({ in: () => Promise.resolve({ error: null }) }),
    }),
  }
  return { client, writes }
}

const run = async (prev: SavingsAccount[], next: SavingsAccount[]) => {
  const r = recorder()
  await flushDiff(r.client as never, 'u1', { ...emptySnapshot(), savingsAccounts: prev }, { ...emptySnapshot(), savingsAccounts: next })
  return r.writes
}

describe('savings balance write guard (W7)', () => {
  it('a rename never sends the stale absolute balance', async () => {
    const writes = await run([pocket()], [pocket({ name: 'Renamed' })])
    expect(writes).toHaveLength(1)
    expect(writes[0][0]).toMatchObject({ id: 'p1', name: 'Renamed' })
    expect(writes[0][0]).not.toHaveProperty('current_balance')
  })

  it('a deposit still pushes the balance', async () => {
    const writes = await run([pocket()], [pocket({ currentBalance: 150 })])
    expect(writes[0][0]).toMatchObject({ id: 'p1', current_balance: 150 })
  })

  it('a new pocket pushes its balance', async () => {
    const writes = await run([], [pocket()])
    expect(writes[0][0]).toMatchObject({ id: 'p1', current_balance: 100, deleted_at: null })
  })

  it('mixed edits go in separate uniform batches', async () => {
    const a = pocket({ id: 'a' })
    const b = pocket({ id: 'b' })
    const writes = await run([a, b], [{ ...a, currentBalance: 5 }, { ...b, name: 'x' }])
    expect(writes).toHaveLength(2)
    for (const batch of writes) {
      expect(new Set(batch.map((r) => 'current_balance' in r)).size).toBe(1)
    }
  })

  it('retries a balance-less row once with its balance on 23502', async () => {
    const writes: Record<string, unknown>[][] = []
    const client = {
      from: () => ({
        upsert: (rows: Record<string, unknown>[]) => {
          writes.push(rows)
          const bad = !('current_balance' in rows[0])
          return Promise.resolve({ error: bad ? { code: '23502', message: 'null value in current_balance' } : null })
        },
        update: () => ({ in: () => Promise.resolve({ error: null }) }),
      }),
    }
    const res = await flushDiff(
      client as never,
      'u1',
      { ...emptySnapshot(), savingsAccounts: [pocket()] },
      { ...emptySnapshot(), savingsAccounts: [pocket({ name: 'Renamed' })] }
    )
    expect(res.anyError).toBe(false)
    expect(writes).toHaveLength(2)
    expect(writes[1][0]).toMatchObject({ id: 'p1', name: 'Renamed', current_balance: 100 })
  })
})
