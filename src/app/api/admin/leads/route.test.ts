import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ guard: null as unknown, rows: [] as unknown[], kindFilter: null as string | null, range: null as number[] | null, or: null as string | null, limit: null as number | null }))

vi.mock('@/lib/server/admin/guard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/admin/guard')>('@/lib/server/admin/guard')
  return { ...actual, guardAdmin: async () => state.guard }
})
vi.mock('@/lib/server/admin/staffActionGuards', () => ({ auditPiiRead: vi.fn(async () => {}) }))

import { GET } from './route'

const service = {
  from: () => {
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'range']) c[m] = () => c
    c.range = (a: number, b: number) => { state.range = [a, b]; return c }
    c.limit = (n: number) => { state.limit = n; return c }
    c.or = (f: string) => { state.or = f; return c }
    c.eq = (_col: string, v: string) => { state.kindFilter = v; return c }
    c.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: state.rows, error: null }).then(res)
    return c
  },
}

beforeEach(() => {
  state.rows = [{ id: 'l1', kind: 'contact', email: 'jane.doe@example.com', name: 'Jane', message: 'hi', locale: 'en', created_at: '2026-11-01T00:00:00Z' }]
  state.kindFilter = null
  state.range = null
  state.or = null
  state.limit = null
})

describe('GET /api/admin/leads', () => {
  it('masks the email without users.pii and passes it through with it', async () => {
    state.guard = { ok: true, ctx: { service, canSeePii: false } }
    expect((await (await GET(new Request('http://x'))).json()).rows[0].email).toBe('ja***@ex***.com')
    state.guard = { ok: true, ctx: { service, canSeePii: true } }
    expect((await (await GET(new Request('http://x'))).json()).rows[0].email).toBe('jane.doe@example.com')
  })

  it('filters by a known kind only', async () => {
    state.guard = { ok: true, ctx: { service, canSeePii: true } }
    await GET(new Request('http://x?kind=waitlist'))
    expect(state.kindFilter).toBe('waitlist')
    state.kindFilter = null
    await GET(new Request('http://x?kind=other'))
    expect(state.kindFilter).toBeNull()
  })

  it('ADS-3 hides name and message detail without users.pii', async () => {
    state.rows = [{ id: 'l1', kind: 'contact', email: 'jane@example.com', name: 'Jane Doe', message: 'Call me on 01001234567 about my account at 12 Nile St, Cairo', locale: 'en', created_at: 'x' }]
    state.guard = { ok: true, ctx: { service, canSeePii: false } }
    const row = (await (await GET(new Request('http://x'))).json()).rows[0]
    expect(row.name).toBe('J***')
    expect(row.message).not.toContain('Nile')
    state.guard = { ok: true, ctx: { service, canSeePii: true } }
    expect((await (await GET(new Request('http://x'))).json()).rows[0].message).toContain('Nile')
  })

  it('QA-58 pages with a created_at|id cursor, never an offset', async () => {
    state.guard = { ok: true, ctx: { service, canSeePii: true } }
    state.rows = Array.from({ length: 200 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, kind: 'waitlist', email: 'a@b.co', name: null, message: null, locale: 'en', created_at: '2026-11-01T00:00:00.000Z' }))
    const first = await (await GET(new Request('http://x'))).json()
    expect(state.range).toBeNull()
    expect(state.or).toBeNull()
    expect(state.limit).toBe(200)
    expect(first.nextCursor).toBe('2026-11-01T00:00:00.000Z|00000000-0000-4000-8000-000000000199')
    await GET(new Request(`http://x?cursor=${encodeURIComponent(first.nextCursor)}`))
    expect(state.or).toBe('created_at.lt.2026-11-01T00:00:00.000Z,and(created_at.eq.2026-11-01T00:00:00.000Z,id.lt.00000000-0000-4000-8000-000000000199)')
  })

  it('QA-58 keeps microseconds and the offset in the cursor', async () => {
    state.guard = { ok: true, ctx: { service, canSeePii: true } }
    const ts = '2026-11-01T00:00:00.123456+00:00'
    await GET(new Request(`http://x?cursor=${encodeURIComponent(`${ts}|00000000-0000-4000-8000-000000000001`)}`))
    expect(state.or).toBe(`created_at.lt.${ts},and(created_at.eq.${ts},id.lt.00000000-0000-4000-8000-000000000001)`)
  })

  it('QA-58 ignores a malformed cursor', async () => {
    state.guard = { ok: true, ctx: { service, canSeePii: true } }
    await GET(new Request('http://x?cursor=x),id.gt.0|nope'))
    expect(state.or).toBeNull()
  })
})
