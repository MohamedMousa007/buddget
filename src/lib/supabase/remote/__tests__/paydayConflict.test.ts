import { describe, expect, it } from 'vitest'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { emptySnapshot } from '@/lib/supabase/remote/snapshot'
import type { IncomeEvent } from '@/lib/store/types'

const ev = (id: string, occ: string | null, updatedAt = '2026-10-10T00:00:00Z'): IncomeEvent => ({
  id, templateId: 't1', name: 'Salary', amount: 5000, currency: 'EGP', receivedDate: '2026-10-01',
  occurrenceDate: occ, status: 'confirmed', createdAt: '2026-10-10T00:00:00Z', updatedAt,
})

function mockClient(opts: { liveId?: string; liveUpdatedAt?: string }) {
  const log: string[] = []
  const patches: Record<string, unknown>[] = []
  const live = new Set<string>(opts.liveId ? [`t1|2026-10-01`] : [])
  const client = {
    from: (table: string) => ({
      upsert: (rows: Record<string, unknown>[]) => {
        if (table !== 'income_events') return Promise.resolve({ error: null })
        log.push(`upsert:${rows.map((r) => r.id).join(',')}`)
        const dup = rows.some((r) => r.occurrence_date === '2026-10-01' && r.id !== opts.liveId && live.has('t1|2026-10-01'))
        return Promise.resolve({ error: dup ? { message: 'duplicate key', code: '23505' } : null })
      },
      update: (patch: Record<string, unknown>) => ({
        in: () => { log.push('tombstone'); return Promise.resolve({ error: null }) },
        eq: (_c: string, v: string) => { log.push(`update:${v}`); patches.push(patch); return Promise.resolve({ error: null }) },
      }),
      select: () => ({ eq: () => ({ eq: () => ({ is: () => ({
        maybeSingle: () => Promise.resolve({ data: opts.liveId ? { id: opts.liveId, updated_at: opts.liveUpdatedAt ?? '2026-10-05T00:00:00Z' } : null, error: null }),
      }) }) }) }),
    }),
  }
  return { client, log, patches }
}

describe('L3 duplicate payday event', () => {
  it('adopts the live row and still writes the rest of the batch', async () => {
    const { client, log, patches } = mockClient({ liveId: 'live-1' })
    const next = { ...emptySnapshot(), incomeEvents: [ev('a', '2026-10-01'), ev('b', '2026-11-01')] }
    const res = await flushDiff(client as never, 'u1', emptySnapshot(), next)
    expect(res.anyError).toBe(false)
    expect(log).toContain('upsert:b')
    expect(log).toContain('update:live-1')
    expect(patches[0]).not.toHaveProperty('id')
    expect(res.adoptedPaydays).toEqual(['a'])
  })

  it('keeps the live row untouched when it is newer', async () => {
    const { client, log } = mockClient({ liveId: 'live-1', liveUpdatedAt: '2026-12-01T00:00:00Z' })
    const next = { ...emptySnapshot(), incomeEvents: [ev('a', '2026-10-01'), ev('b', '2026-11-01')] }
    const res = await flushDiff(client as never, 'u1', emptySnapshot(), next)
    expect(res.anyError).toBe(false)
    expect(log.some((l) => l.startsWith('update:'))).toBe(false)
  })

  it('reports an error when no live row can be found', async () => {
    const { client } = mockClient({})
    const dupClient = { from: (t: string) => ({ ...client.from(t), upsert: () => Promise.resolve({ error: { message: 'dup', code: '23505' } }) }) }
    const next = { ...emptySnapshot(), incomeEvents: [ev('a', '2026-10-01')] }
    const res = await flushDiff(dupClient as never, 'u1', emptySnapshot(), next)
    expect(res.anyError).toBe(true)
  })

  it('tombstones the replaced event before the upsert of its replacement', async () => {
    const { client, log } = mockClient({})
    const prev = { ...emptySnapshot(), incomeEvents: [ev('old', '2026-10-01')] }
    const next = { ...emptySnapshot(), incomeEvents: [ev('new', '2026-10-01')] }
    await flushDiff(client as never, 'u1', prev, next)
    expect(log.indexOf('tombstone')).toBeLessThan(log.indexOf('upsert:new'))
  })
})
