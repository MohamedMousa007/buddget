import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const h = vi.hoisted(() => ({
  caller: vi.fn(),
  nudge: vi.fn(),
  db: {} as Record<string, Row[]>,
  writes: [] as { table: string; op: string; values: Row }[],
  failInsert: false,
  raceRetract: false,
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
        update: (v: Row) => {
          mode = 'update'
          values = v
          if (h.raceRetract && table === 'expenses' && 'retracted_by_sms_log_id' in v) {
            h.raceRetract = false
            matching().forEach((r) => Object.assign(r, { deleted_at: '2026-11-09T11:00:00Z', retracted_by_sms_log_id: LOG }))
          }
          return q
        },
        insert: (v: Row) => ((mode = 'insert'), (values = v), q),
        maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
        single: async () => {
          if (h.failInsert) return { data: null, error: { message: 'boom' } }
          h.writes.push({ table, op: 'insert', values })
          return { data: { id: 'new-income' }, error: null }
        },
        then: (resolve: (v: unknown) => void) => {
          let hit: Row[] = mode === 'select' ? matching() : []
          if (mode === 'update') {
            h.writes.push({ table, op: 'update', values })
            hit = matching()
            hit.forEach((r) => Object.assign(r, values))
          }
          resolve({ data: hit, error: null })
        },
      }
      return q
    },
  }),
}))

import { POST } from './route'

const PLACEHOLDER = '11111111-1111-4111-8111-111111111111'
const TARGET = '22222222-2222-4222-8222-222222222222'
const DEPOSIT = '33333333-3333-4333-8333-333333333333'
const LOG = '44444444-4444-4444-8444-444444444444'
const call = (body: unknown) => POST(new Request('http://x/api/sms/flag-action', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) }))
const row = (id: string) => (h.db.expenses ?? []).find((r) => r.id === id)!

const placeholder = (): Row => ({ id: PLACEHOLDER, user_id: 'u1', amount: 250, currency: 'EGP', sms_log_id: LOG, refund_kind: 'refunded', refunded_at: '2026-11-10T09:00:00Z', sms_flags: ['refund_unmatched'], deleted_at: null })
const target = (extra: Row = {}): Row => ({ id: TARGET, user_id: 'u1', amount: 250, currency: 'EGP', sms_log_id: null, refund_kind: null, refunded_at: null, sms_flags: null, deleted_at: null, ...extra })
const deposit = (extra: Row = {}): Row => ({ id: DEPOSIT, user_id: 'u1', amount: 900, currency: 'EGP', expense_date: '2026-11-09', occurred_at: '2026-11-09T10:00:00Z', sms_log_id: LOG, category: 'Transfer', payment_method_id: 'cash-1', to_payment_method_id: 'bank-1', sms_flags: ['cash_deposit'], deleted_at: null, retracted_by_sms_log_id: null, ...extra })
const match = (targetExpenseId = TARGET) => ({ action: 'refund_match', expenseId: PLACEHOLDER, targetExpenseId })

