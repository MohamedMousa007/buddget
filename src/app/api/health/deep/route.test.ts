import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => {
      const c: Record<string, unknown> = {}
      for (const m of ['select', 'limit', 'order', 'eq', 'in']) c[m] = () => c
      c.maybeSingle = async () => ({ data: { value: { at: new Date().toISOString() } }, error: null })
      c.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(res)
      return c
    },
  }),
}))

import { GET } from './route'

const get = (headers?: Record<string, string>) => GET(new Request('http://x/api/health/deep', { headers }))

beforeEach(() => vi.stubEnv('CRON_SECRET', 'cron-s'))
afterEach(() => vi.unstubAllEnvs())

describe('GET /api/health/deep', () => {
  it('answers the public with ok and degraded only', async () => {
    const body = await (await get()).json()
    expect(body).toEqual({ ok: true, degraded: false })
  })

  it('gives the full detail to the cron secret', async () => {
    const body = await (await get({ authorization: 'Bearer cron-s' })).json()
    expect(body).toMatchObject({ ok: true, degraded: false, checks: { database: true } })
    expect(body.cron).toBeDefined()
  })
})
