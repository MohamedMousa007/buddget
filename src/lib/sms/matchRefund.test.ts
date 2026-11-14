import { describe, it, expect } from 'vitest'
import { findRefundedTwin, type SmsRowData } from './createSmsExpense'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Minimal chainable Supabase stub: every filter returns `this`; awaiting resolves `result`. */
function stub(tables: { payment_methods?: { id: string; name: string; last4: string }[]; expenses?: unknown[] }): SupabaseClient {
  const builder = (result: unknown) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'not', 'gte', 'lte', 'order', 'limit']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: result })
    b.then = (res: (v: unknown) => unknown) => res({ data: result })
    return b
  }
  return {
    from: (table: string) =>
      table === 'payment_methods' ? builder(tables.payment_methods ?? []) : builder(tables.expenses ?? []),
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

  it('returns the already-refunded twin so the duplicate SMS acks without re-reversing', async () => {
    const twin = await findRefundedTwin(
      stub({ expenses: [{ id: 'already', category: 'Food' }] }),
      row(),
    )
    expect(twin).toEqual({ id: 'already', category: 'Food' })
  })
})
