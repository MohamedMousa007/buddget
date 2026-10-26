import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  caller: vi.fn(),
  cookieUser: vi.fn(),
  revoked: vi.fn(),
  log: vi.fn(),
  updates: [] as { table: string; values: Record<string, unknown>; eqs: Record<string, unknown>; error?: unknown }[],
  failWhen: null as null | ((table: string, values: Record<string, unknown>) => boolean),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/sms/resolveSmsUser', () => ({ resolveSmsCaller: h.caller }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: h.cookieUser }))
vi.mock('@/lib/server/devices/registry', () => ({ isRevokedDevice: h.revoked }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => ({
      select: () => ({ eq: () => ({ single: h.log }) }),
      update: (values: Record<string, unknown>) => {
        const rec = { table, values, eqs: {} as Record<string, unknown> }
        h.updates.push(rec)
        const q: { eq: (k: string, v: unknown) => typeof q; then: (r: (v: unknown) => void) => void } = {
          eq: (k, v) => { rec.eqs[k] = v; return q },
          then: (r) => r({ error: h.failWhen?.(table, values) ? { message: 'boom' } : null }),
        }
        return q
      },
    }),
  }),
}))

import { POST } from './route'

const LOG_ID = '11111111-1111-4111-8111-111111111111'
const req = (headers: Record<string, string> = { authorization: 'Bearer t' }) =>
  new Request('http://x/api/sms/undo', { method: 'POST', headers, body: JSON.stringify({ parseLogId: LOG_ID }) })

describe('POST /api/sms/undo', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => typeof m === 'function' && 'mockReset' in m && m.mockReset())
    h.updates.length = 0
    h.failWhen = null
    h.caller.mockResolvedValue({ userId: 'u1', deviceId: 'd1' })
    h.revoked.mockResolvedValue(false)
    h.log.mockResolvedValue({ data: { user_id: 'u1', expense_id: 'e1', income_id: null, debt_payment_id: 'p1' }, error: null })
  })

  it('accepts a JWT/ingest bearer through the shared resolver', async () => {
    expect((await POST(req())).status).toBe(200)
    expect(h.caller).toHaveBeenCalled()
  })

  it('soft-deletes expense and debt payment, and unlinks the log and its paired sibling', async () => {
    await POST(req())
    expect(h.updates.find((u) => u.table === 'expenses')?.values).toEqual({ deleted_at: expect.any(String) })
    expect(h.updates.find((u) => u.table === 'debt_payments')?.eqs).toMatchObject({ id: 'p1', user_id: 'u1' })
    const logUpdates = h.updates.filter((u) => u.table === 'sms_parse_log')
    expect(logUpdates[0].values).toEqual({ paired_log_id: null })
    expect(logUpdates[0].eqs).toMatchObject({ paired_log_id: LOG_ID })
    expect(logUpdates[1].values).toEqual({ expense_id: null, income_id: null, debt_payment_id: null, paired_log_id: null })
  })

  it('refuses a revoked device', async () => {
    h.revoked.mockResolvedValue(true)
    expect((await POST(req())).status).toBe(403)
    expect(h.updates).toHaveLength(0)
  })

  it('falls back to the session cookie when there is no bearer', async () => {
    h.cookieUser.mockResolvedValue('u1')
    expect((await POST(req({}))).status).toBe(200)
    expect(h.caller).not.toHaveBeenCalled()
  })

  it('rejects an unauthenticated caller', async () => {
    h.caller.mockResolvedValue({ userId: null, deviceId: null })
    expect((await POST(req())).status).toBe(401)
  })

  it('reports a failed final log update instead of ok', async () => {
    h.failWhen = (table, values) => table === 'sms_parse_log' && 'expense_id' in values
    const res = await POST(req())
    expect(res.status).toBe(500)
  })
})
