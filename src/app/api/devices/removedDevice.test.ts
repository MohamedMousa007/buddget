import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, calls: [] as string[], failCleanup: false }))

/** Minimal chainable PostgREST stub: filters by eq/neq/is, supports select/update/delete/insert/upsert. */
function table(name: string) {
  let op: 'select' | 'update' | 'delete' | 'insert' | 'upsert' = 'select'
  let patch: Row = {}
  const filters: ((r: Row) => boolean)[] = []
  const rows = () => (db.tables[name] ??= [])
  const run = () => {
    db.calls.push(`${name}.${op}`)
    if (op === 'update' && db.failCleanup && name !== 'user_devices') return { data: null, error: { message: 'boom' } }
    const hit = rows().filter((r) => filters.every((f) => f(r)))
    if (op === 'update') hit.forEach((r) => Object.assign(r, patch))
    if (op === 'delete') db.tables[name] = rows().filter((r) => !hit.includes(r))
    if (op === 'insert') { const r = { ...patch, token: 'tok-' + (rows().length + 1) }; rows().push(r); return { data: r, error: null } }
    if (op === 'upsert') { rows().push(patch); return { data: [patch], error: null } }
    return { data: hit, error: null }
  }
  const q: Record<string, unknown> = {
    select: () => q,
    update: (p: Row) => { op = 'update'; patch = p; return q },
    delete: () => { op = 'delete'; return q },
    insert: (p: Row) => { op = 'insert'; patch = p; return q },
    upsert: (p: Row) => { op = 'upsert'; patch = p; return q },
    eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q },
    neq: (k: string, v: unknown) => { filters.push((r) => r[k] !== v); return q },
    is: (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return q },
    order: () => q, limit: () => q,
    maybeSingle: () => { const r = run(); return Promise.resolve({ data: (r.data as Row[])?.[0] ?? null, error: r.error }) },
    single: () => { const r = run(); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] : r.data, error: r.error }) },
    then: (res: (v: unknown) => unknown) => Promise.resolve(run()).then(res),
  }
  return q
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ from: table, rpc: () => Promise.resolve({ data: null, error: null }) }) }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: async () => 'u1' }))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/server/emitNotification', () => ({ emitNotification: async () => undefined }))
vi.mock('@/lib/server/userDictionary', () => ({ getUserDictionary: async () => ({}) }))

import { DELETE as rotate, GET as getToken } from '@/app/api/sms/setup-token/route'
import { POST as registerPush } from '@/app/api/push/register/route'
import { DELETE as removeDevice } from '@/app/api/devices/[id]/route'

const REVOKED = 'aaaaaaaa-0000-4000-8000-000000000001'
const seed = () => {
  db.calls = []; db.failCleanup = false
  db.tables = {
    user_devices: [
      { user_id: 'u1', device_id: REVOKED, revoked_at: '2026-11-01T00:00:00Z', is_main: false },
      { user_id: 'u1', device_id: 'this-phone', revoked_at: null, is_main: false },
    ],
    sms_ingest_tokens: [{ user_id: 'u1', device_id: 'this-phone', is_active: true, token: 'tok-0' }],
    push_tokens: [], biometric_devices: [{ user_id: 'u1', device_id: 'other-phone' }], trusted_devices: [],
  }
}
const req = (method: string, headers: Record<string, string> = {}, body?: unknown) =>
  new Request('http://x/api', { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })

beforeEach(seed)

describe('API-1 sms/setup-token: DELETE skips the revoked-device check that GET enforces', () => {
  it('GET refuses a removed phone (control, passes)', async () => {
    expect((await getToken(req('GET', { 'x-buddget-device-id': REVOKED }))).status).toBe(403)
  })
  it('DELETE (rotate) must refuse too', async () => {
    expect((await rotate(req('DELETE', { 'x-buddget-device-id': REVOKED }))).status).toBe(403)
  })
})

describe('API-2 push/register: a removed phone re-registers by leaving deviceId out of the body', () => {
  it('with its deviceId it is refused (control, passes)', async () => {
    const res = await registerPush(req('POST', {}, { token: 'x'.repeat(20), platform: 'ios', deviceId: REVOKED }))
    expect(res.status).toBe(403)
  })
  it('without deviceId in the body (header still names the removed phone)', async () => {
    const res = await registerPush(req('POST', { 'x-buddget-device-id': REVOKED }, { token: 'x'.repeat(20), platform: 'ios' }))
    expect(res.status).toBe(403)
    expect(db.tables.push_tokens).toHaveLength(0)
  })
})

describe('API-3 devices/[id] DELETE: revoke is written first, cleanup after; a failed cleanup cannot be retried', () => {
  it('first call 500 (cleanup failed), the retry finishes the cleanup', async () => {
    db.tables.user_devices.push({ user_id: 'u1', device_id: 'other-phone', revoked_at: null, is_main: false })
    db.failCleanup = true
    await removeDevice(req('DELETE', { 'x-buddget-device-id': 'this-phone' }), { params: Promise.resolve({ id: 'other-phone' }) })
    db.failCleanup = false
    const retry = await removeDevice(req('DELETE', { 'x-buddget-device-id': 'this-phone' }), { params: Promise.resolve({ id: 'other-phone' }) })
    expect(retry?.status).toBe(200)
    expect(db.tables.biometric_devices).toHaveLength(0)
  })
})
