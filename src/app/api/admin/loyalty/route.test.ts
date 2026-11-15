import { beforeEach, describe, expect, it, vi } from 'vitest'

const USER = '11111111-1111-4111-8111-111111111111'
const h = vi.hoisted(() => ({ rpc: vi.fn(), audit: vi.fn(), guard: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/admin/guard', async (orig) => ({
  ...(await orig<typeof import('@/lib/server/admin/guard')>()),
  guardAdmin: h.guard,
}))

import { POST } from './route'

const post = (body: unknown) => POST(new Request('http://x/api/admin/loyalty', { method: 'POST', body: JSON.stringify(body) }))

describe('POST /api/admin/loyalty founder_decide', () => {
  beforeEach(() => {
    h.rpc.mockReset().mockResolvedValue({ data: 7, error: null })
    h.audit.mockReset().mockResolvedValue(undefined)
    h.guard.mockReset().mockResolvedValue({ ok: true, ctx: { service: { rpc: h.rpc }, user: { id: 'admin-1' }, audit: h.audit } })
  })

  it('needs the manage permission and stops at the guard', async () => {
    h.guard.mockResolvedValue({ ok: false, res: new Response(null, { status: 403 }) })
    expect((await post({ op: 'founder_decide', userId: USER, approve: true })).status).toBe(403)
    expect(h.guard).toHaveBeenCalledWith(expect.anything(), { permission: 'loyalty.manage' })
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('decides one account only: no list of ids, no missing decision', async () => {
    for (const body of [{ op: 'founder_decide', userId: [USER, USER], approve: true }, { op: 'founder_decide', userId: 'all', approve: true }, { op: 'founder_decide', userId: USER }]) {
      expect((await post(body)).status).toBe(400)
    }
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('issues the number through the database function and audits it', async () => {
    const res = await post({ op: 'founder_decide', userId: USER, approve: true, creditName: 'A' })
    expect(await res.json()).toEqual({ ok: true, number: 7 })
    expect(h.rpc).toHaveBeenCalledWith('loyalty_decide_founder', { p_user: USER, p_actor: 'admin-1', p_approve: true, p_credit_name: 'A' })
    expect(h.audit).toHaveBeenCalledWith('loyalty.founder_decide', expect.objectContaining({ targetId: USER, summary: 'Approved founder #7' }))
  })

  it('answers a known refusal with 409 and audits nothing', async () => {
    for (const message of ['not_pending', 'program_closed', 'staff', 'cap_reached']) {
      h.rpc.mockResolvedValueOnce({ data: null, error: { message } })
      expect((await post({ op: 'founder_decide', userId: USER, approve: true })).status).toBe(409)
    }
    expect(h.audit).not.toHaveBeenCalled()
  })

  it('answers an unexpected database error with 500', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    expect((await post({ op: 'founder_decide', userId: USER, approve: false })).status).toBe(500)
  })
})

describe('POST /api/admin/loyalty credit_name_decide', () => {
  beforeEach(() => {
    h.rpc.mockReset().mockResolvedValue({ data: 'approved', error: null })
    h.audit.mockReset().mockResolvedValue(undefined)
    h.guard.mockReset().mockResolvedValue({ ok: true, ctx: { service: { rpc: h.rpc }, user: { id: 'admin-1' }, audit: h.audit } })
  })

  it('decides one name through the database function and audits without the name', async () => {
    expect((await post({ op: 'credit_name_decide', userId: USER, approve: true })).status).toBe(200)
    expect(h.rpc).toHaveBeenCalledWith('loyalty_decide_credit_name', { p_user: USER, p_approve: true })
    expect(h.audit).toHaveBeenCalledWith('loyalty.credit_name_decide', expect.objectContaining({ targetId: USER, summary: 'Approved a credits name' }))
  })

  it('refuses a missing decision or a list of ids', async () => {
    for (const body of [{ op: 'credit_name_decide', userId: USER }, { op: 'credit_name_decide', userId: [USER], approve: true }]) expect((await post(body)).status).toBe(400)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('answers a name that is not pending with 409', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'not_pending' } })
    expect((await post({ op: 'credit_name_decide', userId: USER, approve: false })).status).toBe(409)
    expect(h.audit).not.toHaveBeenCalled()
  })
})
