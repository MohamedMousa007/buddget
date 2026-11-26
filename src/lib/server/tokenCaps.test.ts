import { describe, expect, it } from 'vitest'
import { MAX_ACTIVE_INGEST_TOKENS, capActiveIngestTokens } from './tokenCaps'

type Row = { id: string; user_id: string; device_id: string | null; is_active: boolean; created_at: string }

function fakeService(rows: Row[]) {
  const deleted: string[] = []
  const service = {
    from: () => {
      const filters: ((r: Row) => boolean)[] = []
      let patch: Partial<Row> | null = null
      let from = 0
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (k: keyof Row, v: unknown) => (filters.push((r) => r[k] === v), q),
        is: (k: keyof Row, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
        in: (k: keyof Row, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
        order: () => q,
        range: (a: number) => ((from = a), q),
        update: (v: Partial<Row>) => ((patch = v), q),
        delete: () => ((deleted.push('called')), q),
        then: (resolve: (v: unknown) => void) => {
          const hit = rows.filter((r) => filters.every((f) => f(r))).sort((a, b) => b.created_at.localeCompare(a.created_at))
          if (patch) hit.forEach((r) => Object.assign(r, patch))
          resolve({ data: patch ? null : hit.slice(from), error: null })
        },
      }
      return q
    },
  }
  return { service: service as never, deleted }
}

const row = (id: string, device: string | null, day: number, user = 'u1'): Row => ({ id, user_id: user, device_id: device, is_active: true, created_at: `2026-11-0${day}` })

describe('capActiveIngestTokens', () => {
  it('deactivates the oldest active tokens of this device beyond the cap and leaves other scopes alone', async () => {
    const rows = [row('a', 'd1', 1), row('b', 'd1', 2), row('c', 'd1', 3), row('d', 'd1', 4), row('o', 'd2', 1), row('w', null, 1), row('z', 'd1', 1, 'u2')]
    const { service, deleted } = fakeService(rows)
    await capActiveIngestTokens(service, 'u1', 'd1')
    const off = rows.filter((r) => !r.is_active).map((r) => r.id)
    expect(MAX_ACTIVE_INGEST_TOKENS).toBe(3)
    expect(off).toEqual(['a'])
    expect(deleted).toHaveLength(0)
  })

  it('scopes a device-less call to device-less tokens', async () => {
    const rows = [row('a', null, 1), row('b', null, 2), row('c', null, 3), row('d', null, 4), row('o', 'd1', 1)]
    const { service } = fakeService(rows)
    await capActiveIngestTokens(service, 'u1', null)
    expect(rows.filter((r) => !r.is_active).map((r) => r.id)).toEqual(['a'])
  })

  it('keeps every token of a burst active, so whichever one the phone saved last still works', async () => {
    const now = Date.parse('2026-11-26T18:19:30Z')
    const at = (s: number) => new Date(now - s * 1000).toISOString()
    const burst = ['t1', 't2', 't3', 't4', 't5'].map((id, i) => ({ ...row(id, 'd1', 1), created_at: at(7 - i) }))
    const rows = [{ ...row('old', 'd1', 1), created_at: '2026-11-20T00:00:00Z' }, ...burst]
    const { service } = fakeService(rows)
    await capActiveIngestTokens(service, 'u1', 'd1', now)
    expect(rows.filter((r) => !r.is_active).map((r) => r.id)).toEqual(['old'])
  })
})
