import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const h = vi.hoisted(() => ({
  caller: vi.fn(),
  nudge: vi.fn(),
  db: {} as Record<string, Row[]>,
  writes: [] as { table: string; op: string; values: Row }[],
  failInsert: false,
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/sms/resolveSmsUser', () => ({ resolveSmsCaller: h.caller }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveActiveApiUserId: vi.fn(), resolveApiUserId: vi.fn() }))
vi.mock('@/lib/sms/deviceGate', () => ({ smsDeviceGate: async () => null }))
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
        is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
        order: () => q,
        limit: () => q,
        update: (v: Row) => ((mode = 'update'), (values = v), q),
        insert: (v: Row) => ((mode = 'insert'), (values = v), q),
        maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
        single: async () => {
          if (h.failInsert) return { data: null, error: { message: 'boom' } }
          h.writes.push({ table, op: 'insert', values })
          return { data: { id: 'new-expense' }, error: null }
        },
        then: (resolve: (v: unknown) => void) => {
          if (mode === 'update') {
            h.writes.push({ table, op: 'update', values })
            matching().forEach((r) => Object.assign(r, values))
          }
          resolve({ data: null, error: null })
        },
      }
      return q
    },
  }),
}))

import { POST } from './route'

const PLACEHOLDER = '11111111-1111-4111-8111-111111111111'
const TARGET = '22222222-2222-4222-8222-222222222222'
const INCOME = '33333333-3333-4333-8333-333333333333'
const LOG = '44444444-4444-4444-8444-444444444444'
const call = (body: unknown) => POST(new Request('http://x/api/sms/flag-action', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) }))
const row = (id: string) => (h.db.expenses ?? []).find((r) => r.id === id)!

const placeholder = (): Row => ({ id: PLACEHOLDER, user_id: 'u1', amount: 250, currency: 'EGP', sms_log_id: LOG, refund_kind: 'refunded', refunded_at: '2026-11-10T09:00:00Z', sms_flags: ['refund_unmatched'], deleted_at: null })
const target = (extra: Row = {}): Row => ({ id: TARGET, user_id: 'u1', amount: 250, currency: 'EGP', sms_log_id: null, refund_kind: null, refunded_at: null, sms_flags: null, deleted_at: null, ...extra })
const income = (extra: Row = {}): Row => ({ id: INCOME, user_id: 'u1', amount: 900, currency: 'EGP', received_date: '2026-11-09', occurred_at: '2026-11-09T10:00:00Z', sms_log_id: LOG, payment_method_id: 'bank-1', sms_flags: ['cash_deposit'], deleted_at: null, retracted_by_sms_log_id: null, ...extra })
const match = (targetExpenseId = TARGET) => ({ action: 'refund_match', expenseId: PLACEHOLDER, targetExpenseId })

