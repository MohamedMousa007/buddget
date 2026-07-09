import { describe, it, expect } from 'vitest'
import { matchOriginalExpense, findRefundedTwin, type SmsRowData } from './createSmsExpense'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Minimal chainable Supabase stub: every filter returns `this`; awaiting resolves `result`. */
function stub(tables: { payment_methods?: { id: string } | null; expenses?: unknown[] }): SupabaseClient {
  const builder = (result: unknown) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'not', 'gte', 'lte', 'order', 'limit']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: result })
    b.then = (res: (v: unknown) => unknown) => res({ data: result })
    return b
  }
  return {
    from: (table: string) =>
      table === 'payment_methods' ? builder(tables.payment_methods ?? null) : builder(tables.expenses ?? []),
  } as unknown as SupabaseClient
}

const row = (over: Partial<SmsRowData> = {}): SmsRowData =>
  ({
    userId: 'u1', amount: 100, currency: 'EGP', day: '2026-07-08', kind: 'refund',
    cleanTitle: null, merchantNormalized: null, merchant: null, bankName: null,
    categoryHint: null, source: 'sms', rawBody: '', last4: null, ...over,
  }) as SmsRowData

describe('matchOriginalExpense', () => {
  it('returns null when no candidate expense exists', async () => {
    const res = await matchOriginalExpense(stub({ expenses: [] }), row())
    expect(res).toBeNull()
  })

  it('returns the single candidate (rows arrive most-recent-first)', async () => {
    const res = await matchOriginalExpense(
      stub({ expenses: [{ id: 'e1', category: 'Food', description: 'Carrefour' }] }),
      row(),
    )
    expect(res).toEqual({ id: 'e1', category: 'Food' })
  })

  it('prefers the candidate whose description matches the counterparty', async () => {
    const res = await matchOriginalExpense(
      stub({
        expenses: [
          { id: 'recent', category: 'Other', description: 'Uber' },
          { id: 'match', category: 'Groceries', description: 'Spinneys Maadi' },
        ],
      }),
      row({ merchant: 'Spinneys' }),
    )
    expect(res?.id).toBe('match')
  })

  it('resolves last4 to a payment method without throwing', async () => {
    const res = await matchOriginalExpense(
      stub({ payment_methods: { id: 'pm1' }, expenses: [{ id: 'e9', category: 'Food', description: 'x' }] }),
      row({ last4: '1234' }),
    )
    expect(res?.id).toBe('e9')
  })
})

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
