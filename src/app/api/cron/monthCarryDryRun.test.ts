import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ writes: [] as string[], rpcs: [] as string[] }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ from: fake, rpc: (name: string) => { h.rpcs.push(name); return Promise.resolve({ data: null, error: null }) } }) }))

/** A PostgREST stand-in: every read is empty (one user, no data) and every write is recorded. */
function fake(table: string) {
  const q: unknown = new Proxy({}, {
    get: (_t, prop: string) => {
      if (['insert', 'update', 'upsert', 'delete'].includes(prop)) return () => { h.writes.push(`${table}.${prop}`); return q }
      if (prop === 'maybeSingle' || prop === 'single') {
        return () => Promise.resolve({ data: table === 'profiles' ? { created_at: '2020-01-01T00:00:00Z', base_currency: 'EGP', default_carry_pocket_id: null } : null, error: null })
      }
      if (prop === 'then') {
        const rows = table === 'user_settings' ? [{ user_id: 'u1', month_start_day: 1, language: 'en', goal_progress_alerts: true, timezone: 'Africa/Cairo' }] : []
        return (res: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(res)
      }
      return () => q
    },
  })
  return q
}

import { GET } from './month-carry/route'

describe('month-carry dry run', () => {
  beforeEach(() => {
    h.writes = []; h.rpcs = []
    process.env.CRON_SECRET = 's3cret'
    vi.stubGlobal('fetch', async () => ({ json: async () => ({ rates: { EGP: 50, USD: 1 } }) }))
  })

  it('reads and reports counts, and writes nothing', async () => {
    const res = await GET(new Request('http://x/api/cron/month-carry?dryRun=1', { headers: { authorization: 'Bearer s3cret' } }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ ok: true, dryRun: true, scanned: 1, carried: 0, failed: 0 })
    expect(JSON.stringify(body)).not.toContain('u1')
    expect(h.writes).toEqual([])
    expect(h.rpcs).toEqual([])
  })

  it('still refuses without the secret, dry run or not', async () => {
    expect((await GET(new Request('http://x/api/cron/month-carry?dryRun=1'))).status).toBe(401)
  })
})
