import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  guard: null as unknown,
  updates: [] as Array<{ table: string; row: Record<string, unknown> }>,
  template: { data: null as unknown, error: null as unknown },
  flagged: [{ id: 'a' }, { id: 'b' }] as unknown,
  rpc: { data: null as unknown, error: null as unknown },
  report: { ok: true, checked: 0, regressions: [] as unknown[] },
  cases: [{}, {}, {}] as unknown[],
}))

vi.mock('@/lib/server/admin/guard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/admin/guard')>('@/lib/server/admin/guard')
  return { ...actual, guardAdmin: async () => state.guard }
})
const invalidate = vi.hoisted(() => vi.fn())
vi.mock('@/lib/sms/curatedDbCache', () => ({ invalidateCuratedDbCache: invalidate }))
vi.mock('@/lib/sms/replayLoader', () => ({ loadReplayCases: async () => state.cases }))
vi.mock('@/lib/sms/replayHarness', () => ({ replayCandidate: () => state.report }))

import { POST } from './route'

const from = (table: string) => {
  let row: Record<string, unknown> | null = null
  const c: Record<string, unknown> = {}
  for (const m of ['eq', 'is', 'neq', 'select']) c[m] = () => c
  c.update = (r: Record<string, unknown>) => { row = r; state.updates.push({ table, row: r }); return c }
  c.single = async () => state.template
  c.then = (res: (v: unknown) => unknown) =>
    Promise.resolve(table === 'sms_parse_log' ? { data: state.flagged, error: null } : { data: row, error: null }).then(res)
  return c
}

const audit = vi.fn()
const guard = (permissions: string[]) => ({ ok: true, ctx: { permissions: new Set(permissions), user: { id: 'u1' }, audit, service: { from, rpc: async () => state.rpc } } })
const post = (b: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) })
const healthy = { sender: 'BANK', regex_pattern: 'x', mapping_rules: {}, status: 'active', ai_enabled: true, failure_count: 0, hard_fail: false }

beforeEach(() => {
  state.guard = guard(['sms.view', 'sms.manage'])
  state.updates = []
  state.template = { data: { ...healthy }, error: null }
  state.flagged = [{ id: 'a' }, { id: 'b' }]
  state.rpc = { data: null, error: null }
  state.report = { ok: true, checked: 0, regressions: [] }
  invalidate.mockReset()
  audit.mockReset()
})

describe('kill', () => {
  it('switches the template off, flags its rows and reports the count', async () => {
    const res = await POST(post({ op: 'kill', id: 't1' }))
    expect(await res.json()).toEqual({ ok: true, flagged: 2 })
    expect(state.updates[0]).toMatchObject({ table: 'sms_tracking_templates_ai', row: { ai_enabled: false, tier: 'template', promoted_at: null, auto_promoted: false } })
    expect(state.updates[1]!.row).toHaveProperty('template_revoked_at')
    expect(invalidate).toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith('sms.template_kill', expect.objectContaining({ summary: 'Switched off SMS template', metadata: { flagged: 2 } }))
  })
  it('is forbidden without sms.manage', async () => {
    state.guard = guard(['sms.view'])
    const res = await POST(post({ op: 'kill', id: 't1' }))
    expect(res.status).toBe(403)
    expect(state.updates).toHaveLength(0)
  })
})

describe('demote', () => {
  it('flags rows and busts the cache', async () => {
    const res = await POST(post({ op: 'demote', id: 't1' }))
    expect(await res.json()).toEqual({ ok: true, flagged: 2 })
    expect(invalidate).toHaveBeenCalled()
  })
})

describe('update', () => {
  it('flags rows when switching the bypass off', async () => {
    state.template = { data: { id: 't1' }, error: null }
    const body = await (await POST(post({ op: 'update', id: 't1', patch: { ai_enabled: false } }))).json()
    expect(body.flagged).toBe(2)
  })
})

describe('promote', () => {
  it('is refused when the replay reports a regression', async () => {
    state.report = { ok: false, checked: 3, regressions: [{}] }
    const res = await POST(post({ op: 'promote', id: 't1' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('1 regression')
    expect(state.updates).toHaveLength(0)
  })
  it('is refused when the template has failures', async () => {
    state.template = { data: { ...healthy, failure_count: 2 }, error: null }
    const res = await POST(post({ op: 'promote', id: 't1' }))
    expect(res.status).toBe(400)
    expect(state.updates).toHaveLength(0)
  })
  it('promotes a clean template', async () => {
    const body = await (await POST(post({ op: 'promote', id: 't1' }))).json()
    expect(body).toEqual({ ok: true, replayChecked: 3 })
    expect(state.updates[0]!.row).toMatchObject({ tier: 'curated_db' })
    expect(invalidate).toHaveBeenCalled()
  })
})

describe('candidates', () => {
  it('returns the RPC rows', async () => {
    state.rpc = { data: [{ template_id: 't1', sender: 'BANK', match_count: 20, unique_user_count: 1, age_days: 30 }], error: null }
    const body = await (await POST(post({ op: 'candidates' }))).json()
    expect(body.candidates).toHaveLength(1)
  })
  it('fails cleanly on RPC error', async () => {
    state.rpc = { data: null, error: { message: 'x' } }
    expect((await POST(post({ op: 'candidates' }))).status).toBe(500)
  })
})
