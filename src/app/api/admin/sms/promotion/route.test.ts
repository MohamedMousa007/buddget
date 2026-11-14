import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  guard: null as unknown,
  eligible: [] as Array<{ template_id: string; sender: string }>,
  promotedRows: [] as Array<{ id: string }>,
  checked: [] as string[],
}))

vi.mock('@/lib/server/admin/guard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/admin/guard')>('@/lib/server/admin/guard')
  return { ...actual, guardAdmin: async () => state.guard }
})
vi.mock('@/lib/sms/promotionChecker', () => ({
  invalidateConfigCache: vi.fn(),
  checkAndAutoPromote: async (sender: string) => { state.checked.push(sender) },
}))
vi.mock('@/lib/sms/replayLoader', () => ({ loadReplayCases: async () => [] }))

import { POST } from './route'

const from = () => {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'in', 'eq']) c[m] = () => c
  c.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: state.promotedRows, error: null }).then(res)
  return c
}
const audit = vi.fn()
const guard = { ok: true, ctx: { permissions: new Set(['sms.view', 'sms.manage']), audit, service: { from, rpc: async () => ({ data: state.eligible, error: null }) } } }
const post = (b: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) })

beforeEach(() => { state.guard = guard; state.checked = []; audit.mockReset() })

describe('run_auto_promote', () => {
  it('runs the replay-gated checker once per sender and counts what ended up promoted', async () => {
    state.eligible = [{ template_id: 'a', sender: 'S1' }, { template_id: 'b', sender: 'S1' }, { template_id: 'c', sender: 'S2' }]
    state.promotedRows = [{ id: 'a' }]
    const body = await (await POST(post({ op: 'run_auto_promote' }))).json()
    expect(state.checked.sort()).toEqual(['S1', 'S2'])
    expect(body).toEqual({ ok: true, promoted: 1, eligible: 3 })
  })
})
