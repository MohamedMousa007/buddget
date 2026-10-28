import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  guard: null as unknown,
  stepUp: true,
  insert: vi.fn(),
  tables: {} as Record<string, { data: unknown; error: unknown }>,
  rpc: { data: null as unknown, error: null as unknown },
  rpcCalls: [] as Array<[string, unknown]>,
}))

vi.mock('@/lib/server/admin/guard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/admin/guard')>('@/lib/server/admin/guard')
  return { ...actual, guardAdmin: async () => state.guard }
})
vi.mock('@/lib/server/admin/stepUp', () => ({ STEP_UP_ERROR: 'step up', stepUp: async () => state.stepUp }))

import { GET, POST } from './route'

const chain = (t: string) => {
  const r = state.tables[t] ?? { data: null, error: { message: 'missing' } }
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'not', 'order', 'limit', 'gt', 'in']) c[m] = () => c
  c.maybeSingle = async () => r
  c.single = async () => ({ data: { id: 'r1' }, error: null })
  c.insert = (row: unknown) => { state.insert(row); return c }
  c.then = (res: (v: unknown) => unknown) => Promise.resolve(r).then(res)
  return c
}

const audit = vi.fn()
const guard = (permissions: string[]) => ({ ok: true, ctx: { permissions: new Set(permissions), user: { id: 'u1' }, audit, service: { from: chain, rpc: async (fn: string, args?: unknown) => { state.rpcCalls.push([fn, args]); return state.rpc } } } })
const post = (b: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) })

beforeEach(() => {
  state.guard = guard(['sms.view', 'sms.manage'])
  state.stepUp = true
  state.tables = {}
  state.rpc = { data: null, error: { message: 'no fn' } }
  state.insert.mockReset()
  state.rpcCalls.length = 0
  audit.mockReset()
})

describe('GET overview', () => {
  it('reports retention off when the setting is missing and the table absent', async () => {
    const body = await (await GET(new Request('http://x'))).json()
    expect(body.countdown).toEqual({ state: 'off' })
    expect(body.tableReady).toBe(false)
  })
  it('computes a countdown from the oldest raw body', async () => {
    state.tables.platform_settings = { data: { value: 30 }, error: null }
    state.tables.sms_pattern_reviews = { data: [], error: null }
    state.tables.sms_parse_log = { data: [{ received_at: new Date(Date.now() - 25 * 86_400_000).toISOString() }], error: null }
    const body = await (await GET(new Request('http://x'))).json()
    expect(body.countdown).toMatchObject({ state: 'ok', daysLeft: 5, due: true })
    expect(body.tableReady).toBe(true)
  })
})

describe('GET pack and coverage', () => {
  it('says not available when the function is missing', async () => {
    expect(await (await GET(new Request('http://x?view=pack'))).json()).toEqual({ available: false, rows: [] })
    expect(await (await GET(new Request('http://x?view=coverage'))).json()).toEqual({ available: false, rows: [] })
  })
  it('returns and audits the pack', async () => {
    state.rpc = { data: [{ skeleton: 'a' }], error: null }
    expect(await (await GET(new Request('http://x?view=pack'))).json()).toEqual({ available: true, rows: [{ skeleton: 'a' }] })
    expect(audit).toHaveBeenCalled()
  })
  it('calls the pack function with the real period params (last closed review end to today)', async () => {
    state.rpc = { data: [], error: null }
    state.tables.sms_pattern_reviews = { data: [{ period_end: '2026-09-30' }], error: null }
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-15T12:00:00Z') })
    try {
      await GET(new Request('http://x?view=pack'))
    } finally {
      vi.useRealTimers()
    }
    expect(state.rpcCalls[0]).toEqual(['sms_review_pack', { period_start: '2026-09-30', period_end: '2026-10-15' }])
  })
})

describe('POST', () => {
  it('requires step-up', async () => {
    state.stepUp = false
    expect((await POST(post({ op: 'mark_reviewed' }))).status).toBe(401)
    expect(state.insert).not.toHaveBeenCalled()
  })
  it('requires a skip reason', async () => {
    expect((await POST(post({ op: 'skip' }))).status).toBe(400)
  })
  it('records a review and audits it', async () => {
    const res = await POST(post({ op: 'mark_reviewed', notes: 'fine' }))
    expect(res.status).toBe(200)
    expect(state.insert.mock.calls[0]![0]).toMatchObject({ status: 'reviewed', notes: 'fine', reviewed_by: 'u1' })
    expect(audit).toHaveBeenCalledWith('sms.pattern_review_done', expect.anything())
  })
})
