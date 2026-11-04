import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: { op: string; args: unknown[] }[] = []
let result: { data: { id: string }[] | null; error: { message: string } | null } = { data: [], error: null }
const chain: Record<string, unknown> = {}
for (const op of ['update', 'is', 'lt', 'neq']) chain[op] = (...args: unknown[]) => { calls.push({ op, args }); return chain }
chain.select = () => Promise.resolve(result)
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ from: () => chain }) }))
vi.mock('@/lib/server/cronAuth', () => ({ isAuthorizedCron: (r: Request) => r.headers.get('authorization') === 'Bearer ok' }))

import { GET } from './route'

const EMAIL_LOG_RETENTION_DAYS = 90

const req = (auth?: string) => new Request('http://x/api/cron/data-retention', { headers: auth ? { authorization: auth } : {} })
beforeEach(() => { calls.length = 0; result = { data: [{ id: 'a' }, { id: 'b' }], error: null } })

describe('GET /api/cron/data-retention', () => {
  it('rejects callers without the cron secret and touches nothing', async () => {
    expect((await GET(req())).status).toBe(401)
    expect(calls).toHaveLength(0)
  })
  it('erases only the addresses of old rows that have no user, and reports a count', async () => {
    const res = await GET(req('Bearer ok'))
    expect(await res.json()).toEqual({ ok: true, emailLogErased: 2 })
    expect(calls.find((c) => c.op === 'update')?.args[0]).toEqual({ to_email: '[erased]' })
    expect(calls.find((c) => c.op === 'is')?.args).toEqual(['user_id', null])
    const cutoff = Date.parse(String(calls.find((c) => c.op === 'lt')?.args[1]))
    expect(Date.now() - cutoff).toBeGreaterThan((EMAIL_LOG_RETENTION_DAYS - 1) * 24 * 3600_000)
  })
  it('answers 500 without leaking the error', async () => {
    result = { data: null, error: { message: 'secret detail' } }
    const res = await GET(req('Bearer ok'))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secret')
  })
})
