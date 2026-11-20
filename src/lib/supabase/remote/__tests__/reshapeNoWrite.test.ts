import { describe, expect, it } from 'vitest'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { emptySnapshot, type Snapshot } from '@/lib/supabase/remote/snapshot'
import { DEFAULT_SETTINGS } from '@/lib/store/defaultFinanceData'

/** R17 / S8d-6: a boot that only reshaped rows the server already has must push nothing. */
function countingClient() {
  const writes: string[] = []
  const ok = () => Promise.resolve({ error: null, count: 1 })
  const client = {
    from: (table: string) => ({
      upsert: (rows: unknown[]) => { writes.push(table); return Promise.resolve({ error: null, count: rows.length }) },
      update: () => ({ in: () => { writes.push(`${table}.update`); return ok() }, eq: () => ok() }),
      delete: () => ({ in: () => { writes.push(`${table}.delete`); return ok() } }),
    }),
  }
  return { client, writes }
}

const profile = { id: 'u1', name: 'QA', gender: null, createdAt: '2026-11-19T10:00:00.000Z' } as never
const settings = { ...DEFAULT_SETTINGS }
const cashServer = { id: 'c0ffee00-0000-4000-8000-000000000001', name: 'Cash', type: 'cash', currency: 'EGP', isDefault: false, createdAt: '2026-11-19T10:00:00+00:00', updatedAt: '1999-12-31T23:59:59.866+00:00' }
const cashLocal = { ...cashServer, createdAt: '2026-11-19T10:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z' }
const expServer = { id: 'e1', date: '2026-11-19', description: 'QA R17 seed', category: 'Food', amount: 15, currency: 'EGP', amountInBaseCurrency: 0, paymentMethodId: cashServer.id, isRecurring: false, serverRev: 0, occurredAt: '2026-11-19T10:05:00+00:00', createdAt: '2026-11-19T10:05:00+00:00', updatedAt: '2026-11-19T10:05:00+00:00' }
const expLocal = { ...expServer, amountInBaseCurrency: 15, serverRev: undefined, occurredAt: '2026-11-19T10:05:00.000Z', createdAt: '2026-11-19T10:05:00.000Z', updatedAt: '2026-11-19T10:05:00.000Z' }

const snap = (pm: unknown, e: unknown): Snapshot => ({ ...emptySnapshot(), profile, settings, paymentMethods: [pm] as never, expenses: [e] as never })

describe('R17: reshaped rows are not edits', () => {
  it('the server-shaped copy and the locally reshaped copy of the same rows push nothing', async () => {
    const { client, writes } = countingClient()
    const r = await flushDiff(client as never, 'u1', snap(cashServer, expServer), snap(cashLocal, expLocal))
    expect(r.errors).toEqual([])
    expect(writes).toEqual([])
  })

  it('a real edit still goes out', async () => {
    const { client, writes } = countingClient()
    await flushDiff(client as never, 'u1', snap(cashServer, expServer), snap(cashLocal, { ...expLocal, amount: 16 }))
    expect(writes).toEqual(['expenses'])
  })

  it('a row the boot flagged as unsent is sent even when it looks the same', async () => {
    const { client, writes } = countingClient()
    await flushDiff(client as never, 'u1', snap(cashServer, { ...expLocal, __unsynced: true }), snap(cashServer, expLocal))
    expect(writes).toEqual(['expenses'])
  })
})
