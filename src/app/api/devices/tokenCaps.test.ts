import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, rpcs: [] as { name: string; args: unknown }[], session: 'sess-1' as string | null }))

/** Minimal chainable PostgREST stub: eq/neq/is/not filters, select/update/delete/insert/upsert. */
function table(name: string) {
  let op: 'select' | 'update' | 'delete' | 'insert' | 'upsert' = 'select'
  let patch: Row = {}
  const filters: ((r: Row) => boolean)[] = []
  const rows = () => (db.tables[name] ??= [])
  const run = (head = false) => {
    const hit = rows().filter((r) => filters.every((f) => f(r)))
    if (op === 'update') hit.forEach((r) => Object.assign(r, patch))
    if (op === 'delete') db.tables[name] = rows().filter((r) => !hit.includes(r))
    if (op === 'insert') { const r = { ...patch, token: 'tok-' + (rows().length + 1), is_active: true }; rows().push(r); return { data: r, error: null, count: 1 } }
    if (op === 'upsert') { rows().push(patch); return { data: [patch], error: null } }
    return { data: head ? null : ranged ? [...hit].reverse().slice(ranged[0], ranged[1] + 1) : hit, error: null, count: hit.length }
  }
  let head = false
  let ranged: [number, number] | null = null
  const q: Record<string, unknown> = {
    select: (_c?: string, o?: { head?: boolean }) => { head = Boolean(o?.head); return q },
    update: (p: Row) => { op = 'update'; patch = p; return q },
    delete: () => { op = 'delete'; return q },
    insert: (p: Row) => { op = 'insert'; patch = p; return q },
    upsert: (p: Row) => { op = 'upsert'; patch = p; return q },
    eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q },
    neq: (k: string, v: unknown) => { filters.push((r) => r[k] !== v); return q },
    is: (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return q },
    not: (k: string, _o: string, v: unknown) => { filters.push((r) => (r[k] ?? null) !== v); return q },
    order: () => q, limit: () => q,
    range: (a: number, b: number) => { ranged = [a, b]; return q },
    in: (k: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[k])); return q },
    maybeSingle: () => { const r = run(); return Promise.resolve({ data: (r.data as Row[])?.[0] ?? null, error: r.error }) },
    single: () => { const r = run(); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] : r.data, error: r.error }) },
    then: (res: (v: unknown) => unknown) => Promise.resolve(run(head)).then(res),
  }
  return q
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({ from: table, rpc: (name: string, args: unknown) => { db.rpcs.push({ name, args }); return Promise.resolve({ data: 1, error: null }) } }),
}))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: async () => 'u1', resolveActiveApiUserId: async () => 'u1' }))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteIdentity: async () => ({ id: 'u1', email: null, amr: [], sessionId: db.session }) }))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/server/emitNotification', () => ({ emitNotification: async () => undefined }))
vi.mock('@/lib/server/userDictionary', () => ({ getUserDictionary: async () => ({}) }))

import { DELETE as rotate } from '@/app/api/sms/setup-token/route'
import { POST as registerPush } from '@/app/api/push/register/route'

const PHONE = 'bbbbbbbb-0000-4000-8000-000000000002'
const req = (method: string, headers: Record<string, string> = {}, body?: unknown) =>
  new Request('http://x/api', { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })

beforeEach(() => {
  db.rpcs = []
  db.tables = { user_devices: [{ user_id: 'u1', device_id: PHONE, revoked_at: null, is_main: false }], sms_ingest_tokens: [], push_tokens: [] }
})

describe('SST-11: token tables stay bounded per account', () => {
  it('registering 30 distinct push tokens keeps the newest 20', async () => {
    for (let i = 0; i < 30; i++) {
      db.tables.push_tokens.push({ id: `old-${i}`, user_id: 'u1', token: `t${i}`, updated_at: `2026-01-${String(i + 1).padStart(2, '0')}` })
    }
    const res = await registerPush(req('POST', {}, { token: 'a-brand-new-token-1234', platform: 'ios' }))
    expect(res.status).toBe(200)
    expect(db.tables.push_tokens.filter((t) => t.user_id === 'u1').length).toBeLessThanOrEqual(21)
    expect(db.tables.push_tokens.length).toBeLessThan(31)
  })

  it('rotating many times keeps at most 5 retired ingest tokens', async () => {
    db.tables.sms_ingest_tokens = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, user_id: 'u1', device_id: null, is_active: false, token: `retired-${i}` }))
    const res = await rotate(req('DELETE'))
    expect(res.status).toBe(200)
    expect(db.tables.sms_ingest_tokens.filter((t) => t.is_active === false).length).toBe(5)
    expect(db.tables.sms_ingest_tokens.filter((t) => t.is_active === true).length).toBe(1)
  })

  it('rotation is rate limited', async () => {
    db.rpcs = []
    const limited = vi.spyOn(await import('@/lib/server/rateLimit'), 'isRateLimited').mockResolvedValueOnce(true)
    expect((await rotate(req('DELETE'))).status).toBe(429)
    limited.mockRestore()
  })
})
