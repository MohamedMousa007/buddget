import { beforeEach, describe, expect, it, vi } from 'vitest'

type Rec = { table: string; values: Record<string, unknown> }
const h = vi.hoisted(() => ({
  user: vi.fn(),
  create: vi.fn(),
  claimRow: null as Record<string, unknown> | null,
  updates: [] as { table: string; values: Record<string, unknown> }[],
  failTable: null as string | null,
  rpc: vi.fn(),
  gate: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: h.user }))
vi.mock('@/lib/server/userTimeZone', () => ({ getUserTimeZone: async () => 'Africa/Cairo' }))
vi.mock('@/lib/sms/deviceGate', () => ({ smsDeviceGate: h.gate }))
vi.mock('@/lib/sms/dispatch', () => ({ createSmsTransaction: h.create }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    rpc: h.rpc,
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => {
        const rec: Rec = { table, values }
        h.updates.push(rec)
        const q = {
          eq: () => q,
          select: () => ({ maybeSingle: async () => ({ data: h.claimRow }) }),
          then: (r: (v: unknown) => void) => r({ error: h.failTable === table ? { message: 'boom' } : null }),
        }
        return q
      },
    }),
  }),
}))

import { POST } from './route'

const LOG_ID = '11111111-1111-4111-8111-111111111111'
const post = (body: unknown) =>
  POST(new Request('http://x/api/sms/confirm', { method: 'POST', body: JSON.stringify(body) }))
const pending = (extra: Record<string, unknown> = {}) => ({
  id: LOG_ID, kind: 'purchase', amount: 50, currency: 'EGP', received_at: '2026-10-01T10:00:00Z',
  expense_id: null, income_id: null, raw_body: 'x', sender: 'CIB', bank_name: null, ...extra,
})
const logUpdates = () => h.updates.filter((u) => u.table === 'sms_parse_log').map((u) => u.values)

describe('POST /api/sms/confirm', () => {
  beforeEach(() => {
    h.user.mockReset().mockResolvedValue('u1')
    h.create.mockReset().mockResolvedValue({ expenseId: 'e1', incomeId: null, debtPaymentId: null, outcome: 'posted' })
    h.gate.mockReset().mockResolvedValue(null)
    h.rpc.mockReset().mockResolvedValue({ error: null })
    h.updates.length = 0
    h.failTable = null
    h.claimRow = pending()
  })

  it('releases the claim when posting throws', async () => {
    h.create.mockRejectedValueOnce(new Error('boom'))
    const res = await post({ logId: LOG_ID })
    expect(res.status).toBe(500)
    expect(logUpdates()).toContainEqual({ awaiting_confirmation: true, status: 'add_failed', failure_code: 'confirm_exception' })
  })

  it('fails loudly instead of degrading when a kind that needs the text has none left', async () => {
    h.claimRow = pending({ kind: 'income', raw_body: null })
    const res = await post({ logId: LOG_ID })
    expect(res.status).toBe(410)
    expect((await res.json()).reason).toBe('raw_purged')
    expect(h.create).not.toHaveBeenCalled()
  })

  it('still confirms a purchase whose text is gone (it needs nothing from it)', async () => {
    h.claimRow = pending({ raw_body: null })
    expect((await post({ logId: LOG_ID })).status).toBe(200)
  })

  it('refuses a removed phone before claiming anything', async () => {
    h.gate.mockResolvedValueOnce(new Response('{}', { status: 403 }))
    const res = await POST(new Request('http://x/api/sms/confirm', { method: 'POST', headers: { authorization: 'Bearer a.b.c', 'x-buddget-device-id': 'dev1' }, body: JSON.stringify({ logId: LOG_ID }) }))
    expect(res.status).toBe(403)
    expect(h.gate).toHaveBeenCalledWith(expect.anything(), { userId: 'u1', deviceId: 'dev1', viaJwt: true })
    expect(h.updates).toHaveLength(0)
  })

  it('claims the row first and posts once', async () => {
    const res = await post({ logId: LOG_ID })
    expect(res.status).toBe(200)
    expect(logUpdates()[0]).toEqual({ awaiting_confirmation: false })
    expect(h.create).toHaveBeenCalledTimes(1)
  })

  it('does not post when the claim lost the race', async () => {
    h.claimRow = null
    const res = await post({ logId: LOG_ID })
    expect(res.status).toBe(404)
    expect(h.create).not.toHaveBeenCalled()
  })

  it('releases the claim when the insert fails', async () => {
    h.create.mockResolvedValue({ expenseId: null, incomeId: null, debtPaymentId: null, error: 'x' })
    const res = await post({ logId: LOG_ID })
    expect(res.status).toBe(500)
    expect(logUpdates()).toContainEqual({ awaiting_confirmation: true, status: 'add_failed', failure_code: 'insert_failed' })
  })

  it('releases the claim and refuses a row with no amount or currency', async () => {
    h.claimRow = pending({ amount: null })
    const res = await post({ logId: LOG_ID })
    expect(res.status).toBe(422)
    expect(h.create).not.toHaveBeenCalled()
    expect(logUpdates()).toContainEqual({ awaiting_confirmation: true, status: 'add_failed', failure_code: 'invalid_row' })
  })

  it('rejects a currency outside the enum', async () => {
    expect((await post({ logId: LOG_ID, currency: 'XYZ' })).status).toBe(400)
    expect(h.updates).toHaveLength(0)
  })

  it('does not report ok when the currency update fails', async () => {
    h.claimRow = pending({ expense_id: 'e1' })
    h.failTable = 'expenses'
    const res = await post({ logId: LOG_ID, currency: 'USD' })
    expect(res.status).toBe(500)
    expect(logUpdates()).toContainEqual({ awaiting_confirmation: true, status: 'add_failed', failure_code: 'currency_update_failed' })
    expect(logUpdates()).not.toContainEqual(expect.objectContaining({ status: 'confirmed' }))
  })

  it('confirms a provisional currency in place', async () => {
    h.claimRow = pending({ expense_id: 'e1' })
    const res = await post({ logId: LOG_ID, currency: 'USD' })
    expect(await res.json()).toMatchObject({ ok: true, currencyConfirmed: true, currency: 'USD' })
    expect(h.create).not.toHaveBeenCalled()
  })
})
