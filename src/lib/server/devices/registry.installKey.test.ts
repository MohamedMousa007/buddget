import { beforeEach, describe, expect, it, vi } from 'vitest'

const emit = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/emitNotification', () => ({ emitNotification: emit }))
vi.mock('@/lib/server/userDictionary', () => ({ getUserDictionary: async () => ({}) }))
vi.mock('@/lib/notifications/serverCopy', () => ({ renderServerCopy: () => ({}) }))
import { upsertSelf } from './registry'

const KEY = 'a'.repeat(64)
type Row = { device_id: string; revoked_at: string | null; is_main: boolean; last_seen_at: string; install_key: string | null }

/** user_devices holds `rows`; records inserts, updates and RPC calls. */
function fake(rows: Row[]) {
  const inserts: Record<string, unknown>[] = []
  const updates: Record<string, unknown>[] = []
  const rpcs: { fn: string; args: Record<string, unknown> }[] = []
  const service = {
    rpc: (fn: string, args: Record<string, unknown>) => { rpcs.push({ fn, args }); return Promise.resolve({ data: true, error: null }) },
    from: () => {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        neq: () => q,
        is: () => q,
        update: (set: Record<string, unknown>) => { updates.push(set); return q },
        single: () => Promise.resolve({ data: { device_id: 'new' }, error: null }),
        maybeSingle: () => Promise.resolve({ data: { sms_tracking_enabled: false }, error: null }),
        insert: (row: Record<string, unknown>) => { inserts.push(row); return Promise.resolve({ error: null }) },
        then: (r: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(r),
      }
      return q
    },
  }
  return { service: service as never, inserts, updates, rpcs }
}

const now = new Date().toISOString()
const row = (device_id: string, extra: Partial<Row> = {}): Row => ({ device_id, revoked_at: null, is_main: false, last_seen_at: now, install_key: null, ...extra })

describe('upsertSelf reinstall reconciliation (BUD-107)', () => {
  beforeEach(() => emit.mockClear())

  it('a new device id carrying a live row’s install key supersedes it, without a "new device" notice', async () => {
    const f = fake([row('old', { is_main: true, install_key: KEY })])
    await upsertSelf(f.service, 'u1', 'new', { platform: 'android', installKey: KEY })
    expect(f.inserts).toHaveLength(1)
    expect(f.inserts[0]).toMatchObject({ device_id: 'new', is_main: false })
    expect(f.inserts[0]).not.toHaveProperty('install_key')
    expect(f.rpcs).toEqual([{ fn: 'devices_supersede', args: { p_user: 'u1', p_old: 'old', p_new: 'new' } }])
    expect(emit).not.toHaveBeenCalled()
  })

  it('a revoked row with the same key is never matched: the phone registers anew', async () => {
    const f = fake([row('main', { is_main: true }), row('old', { revoked_at: now, install_key: KEY })])
    await upsertSelf(f.service, 'u1', 'new', { platform: 'ios', installKey: KEY })
    expect(f.rpcs).toHaveLength(0)
    expect(f.inserts[0]).toMatchObject({ device_id: 'new', install_key: KEY })
  })

  it('without a key it behaves as before: a second row and the joined notice', async () => {
    const f = fake([row('old', { is_main: true })])
    await upsertSelf(f.service, 'u1', 'new', { platform: 'android' })
    expect(f.rpcs).toHaveLength(0)
    expect(f.inserts[0]).not.toHaveProperty('install_key')
    expect(emit).toHaveBeenCalledTimes(1)
  })

  it('two phones of the same model without keys are not merged', async () => {
    const f = fake([row('phoneA', { is_main: true })])
    await upsertSelf(f.service, 'u1', 'phoneB', { platform: 'android', model: 'Pixel 8' })
    expect(f.rpcs).toHaveLength(0)
  })

  it('ignores a malformed key', async () => {
    const f = fake([row('old', { is_main: true, install_key: KEY })])
    await upsertSelf(f.service, 'u1', 'new', { platform: 'android', installKey: 'ANDROID_ID_RAW' })
    expect(f.rpcs).toHaveLength(0)
    expect(f.inserts[0]).not.toHaveProperty('install_key')
  })

  it('an existing phone without a key learns it on its next heartbeat', async () => {
    const f = fake([row('self', { is_main: true })])
    await upsertSelf(f.service, 'u1', 'self', { platform: 'ios', installKey: KEY })
    expect(f.updates).toContainEqual({ install_key: KEY })
  })
})
