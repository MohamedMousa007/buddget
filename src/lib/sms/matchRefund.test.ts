import { describe, it, expect } from 'vitest'
import { findRefundedTwin, type SmsRowData } from './createSmsExpense'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Minimal chainable Supabase stub: every filter returns `this`; awaiting resolves `result`. */
function stub(tables: { payment_methods?: { id: string; name: string; last4: string }[]; expenses?: unknown[]; sms_parse_log?: unknown[] }): SupabaseClient {
  const builder = (result: unknown) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'not', 'gte', 'lte', 'order', 'limit', 'in']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: result })
    b.then = (res: (v: unknown) => unknown) => res({ data: result })
    return b
  }
  return {
    from: (table: string) =>
      table === 'payment_methods'
        ? builder(tables.payment_methods ?? [])
        : table === 'sms_parse_log'
          ? builder(tables.sms_parse_log ?? [])
          : builder(tables.expenses ?? []),
  } as unknown as SupabaseClient
}

const row = (over: Partial<SmsRowData> = {}): SmsRowData =>
  ({
    userId: 'u1', amount: 100, currency: 'EGP', day: '2026-07-08', kind: 'refund',
    cleanTitle: null, merchantNormalized: null, merchant: null, bankName: null,
    categoryHint: null, source: 'sms', rawBody: '', last4: null, ...over,
  }) as SmsRowData

describe('findRefundedTwin (duplicate-SMS guard)', () => {
  it('returns null when no already-refunded twin exists in the window', async () => {
    expect(await findRefundedTwin(stub({ expenses: [] }), row())).toBeNull()
  })

  const stamped = [{ id: 'already', category: 'Food', sms_log_id: null, refund_sms_log_id: 'r0' }]
  const at = '2026-07-08T10:00:00.000Z'

  it('I1: returns the twin when the message that stamped it arrived within 10 minutes', async () => {
    const logs = [{ id: 'r0', received_at: '2026-07-08T09:55:00.000Z', reference_hash: null }]
    const twin = await findRefundedTwin(stub({ expenses: stamped, sms_parse_log: logs }), row({ receivedAtIso: at }))
    expect(twin).toEqual({ id: 'already', category: 'Food', strict: true })
  })

  it('I1: returns the twin on the same known reference whatever the time', async () => {
    const logs = [{ id: 'r0', received_at: '2026-07-07T09:00:00.000Z', reference_hash: 'h1' }]
    const twin = await findRefundedTwin(stub({ expenses: stamped, sms_parse_log: logs }), row({ receivedAtIso: at, referenceHash: 'h1' }))
    expect(twin).toMatchObject({ id: 'already', strict: true })
  })

  it('I1, I7: a stamp from a day away with another or no reference, or an unstored message, is only a loose twin', async () => {
    const logs = [{ id: 'r0', received_at: '2026-07-07T10:00:00.000Z', reference_hash: 'h1' }]
    expect(await findRefundedTwin(stub({ expenses: stamped, sms_parse_log: logs }), row({ receivedAtIso: at, referenceHash: 'h2' }))).toMatchObject({ id: 'already', strict: false })
    expect(await findRefundedTwin(stub({ expenses: stamped, sms_parse_log: logs }), row({ receivedAtIso: at }))).toMatchObject({ strict: false })
    expect(await findRefundedTwin(stub({ expenses: stamped, sms_parse_log: [] }), row({ receivedAtIso: at, referenceHash: 'h1' }))).toMatchObject({ strict: false })
  })
})
