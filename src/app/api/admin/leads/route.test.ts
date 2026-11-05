import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ guard: null as unknown, rows: [] as unknown[], kindFilter: null as string | null }))

vi.mock('@/lib/server/admin/guard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/admin/guard')>('@/lib/server/admin/guard')
  return { ...actual, guardAdmin: async () => state.guard }
})
vi.mock('@/lib/server/admin/staffActionGuards', () => ({ auditPiiRead: vi.fn(async () => {}) }))

import { GET } from './route'

const service = {
  from: () => {
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit']) c[m] = () => c
    c.eq = (_col: string, v: string) => { state.kindFilter = v; return c }
    c.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: state.rows, error: null }).then(res)
    return c
  },
}

beforeEach(() => {
  state.rows = [{ id: 'l1', kind: 'contact', email: 'jane.doe@example.com', name: 'Jane', message: 'hi', locale: 'en', created_at: '2026-11-01T00:00:00Z' }]
  state.kindFilter = null
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
})
