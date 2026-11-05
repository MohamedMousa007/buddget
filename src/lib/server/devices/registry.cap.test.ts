import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server/emitNotification', () => ({ emitNotification: vi.fn() }))
vi.mock('@/lib/server/userDictionary', () => ({ getUserDictionary: async () => ({}) }))
vi.mock('@/lib/notifications/serverCopy', () => ({ renderServerCopy: () => ({}) }))
import { MAX_LIVE_DEVICES, upsertSelf } from './registry'

function fake(liveCount: number) {
  const inserts: unknown[] = []
  const rows = Array.from({ length: liveCount }, (_, i) => ({ device_id: `dev-${i}`, revoked_at: null, is_main: i === 0, last_seen_at: new Date().toISOString() }))
  const service = {
    from: () => {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        single: () => Promise.resolve({ data: { device_id: 'new' }, error: null }),
        insert: (row: unknown) => { inserts.push(row); return Promise.resolve({ error: null }) },
        then: (r: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(r),
      }
      return q
    },
  }
  return { service: service as never, inserts }
}

describe('upsertSelf device cap (API-7)', () => {
  it('does not create a row once the account holds the maximum of live devices', async () => {
    const { service, inserts } = fake(MAX_LIVE_DEVICES)
    const res = await upsertSelf(service, 'u1', 'new', { platform: 'ios' })
    expect(res).toEqual({ revoked: false, device: null })
    expect(inserts).toHaveLength(0)
  })

  it('still creates a row below the cap', async () => {
    const { service, inserts } = fake(MAX_LIVE_DEVICES - 1)
    await upsertSelf(service, 'u1', 'new', { platform: 'ios' })
    expect(inserts).toHaveLength(1)
  })
})
