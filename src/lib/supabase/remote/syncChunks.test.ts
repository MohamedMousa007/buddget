import { describe, expect, it, vi } from 'vitest'
import { OpRunner } from './sync'

function client() {
  const upsert = vi.fn(async (_batch: unknown[]) => ({ error: null, count: 0 }))
  const del = vi.fn(async () => ({ error: null }))
  const upd = vi.fn(async () => ({ error: null }))
  const from = vi.fn(() => ({
    upsert,
    delete: () => ({ in: del }),
    update: () => ({ in: upd }),
  }))
  return { c: { from } as never, upsert, del, upd }
}

describe('OpRunner chunking', () => {
  it('sends 2,000 rows as 4 upserts of 500', async () => {
    const { c, upsert } = client()
    const r = new OpRunner(c)
    r.upsert('expenses', Array.from({ length: 2000 }, (_, i) => ({ id: String(i) })) as never, 'x')
    await r.drain()
    expect(upsert).toHaveBeenCalledTimes(4)
    expect(upsert.mock.calls.every(([batch]) => batch.length === 500)).toBe(true)
  })

  it('deletes and tombstones 250 ids in 3 requests', async () => {
    const { c, del, upd } = client()
    const ids = Array.from({ length: 250 }, (_, i) => String(i))
    const r = new OpRunner(c)
    r.delete('expenses', ids, 'x')
    r.tombstone('expenses', ids, 'x')
    await r.drain()
    expect(del).toHaveBeenCalledTimes(3)
    expect(upd).toHaveBeenCalledTimes(3)
  })

  it('still bisects a failing chunk down to the bad row', async () => {
    const upsert = vi.fn(async (batch: { id: string }[]) =>
      batch.some((b) => b.id === '7') ? { error: { message: 'bad', code: '23514' }, count: 0 } : { error: null, count: batch.length })
    const r = new OpRunner({ from: () => ({ upsert }) } as never)
    r.upsert('expenses', Array.from({ length: 600 }, (_, i) => ({ id: String(i) })) as never, 'x')
    const res = await r.drain()
    expect((res.parked ?? []).map((p) => p.id)).toEqual(['7'])
  })
})
