import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const h = vi.hoisted(() => ({
  caller: vi.fn(),
  remember: vi.fn(),
  nudge: vi.fn(),
  db: {} as Record<string, Row[]>,
  writes: [] as { table: string; op: string; values: Row; ids?: unknown }[],
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/sms/resolveSmsUser', () => ({ resolveSmsCaller: h.caller }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveActiveApiUserId: vi.fn(), resolveApiUserId: vi.fn() }))
vi.mock('@/lib/sms/deviceGate', () => ({ smsDeviceGate: async () => null }))
vi.mock('@/lib/sms/pairing', () => ({ rememberOwnAnswer: h.remember }))
vi.mock('@/lib/server/realtime/nudge', () => ({ nudgeUser: h.nudge }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = []
      let mode: 'select' | 'update' | 'insert' = 'select'
      let values: Row = {}
      const matching = () => (h.db[table] ?? []).filter((r) => filters.every((f) => f(r)))
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
        in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
        is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
        update: (v: Row) => ((mode = 'update'), (values = v), q),
        insert: (v: Row) => ((mode = 'insert'), (values = v), q),
        single: async () => (mode === 'insert' ? (h.writes.push({ table, op: 'insert', values }), { data: { id: 'new-income' }, error: null }) : { data: matching()[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => {
          if (mode === 'update') {
            h.writes.push({ table, op: 'update', values })
            matching().forEach((r) => Object.assign(r, values))
          }
          if (mode === 'insert') h.writes.push({ table, op: 'insert', values })
          resolve({ data: mode === 'select' ? matching() : null, error: null })
        },
      }
      return q
    },
  }),
}))

import { POST } from './route'

const OUT = '11111111-1111-4111-8111-111111111111'
const IN = '22222222-2222-4222-8222-222222222222'
const call = (parseLogId: string, action: string) =>
  POST(new Request('http://x/api/sms/own-transfer', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ parseLogId, action }) }))
const logs = (verdict: string, paired: boolean) => [
  { id: OUT, user_id: 'u1', amount: 500, currency: 'EGP', account_last4: '1111', received_at: '2026-11-01T10:00:00Z', raw_body: 'x', paired_log_id: paired ? IN : null, own_transfer_verdict: verdict, own_transfer_candidate: IN },
  { id: IN, user_id: 'u1', amount: 500, currency: 'EGP', account_last4: '2222', received_at: '2026-11-01T10:01:00Z', raw_body: 'y', paired_log_id: paired ? OUT : null, own_transfer_verdict: verdict, own_transfer_candidate: OUT },
]
const expense = (): Row => ({ id: 'e1', user_id: 'u1', sms_log_id: OUT, deleted_at: null, description: 'Transfer', category: 'Instapay' })
const log = (id: string) => h.db.sms_parse_log.find((r) => r.id === id)!

