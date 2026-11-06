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
    return { data: head ? null : hit, error: null, count: hit.length }
  }
  let head = false
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

import { DELETE as rotate, GET as getToken } from '@/app/api/sms/setup-token/route'
import { POST as revokeToken } from '@/app/api/sms/revoke-token/route'
import { POST as registerPush } from '@/app/api/push/register/route'
import { POST as heartbeat } from '@/app/api/devices/route'
import { DELETE as removeDevice } from '@/app/api/devices/[id]/route'

const REMOVED = 'aaaaaaaa-0000-4000-8000-000000000001'
const PHONE = 'bbbbbbbb-0000-4000-8000-000000000002'
const OTHER = 'cccccccc-0000-4000-8000-000000000003'
const req = (method: string, headers: Record<string, string> = {}, body?: unknown) =>
  new Request('http://x/api', { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })

const seed = (removedPhone: boolean) => {
  db.rpcs = []
  db.tables = {
    user_devices: [
      ...(removedPhone ? [{ user_id: 'u1', device_id: REMOVED, revoked_at: '2026-11-01T00:00:00Z', is_main: false, session_id: 'sess-removed' }] : []),
      { user_id: 'u1', device_id: PHONE, revoked_at: null, is_main: false },
      { user_id: 'u1', device_id: OTHER, revoked_at: null, is_main: false },
    ],
    sms_ingest_tokens: [
      { user_id: 'u1', device_id: PHONE, is_active: true, token: 'tok-phone' },
      { user_id: 'u1', device_id: OTHER, is_active: true, token: 'tok-other' },
      { user_id: 'u1', device_id: null, is_active: true, token: 'tok-web' },
    ],
    push_tokens: [], biometric_devices: [], trusted_devices: [],
  }
}
const active = (token: string) => db.tables.sms_ingest_tokens.find((t) => t.token === token)?.is_active

describe('SST-1: a removed phone that drops every device identifier', () => {
  beforeEach(() => seed(true))

  it('setup-token GET and DELETE refuse a header-less request once the account has removed a phone', async () => {
    expect((await getToken(req('GET'))).status).toBe(403)
    expect((await rotate(req('DELETE'))).status).toBe(403)
    expect(active('tok-other')).toBe(true)
    expect(active('tok-phone')).toBe(true)
  })

  it('push/register refuses a request naming no phone in header or body', async () => {
    const res = await registerPush(req('POST', {}, { token: 'x'.repeat(20), platform: 'ios' }))
    expect(res.status).toBe(403)
    expect(db.tables.push_tokens).toHaveLength(0)
  })

  it('a live phone that names itself still works', async () => {
    expect((await getToken(req('GET', { 'x-buddget-device-id': PHONE }))).status).toBe(200)
    const res = await registerPush(req('POST', { 'x-buddget-device-id': PHONE }, { token: 'x'.repeat(20), platform: 'ios', deviceId: PHONE }))
    expect(res.status).toBe(200)
  })
})

describe('SST-1: accounts that never removed a phone are not locked out', () => {
  beforeEach(() => seed(false))

  it('header-less setup-token GET keeps working', async () => {
    const res = await getToken(req('GET'))
    expect(res.status).toBe(200)
    expect((await res.json()).token).toBe('tok-web')
  })

  it('a header-less rotate only deactivates device-less tokens, never another phone', async () => {
    const res = await rotate(req('DELETE'))
    expect(res.status).toBe(200)
    expect(active('tok-web')).toBe(false)
    expect(active('tok-phone')).toBe(true)
    expect(active('tok-other')).toBe(true)
  })

  it('a rotate from one phone leaves the other phone armed', async () => {
    await rotate(req('DELETE', { 'x-buddget-device-id': PHONE }))
    expect(active('tok-phone')).toBe(false)
    expect(active('tok-other')).toBe(true)
    expect(active('tok-web')).toBe(true)
  })
})

describe('NAT-2 server half: POST /api/sms/revoke-token', () => {
  beforeEach(() => seed(false))

  it('retires this phone tokens only', async () => {
    expect((await revokeToken(req('POST', { 'x-buddget-device-id': PHONE }))).status).toBe(200)
    expect(active('tok-phone')).toBe(false)
    expect(active('tok-other')).toBe(true)
    expect(active('tok-web')).toBe(true)
  })

  it('without a device id it retires only the device-less tokens', async () => {
    await revokeToken(req('POST'))
    expect(active('tok-web')).toBe(false)
    expect(active('tok-phone')).toBe(true)
  })
})

describe('AUT-8: removing a phone ends its Auth session', () => {
  beforeEach(() => { seed(false); db.session = 'sess-heartbeat' })

  it('the heartbeat records the session the phone is on', async () => {
    const res = await heartbeat(req('POST', { 'x-buddget-device-id': PHONE }, { platform: 'ios' }))
    expect(res?.status).toBe(200)
    expect(db.tables.user_devices.find((d) => d.device_id === PHONE)?.session_id).toBe('sess-heartbeat')
  })

  it('removal revokes exactly the recorded session', async () => {
    db.tables.user_devices.find((d) => d.device_id === OTHER)!.session_id = 'sess-other'
    const res = await removeDevice(req('DELETE', { 'x-buddget-device-id': PHONE }), { params: Promise.resolve({ id: OTHER }) })
    expect(res?.status).toBe(200)
    expect(db.rpcs).toEqual([{ name: 'revoke_auth_session', args: { p_user: 'u1', p_session: 'sess-other' } }])
  })

  it('a legacy phone with no recorded session is still removed, with no session call', async () => {
    const res = await removeDevice(req('DELETE', { 'x-buddget-device-id': PHONE }), { params: Promise.resolve({ id: OTHER }) })
    expect(res?.status).toBe(200)
    expect(db.rpcs).toEqual([])
    expect(db.tables.user_devices.find((d) => d.device_id === OTHER)?.revoked_at).toBeTruthy()
  })
})