describe('POST /api/sms/flag-action', () => {
  beforeEach(() => {
    h.caller.mockReset().mockResolvedValue({ userId: 'u1', deviceId: 'd1' })
    h.nudge.mockReset().mockResolvedValue(true)
    h.writes.length = 0
    h.failInsert = false
    h.raceRetract = false
    h.db = {
      expenses: [placeholder(), target(), deposit()],
      income_events: [],
      sms_parse_log: [{ id: LOG, user_id: 'u1', expense_id: PLACEHOLDER, income_id: null, kind: 'income' }],
    }
  })

  it('rejects an unauthenticated caller and a malformed body', async () => {
    h.caller.mockResolvedValue({ userId: null, deviceId: null })
    expect((await call(match())).status).toBe(401)
    h.caller.mockResolvedValue({ userId: 'u1', deviceId: 'd1' })
    expect((await call({ action: 'nope' })).status).toBe(400)
  })

  it('refund_match stamps the purchase, retires the placeholder with its message as the marker and repoints the log (I1, I4)', async () => {
    const res = await call(match())
    expect(res.status).toBe(200)
    expect(row(TARGET)).toMatchObject({ refunded_at: '2026-11-10T09:00:00Z', refund_kind: 'refunded', refund_sms_log_id: LOG })
    expect(row(PLACEHOLDER).deleted_at).toEqual(expect.any(String))
    expect(row(PLACEHOLDER).retracted_by_sms_log_id).toBe(LOG)
    expect(h.db.sms_parse_log[0].expense_id).toBe(TARGET)
    expect(h.writes.every((w) => !('edited_at' in w.values))).toBe(true)
  })

  it('I1, I8: refund_match on a larger purchase stamps it in part, with no refunded_at or refund_kind', async () => {
    h.db.expenses = [placeholder(), target({ amount: 900 })]
    expect((await call(match())).status).toBe(200)
    expect(row(TARGET)).toMatchObject({ refunded_amount: 250, refund_sms_log_id: LOG, refunded_at: null, refund_kind: null })
    expect(row(PLACEHOLDER)).toMatchObject({ deleted_at: expect.any(String), retracted_by_sms_log_id: LOG })
    expect(h.db.sms_parse_log[0].expense_id).toBe(TARGET)
  })

  it('I1: refund_match refuses a larger purchase that already carries a partial refund', async () => {
    h.db.expenses = [placeholder(), target({ amount: 900, refunded_amount: 100 })]
    expect((await call(match())).status).toBe(409)
    expect(h.writes).toHaveLength(0)
  })

  it('refund_match refuses a purchase of a smaller amount or another currency (I1)', async () => {
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

  it('deposit_income retracts the transfer with the marker and books income on the deposit account', async () => {
    const res = await call({ action: 'deposit_income', expenseId: DEPOSIT })
    expect(res.status).toBe(200)
    expect(row(DEPOSIT)).toMatchObject({ deleted_at: expect.any(String), retracted_by_sms_log_id: LOG })
    const insert = h.writes.find((w) => w.table === 'income_events' && w.op === 'insert')
    expect(insert?.values).toEqual({
      user_id: 'u1', template_id: null, name: 'Cash deposit', amount: 900, currency: 'EGP', source_type: 'other', received_date: '2026-11-09',
      occurrence_date: null, status: 'confirmed', sms_log_id: LOG, payment_method_id: 'bank-1', occurred_at: '2026-11-09T10:00:00Z', notes: null,
    })
    expect(h.db.sms_parse_log[0]).toMatchObject({ income_id: 'new-income', expense_id: null, kind: 'income' })
    expect(h.writes.every((w) => !('edited_at' in w.values))).toBe(true)
  })

  it('deposit_income restores the transfer when the insert fails and answers 500', async () => {
    h.failInsert = true
    expect((await call({ action: 'deposit_income', expenseId: DEPOSIT })).status).toBe(500)
    expect(row(DEPOSIT).deleted_at).toBeNull()
    expect(row(DEPOSIT).retracted_by_sms_log_id).toBeNull()
    expect(h.db.sms_parse_log[0].income_id).toBeNull()
  })

  it('deposit_income answers 409 and inserts nothing when another call retracted the row first', async () => {
    h.raceRetract = true
    expect((await call({ action: 'deposit_income', expenseId: DEPOSIT })).status).toBe(409)
    expect(h.writes.some((w) => w.op === 'insert')).toBe(false)
    expect(h.db.sms_parse_log[0]).toMatchObject({ income_id: null, expense_id: PLACEHOLDER, kind: 'income' })
  })

  it("deposit_income refuses another user's row, a row without the flag and a row that is not a Transfer", async () => {
    h.caller.mockResolvedValue({ userId: 'u2', deviceId: 'd1' })
    expect((await call({ action: 'deposit_income', expenseId: DEPOSIT })).status).toBe(409)
    h.caller.mockResolvedValue({ userId: 'u1', deviceId: 'd1' })
    h.db.expenses = [deposit({ sms_flags: [] })]
    expect((await call({ action: 'deposit_income', expenseId: DEPOSIT })).status).toBe(409)
    h.db.expenses = [deposit({ category: 'Food' })]
    expect((await call({ action: 'deposit_income', expenseId: DEPOSIT })).status).toBe(409)
    expect(h.writes).toHaveLength(0)
  })
  describe('wallet_unregistered, wallet_own (I4, I8)', () => {
    const INCOME = '55555555-5555-4555-8555-555555555555'
    const credit = (extra: Row = {}): Row => ({ id: INCOME, user_id: 'u1', amount: 300, currency: 'EGP', received_date: '2026-11-09', occurred_at: '2026-11-09T10:00:00Z', sms_log_id: LOG, payment_method_id: 'wallet-1', sms_flags: ['wallet_unregistered'], deleted_at: null, retracted_by_sms_log_id: null, ...extra })
    const own = () => call({ action: 'wallet_own', incomeId: INCOME })

    it('retracts the income with its own message as the marker and books one Transfer into the wallet', async () => {
      h.db.income_events = [credit()]
      expect((await own()).status).toBe(200)
      expect(h.db.income_events[0]).toMatchObject({ deleted_at: expect.any(String), retracted_by_sms_log_id: LOG })
      const insert = h.writes.find((w) => w.table === 'expenses' && w.op === 'insert')
      expect(insert?.values).toMatchObject({
        user_id: 'u1', description: 'Wallet top-up', category: 'Transfer', amount: 300, currency: 'EGP', expense_date: '2026-11-09',
        occurred_at: '2026-11-09T10:00:00Z', sms_log_id: LOG, to_payment_method_id: 'wallet-1', payment_method_id: null,
      })
      expect(h.db.sms_parse_log[0]).toMatchObject({ expense_id: 'new-income', income_id: null })
      expect(h.writes.every((w) => !('edited_at' in w.values))).toBe(true)
    })

    it('restores the income when the insert fails and answers 500', async () => {
      h.db.income_events = [credit()]
      h.failInsert = true
      expect((await own()).status).toBe(500)
      expect(h.db.income_events[0]).toMatchObject({ deleted_at: null, retracted_by_sms_log_id: null })
    })

    it('refuses a row without the flag, another user and a deleted row', async () => {
      h.db.income_events = [credit({ sms_flags: [] })]
      expect((await own()).status).toBe(409)
      h.db.income_events = [credit({ user_id: 'u2' })]
      expect((await own()).status).toBe(409)
      h.db.income_events = [credit({ deleted_at: '2026-11-10T00:00:00Z' })]
      expect((await own()).status).toBe(409)
      expect(h.writes).toHaveLength(0)
    })
  })

  describe('topup_repaired, topup_undo (I4, I8)', () => {
    const REPAIRED = '66666666-6666-4666-8666-666666666666'
    const CREDIT = '77777777-7777-4777-8777-777777777777'
    const CREDIT_LOG = '88888888-8888-4888-8888-888888888888'
    const repaired = (extra: Row = {}): Row => ({ id: REPAIRED, user_id: 'u1', category: 'Transfer', to_payment_method_id: 'wallet-1', sms_log_id: LOG, sms_flags: ['topup_repaired', 'topup_prev:Utilities'], deleted_at: null, ...extra })
    const retracted = (): Row => ({ id: CREDIT, user_id: 'u1', sms_log_id: CREDIT_LOG, deleted_at: '2026-11-09T11:00:00Z', retracted_by_sms_log_id: LOG })
    const undo = () => call({ action: 'topup_undo', expenseId: REPAIRED })
    const logs = (): Row[] => [
      { id: LOG, user_id: 'u1', paired_log_id: CREDIT_LOG, status: 'confirmed', expense_id: REPAIRED, income_id: null },
      { id: CREDIT_LOG, user_id: 'u1', paired_log_id: LOG, status: 'paired', expense_id: null, income_id: null },
    ]

    it('puts the category back, clears the destination and both flag entries, restores the retracted income and unpairs the logs', async () => {
      h.db.expenses = [repaired()]
      h.db.income_events = [retracted()]
      h.db.sms_parse_log = logs()
      expect((await undo()).status).toBe(200)
      expect(row(REPAIRED)).toMatchObject({ category: 'Utilities', to_payment_method_id: null, sms_flags: null })
      expect(h.db.income_events[0]).toMatchObject({ deleted_at: null, retracted_by_sms_log_id: null })
      expect(h.db.sms_parse_log[1]).toMatchObject({ status: 'confirmed', income_id: CREDIT, paired_log_id: null })
      expect(h.db.sms_parse_log[0].paired_log_id).toBeNull()
      expect(h.writes.every((w) => !('edited_at' in w.values))).toBe(true)
    })

    it('restores only the row when there is no income leg, and keeps unrelated flag entries', async () => {
      h.db.expenses = [repaired({ sms_flags: ['topup_repaired', 'topup_prev:Food', 'date_unsure'] })]
      h.db.income_events = []
      h.db.sms_parse_log = [{ id: LOG, user_id: 'u1', paired_log_id: null }]
      expect((await undo()).status).toBe(200)
      expect(row(REPAIRED)).toMatchObject({ category: 'Food', to_payment_method_id: null, sms_flags: ['date_unsure'] })
    })

    it('does not restore an income the user deleted (no marker for this message)', async () => {
      h.db.expenses = [repaired()]
      h.db.income_events = [{ ...retracted(), retracted_by_sms_log_id: null }]
      h.db.sms_parse_log = logs()
      expect((await undo()).status).toBe(200)
      expect(h.db.income_events[0].deleted_at).toEqual(expect.any(String))
    })

    it('answers 409 and writes nothing without the flag, and on a second call', async () => {
      h.db.expenses = [repaired({ sms_flags: [] })]
      expect((await undo()).status).toBe(409)
      h.db.expenses = [repaired()]
      h.db.income_events = []
      h.db.sms_parse_log = [{ id: LOG, user_id: 'u1', paired_log_id: null }]
      expect((await undo()).status).toBe(200)
      h.writes.length = 0
      expect((await undo()).status).toBe(409)
      expect(h.writes).toHaveLength(0)
    })

    it('falls back to Other when topup_prev is not a valid category', async () => {
      h.db.expenses = [repaired({ sms_flags: ['topup_repaired', 'topup_prev:Not A Category'] })]
      h.db.income_events = []
      h.db.sms_parse_log = [{ id: LOG, user_id: 'u1', paired_log_id: null }]
      expect((await undo()).status).toBe(200)
      expect(row(REPAIRED).category).toBe('Other')
    })
  })
})