describe('POST /api/sms/own-transfer', () => {
  beforeEach(() => {
    h.caller.mockReset().mockResolvedValue({ userId: 'u1', deviceId: 'd1' })
    h.remember.mockReset()
    h.nudge.mockReset().mockResolvedValue(true)
    h.writes.length = 0
    h.db = { sms_parse_log: logs('ask', false), expenses: [expense()], income_events: [{ id: 'i1', user_id: 'u1', sms_log_id: IN, deleted_at: null }] }
  })

  it('rejects an unauthenticated caller', async () => {
    h.caller.mockResolvedValue({ userId: null, deviceId: null })
    expect((await call(OUT, 'confirm')).status).toBe(401)
  })

  it("refuses another user's row", async () => {
    h.caller.mockResolvedValue({ userId: 'u2', deviceId: 'd1' })
    expect((await call(OUT, 'confirm')).status).toBe(403)
    expect(h.writes).toHaveLength(0)
  })

  it('confirm retags the expense, soft-deletes the income, pairs and settles both logs', async () => {
    const res = await call(IN, 'confirm')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, action: 'confirm' })
    expect(h.db.expenses[0].category).toBe('Transfer')
    expect(h.db.income_events[0].deleted_at).toEqual(expect.any(String))
    expect(h.db.income_events[0].retracted_by_sms_log_id).toBe(OUT)
    expect(h.writes.find((w) => w.table === 'income_events')?.values).toMatchObject({ deleted_at: expect.any(String), retracted_by_sms_log_id: OUT })
    expect(log(OUT)).toMatchObject({ paired_log_id: IN, own_transfer_verdict: 'settle' })
    expect(log(IN)).toMatchObject({ paired_log_id: OUT, own_transfer_verdict: 'settle' })
    expect(h.remember).toHaveBeenCalledWith(expect.anything(), 'u1', '1111', '2222', true)
    expect(h.nudge).toHaveBeenCalledWith('u1', 'sms', { logId: IN })
  })

  it('decline marks both logs declined without touching the ledger', async () => {
    expect((await call(OUT, 'decline')).status).toBe(200)
    expect(log(OUT).own_transfer_verdict).toBe('declined')
    expect(log(IN).own_transfer_verdict).toBe('declined')
    expect(h.writes.every((w) => w.table === 'sms_parse_log')).toBe(true)
    expect(h.remember).toHaveBeenCalledWith(expect.anything(), 'u1', '1111', '2222', false)
  })

  it('undo restores a soft-deleted income and the spending category', async () => {
    h.db = { sms_parse_log: logs('settle', true), expenses: [{ ...expense(), category: 'Transfer' }], income_events: [{ id: 'i1', user_id: 'u1', sms_log_id: IN, deleted_at: '2026-11-01T11:00:00Z', retracted_by_sms_log_id: OUT }] }
    expect((await call(OUT, 'undo')).status).toBe(200)
    expect(h.db.income_events[0].deleted_at).toBeNull()
    expect(h.db.income_events[0].retracted_by_sms_log_id).toBeNull()
    expect(h.db.expenses[0].category).not.toBe('Transfer')
    expect(log(OUT)).toMatchObject({ paired_log_id: null, own_transfer_verdict: 'undone' })
    expect(log(IN)).toMatchObject({ paired_log_id: null, own_transfer_verdict: 'undone' })
    expect(h.remember).toHaveBeenCalledWith(expect.anything(), 'u1', '1111', '2222', false)
  })

  it("undo leaves a user-deleted income deleted (no marker) and inserts nothing", async () => {
    h.db = { sms_parse_log: logs('settle', true), expenses: [{ ...expense(), category: 'Transfer' }], income_events: [{ id: 'i1', user_id: 'u1', sms_log_id: IN, deleted_at: '2026-11-01T11:00:00Z', retracted_by_sms_log_id: null }] }
    expect((await call(OUT, 'undo')).status).toBe(200)
    expect(h.db.income_events[0].deleted_at).toBe('2026-11-01T11:00:00Z')
    expect(h.writes.some((w) => w.table === 'income_events')).toBe(false)
    expect(log(OUT).own_transfer_verdict).toBe('undone')
  })

  it("undo ignores a marker that names a message outside this pair", async () => {
    h.db = { sms_parse_log: logs('settle', true), expenses: [{ ...expense(), category: 'Transfer' }], income_events: [{ id: 'i1', user_id: 'u1', sms_log_id: IN, deleted_at: '2026-11-01T11:00:00Z', retracted_by_sms_log_id: '33333333-3333-4333-8333-333333333333' }] }
    expect((await call(OUT, 'undo')).status).toBe(200)
    expect(h.db.income_events[0].deleted_at).toBe('2026-11-01T11:00:00Z')
  })

  it('undo creates the income when none exists', async () => {
    h.db = { sms_parse_log: logs('settle', true), expenses: [{ ...expense(), category: 'Transfer' }], income_events: [] }
    expect((await call(OUT, 'undo')).status).toBe(200)
    const insert = h.writes.find((w) => w.table === 'income_events' && w.op === 'insert')
    expect(insert?.values).toMatchObject({ user_id: 'u1', name: 'Bank credit', amount: 500, currency: 'EGP', received_date: '2026-11-01', status: 'confirmed', sms_log_id: IN, source_type: 'other' })
    expect(log(IN).income_id).toBe('new-income')
  })

  it('answers 409 when the verdict does not allow the action', async () => {
    expect((await call(OUT, 'undo')).status).toBe(409)
    h.db.sms_parse_log = logs('settle', true)
    expect((await call(OUT, 'confirm')).status).toBe(409)
    expect(h.writes).toHaveLength(0)
  })
})
