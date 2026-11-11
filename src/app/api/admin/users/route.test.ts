import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ canSeePii: false, rpc: vi.fn(), audit: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/admin/guard', () => ({
  guardAdmin: async () => ({ ok: true, ctx: { canSeePii: h.canSeePii, service: { rpc: h.rpc } } }),
  json: (b: unknown, status = 200) => Response.json(b, { status }),
  maskIf: (ctx: { canSeePii: boolean }, e: string | null) => (ctx.canSeePii ? e : e && `${e.slice(0, 2)}***`),
}))
vi.mock('@/lib/server/admin/staffActionGuards', () => ({ auditPiiRead: h.audit }))

import { GET } from './route'

const get = (qs: string) => GET(new Request(`http://x/api/admin/users${qs}`))

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ data: { total: 1, rows: [{ id: 'u1', email: 'alice@example.com', name: null }] }, error: null })
  h.audit.mockReset()
})

describe('ADS-1 admin user search', () => {
  it('staff without users.pii search the masked address only', async () => {
    h.canSeePii = false
    const res = await get('?q=alice')
    expect(h.rpc).toHaveBeenCalledWith('admin_user_directory', expect.objectContaining({ p_search: 'alice', p_match_email: false }))
    expect((await res.json()).rows[0].email).toBe('al***')
  })

  it('staff with users.pii search the real address', async () => {
    h.canSeePii = true
    await get('?q=alice')
    expect(h.rpc).toHaveBeenCalledWith('admin_user_directory', expect.objectContaining({ p_match_email: true }))
  })

  it('a search is audited even for staff without users.pii; a plain list is not', async () => {
    h.canSeePii = false
    await get('?q=alice')
    expect(h.audit).toHaveBeenCalledWith(expect.anything(), 'user_search', 'user', null, { onlyWithPii: false })
    h.audit.mockClear()
    await get('')
    expect(h.audit).not.toHaveBeenCalledWith(expect.anything(), 'user_search', expect.anything(), expect.anything(), expect.anything())
  })
})

describe('ADS-6 offset clamp', () => {
  it.each(['1e999', '-5', 'abc', '2.7'])('offset=%s reaches the RPC as a safe integer', async (v) => {
    await get(`?offset=${v}`)
    const arg = h.rpc.mock.calls.at(-1)![1] as { p_offset: number }
    expect(Number.isSafeInteger(arg.p_offset)).toBe(true)
    expect(arg.p_offset).toBeGreaterThanOrEqual(0)
    expect(arg.p_offset).toBeLessThanOrEqual(1_000_000)
  })
})
