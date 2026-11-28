import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ guard: null as unknown, rows: [] as unknown[], or: null as string | null, limit: null as number | null, table: '' }))

vi.mock('@/lib/server/admin/guard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/admin/guard')>('@/lib/server/admin/guard')
  return { ...actual, guardAdmin: async () => state.guard }
})
vi.mock('@/lib/server/admin/staffActionGuards', () => ({ auditPiiRead: vi.fn(async () => {}) }))

import { GET } from './route'

const service = {
  from: (table: string) => {
    state.table = table
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'order']) c[m] = () => c
    c.limit = (n: number) => { state.limit = n; return c }
    c.or = (f: string) => { state.or = f; return c }
    c.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: state.rows, error: null }).then(res)
    return c
  },
}

const row = (i = 0) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, email: 'jane.doe@example.com', name: 'Jane', country: 'EG', created_at: '2026-11-01T00:00:00.000Z' })

beforeEach(() => {
  state.rows = [row()]
  state.or = null
  state.limit = null
})

describe('GET /api/admin/waitlist', () => {
  it('reads waitlist_signups and masks email and name without users.pii', async () => {
    state.guard = { ok: true, ctx: { service, canSeePii: false } }
    const masked = (await (await GET(new Request('http://x'))).json()).rows[0]
    expect(state.table).toBe('waitlist_signups')
    expect(masked.email).toBe('ja***@ex***.com')
    expect(masked.name).toBe('J***')
    state.guard = { ok: true, ctx: { service, canSeePii: true } }
    const open = (await (await GET(new Request('http://x'))).json()).rows[0]
    expect(open).toMatchObject({ email: 'jane.doe@example.com', name: 'Jane', country: 'EG' })
  })

  it('pages 1000 at a time with a created_at|id cursor and ignores a malformed one', async () => {
    state.guard = { ok: true, ctx: { service, canSeePii: true } }
    state.rows = Array.from({ length: 1000 }, (_, i) => row(i))
    const first = await (await GET(new Request('http://x'))).json()
    expect(state.limit).toBe(1000)
    expect(first.nextCursor).toBe('2026-11-01T00:00:00.000Z|00000000-0000-4000-8000-000000000999')
    await GET(new Request(`http://x?cursor=${encodeURIComponent(first.nextCursor)}`))
    expect(state.or).toBe('created_at.lt.2026-11-01T00:00:00.000Z,and(created_at.eq.2026-11-01T00:00:00.000Z,id.lt.00000000-0000-4000-8000-000000000999)')
    state.or = null
    await GET(new Request('http://x?cursor=x),id.gt.0|nope'))
    expect(state.or).toBeNull()
  })

  it('returns the guard response when the caller lacks leads.view', async () => {
    state.guard = { ok: false, res: new Response(null, { status: 403 }) }
    expect((await GET(new Request('http://x'))).status).toBe(403)
  })
})
