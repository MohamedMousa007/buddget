import { describe, expect, it } from 'vitest'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { emptySnapshot, type Snapshot } from '@/lib/supabase/remote/snapshot'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import type { Debt } from '@/lib/store/types'

const CARD = '00000000-0000-4000-8000-0000000000c1'
const plan = (over: Partial<Debt> = {}): Debt =>
  ({
    id: '00000000-0000-4000-8000-0000000000d1', name: 'Laptop', debtType: 'installment', direction: 'i_owe', currency: 'EGP',
    startingBalance: 12_000, status: 'active', createdAt: '2026-11-26T06:18:27.071Z', installmentCount: 12, installmentAmount: 1000,
    installmentFrequency: 'monthly', installmentProvider: 'other', ...over,
  }) as Debt

async function debtWrites(prev: Debt[], next: Debt[]) {
  const writes: Record<string, unknown>[] = []
  const client = {
    from: (table: string) => ({
      upsert: (rows: Record<string, unknown>[]) => {
        if (table === 'debts') writes.push(...rows)
        return Promise.resolve({ error: null, count: rows.length })
      },
      update: () => ({ in: () => Promise.resolve({ error: null }) }),
    }),
  }
  const res = await flushDiff(client as never, 'u1', { ...emptySnapshot(), debts: prev } as Snapshot, { ...emptySnapshot(), debts: next } as Snapshot)
  expect(res.anyError).toBe(false)
  return writes
}

describe('an installment plan\'s default card reaches the server (debts.default_payment_method_id, 0350)', () => {
  it('a new plan sends it', async () => {
    const [row] = await debtWrites([], [plan({ defaultPaymentMethodId: CARD })])
    expect(row.default_payment_method_id).toBe(CARD)
  })

  it('picking it on an existing plan sends it, and clearing it sends null', async () => {
    const [picked] = await debtWrites([plan()], [plan({ defaultPaymentMethodId: CARD, updatedAt: '2026-11-26T06:20:05.710Z' })])
    expect(picked.default_payment_method_id).toBe(CARD)
    const [cleared] = await debtWrites([plan({ defaultPaymentMethodId: CARD })], [plan({ updatedAt: '2026-11-26T06:21:00.000Z' })])
    expect(cleared.default_payment_method_id).toBeNull()
  })

  it('the built-in Cash placeholder is never sent (it is not a server row)', async () => {
    const [row] = await debtWrites([], [plan({ defaultPaymentMethodId: DEFAULT_CASH_ID })])
    expect(row.default_payment_method_id).toBeNull()
  })
})