describe('POST /api/sms/flag-action', () => {
  beforeEach(() => {
    h.caller.mockReset().mockResolvedValue({ userId: 'u1', deviceId: 'd1' })
    h.nudge.mockReset().mockResolvedValue(true)
    h.writes.length = 0
    h.failInsert = false
    h.db = {
      expenses: [placeholder(), target()],
      income_events: [income()],
      payment_methods: [{ id: 'cash-1', user_id: 'u1', type: 'cash', deleted_at: null, closed_at: null }],
      sms_parse_log: [{ id: LOG, user_id: 'u1', expense_id: PLACEHOLDER, income_id: INCOME, kind: 'income' }],
    }
  })

  it('rejects an unauthenticated caller and a malformed body', async () => {
    h.caller.mockResolvedValue({ userId: null, deviceId: null })
    expect((await call(match())).status).toBe(401)
    h.caller.mockResolvedValue({ userId: 'u1', deviceId: 'd1' })
    expect((await call({ action: 'nope' })).status).toBe(400)
  })

  it('refund_match stamps the purchase, retires the placeholder without a marker and repoints the log (I1)', async () => {
    const res = await call(match())
    expect(res.status).toBe(200)
    expect(row(TARGET)).toMatchObject({ refunded_at: '2026-11-10T09:00:00Z', refund_kind: 'refunded', refund_sms_log_id: LOG })
    expect(row(PLACEHOLDER).deleted_at).toEqual(expect.any(String))
    expect(row(PLACEHOLDER)).not.toHaveProperty('retracted_by_sms_log_id')
    expect(h.db.sms_parse_log[0].expense_id).toBe(TARGET)
    expect(h.writes.every((w) => !('edited_at' in w.values))).toBe(true)
  })

  it('refund_match refuses a purchase of another amount or currency (I1)', async () => {
    h.db.expenses = [placeholder(), target({ amount: 249 })]
    expect((await call(match())).status).toBe(409)
    h.db.expenses = [placeholder(), target({ currency: 'USD' })]
    expect((await call(match())).status).toBe(409)
    expect(h.writes).toHaveLength(0)
  })

  it('refund_match refuses an already refunded, deleted or own-placeholder target', async () => {
    h.db.expenses = [placeholder(), target({ refunded_at: '2026-11-01T00:00:00Z' })]
    expect((await call(match())).status).toBe(409)
    h.db.expenses = [placeholder(), target({ deleted_at: '2026-11-01T00:00:00Z' })]
    expect((await call(match())).status).toBe(409)
    h.db.expenses = [placeholder()]
    expect((await call(match(PLACEHOLDER))).status).toBe(409)
    expect(h.writes).toHaveLength(0)
  })

  it("refund_match refuses another user's rows", async () => {
    h.caller.mockResolvedValue({ userId: 'u2', deviceId: 'd1' })
    expect((await call(match())).status).toBe(409)
    h.caller.mockResolvedValue({ userId: 'u1', deviceId: 'd1' })
    h.db.expenses = [placeholder(), target({ user_id: 'u2' })]
    expect((await call(match())).status).toBe(409)
    expect(h.writes).toHaveLength(0)
  })

  it('refund_match refuses a row that does not carry the flag', async () => {
    h.db.expenses = [{ ...placeholder(), sms_flags: [] }, target()]
    expect((await call(match())).status).toBe(409)
    expect(h.writes).toHaveLength(0)
  })

  it('own_cash retracts the income with the marker and books a Transfer from cash to the deposit account (I4)', async () => {
    const res = await call({ action: 'own_cash', incomeId: INCOME })
    expect(res.status).toBe(200)
    expect(h.db.income_events[0]).toMatchObject({ deleted_at: expect.any(String), retracted_by_sms_log_id: LOG })
    expect(h.writes.find((w) => w.table === 'income_events')?.values).toMatchObject({ deleted_at: expect.any(String), retracted_by_sms_log_id: LOG })
    const insert = h.writes.find((w) => w.table === 'expenses' && w.op === 'insert')
    expect(insert?.values).toMatchObject({
      user_id: 'u1', amount: 900, currency: 'EGP', expense_date: '2026-11-09', occurred_at: '2026-11-09T10:00:00Z', sms_log_id: LOG,
      description: 'Cash deposit', category: 'Transfer', payment_method_id: 'cash-1', to_payment_method_id: 'bank-1',
    })
    expect(h.db.sms_parse_log[0]).toMatchObject({ expense_id: 'new-expense', income_id: null, kind: 'own_transfer' })
    expect(h.writes.every((w) => !('edited_at' in w.values))).toBe(true)
  })

  it('own_cash books the transfer with no source account when the user has no cash account', async () => {
    h.db.payment_methods = []
    expect((await call({ action: 'own_cash', incomeId: INCOME })).status).toBe(200)
    expect(h.writes.find((w) => w.op === 'insert')?.values.payment_method_id).toBeNull()
  })

  it('own_cash restores the income when the insert fails and answers 500', async () => {
    h.failInsert = true
    expect((await call({ action: 'own_cash', incomeId: INCOME })).status).toBe(500)
    expect(h.db.income_events[0].deleted_at).toBeNull()
    expect(h.db.income_events[0].retracted_by_sms_log_id).toBeNull()
    expect(h.db.sms_parse_log[0].kind).toBe('income')
  })

  it("own_cash refuses another user's income and one without the flag", async () => {
    h.caller.mockResolvedValue({ userId: 'u2', deviceId: 'd1' })
    expect((await call({ action: 'own_cash', incomeId: INCOME })).status).toBe(409)
    h.caller.mockResolvedValue({ userId: 'u1', deviceId: 'd1' })
    h.db.income_events = [income({ sms_flags: [] })]
    expect((await call({ action: 'own_cash', incomeId: INCOME })).status).toBe(409)
    expect(h.writes).toHaveLength(0)
  })
})
