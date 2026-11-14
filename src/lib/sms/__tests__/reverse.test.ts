import { describe, expect, it } from 'vitest'
import { unpairOwnTransfer, type UnpairIncomeRow } from '../reverse'
import type { ServiceClient } from '@/lib/supabase/service'

type Row = Record<string, unknown>
const OUT = '11111111-1111-4111-8111-111111111111'
const IN = '22222222-2222-4222-8222-222222222222'
const OTHER = '33333333-3333-4333-8333-333333333333'

function fakeService(db: Record<string, Row[]>) {
  const writes: { table: string; op: string; values: Row }[] = []
  const service = {
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = []
      let mode: 'update' | 'insert' = 'update'
      let values: Row = {}
      const q: Record<string, unknown> = {
        update: (v: Row) => ((mode = 'update'), (values = v), q),
        insert: (v: Row) => ((mode = 'insert'), (values = v), q),
        eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
        select: () => q,
        single: async () => (writes.push({ table, op: 'insert', values }), { data: { id: 'new-income' }, error: null }),
        then: (resolve: (v: unknown) => void) => {
          if (mode === 'update') {
            writes.push({ table, op: 'update', values })
            ;(db[table] ?? []).filter((r) => filters.every((f) => f(r))).forEach((r) => Object.assign(r, values))
          }
          resolve({ error: null })
        },
      }
      return q
    },
  } as unknown as ServiceClient
  return { service, writes }
}

const leg = (id: string) => ({ id, amount: 500, currency: 'EGP', received_at: '2026-11-01T10:00:00Z', raw_body: 'x' })
const input = (incomes: UnpairIncomeRow[]) => ({ userId: 'u1', out: leg(OUT), inn: leg(IN), expenseId: 'e1', incomes })

describe('unpairOwnTransfer', () => {
  it('restores an income retracted by this pair, clears its marker and relinks the log', async () => {
    const db = {
      expenses: [{ id: 'e1', user_id: 'u1', category: 'Transfer' }],
      income_events: [{ id: 'i1', user_id: 'u1', deleted_at: 'x', retracted_by_sms_log_id: OUT }],
      sms_parse_log: [{ id: IN, income_id: null }],
    }
    const { service } = fakeService(db)
    expect(await unpairOwnTransfer(service, input([{ id: 'i1', deleted_at: 'x', retracted_by_sms_log_id: OUT }]))).toBeNull()
    expect(db.expenses[0].category).not.toBe('Transfer')
    expect(db.income_events[0]).toMatchObject({ deleted_at: null, retracted_by_sms_log_id: null })
    expect(db.sms_parse_log[0].income_id).toBe('i1')
  })

  it('leaves an income the user deleted (no marker) and one retracted by another message', async () => {
    for (const marker of [null, OTHER]) {
      const db = { expenses: [{ id: 'e1', user_id: 'u1', category: 'Transfer' }], income_events: [{ id: 'i1', user_id: 'u1', deleted_at: 'x', retracted_by_sms_log_id: marker }] }
      const { service, writes } = fakeService(db)
      await unpairOwnTransfer(service, input([{ id: 'i1', deleted_at: 'x', retracted_by_sms_log_id: marker }]))
      expect(db.income_events[0].deleted_at).toBe('x')
      expect(writes.some((w) => w.table === 'income_events')).toBe(false)
    }
  })

  it('creates the in leg income when the pair has none', async () => {
    const { service, writes } = fakeService({ expenses: [{ id: 'e1', user_id: 'u1' }] })
    await unpairOwnTransfer(service, input([]))
    expect(writes.find((w) => w.table === 'income_events' && w.op === 'insert')?.values).toMatchObject({ sms_log_id: IN, amount: 500, received_date: '2026-11-01' })
  })
})
