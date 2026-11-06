import { describe, expect, it } from 'vitest'
import { flushDiff } from '@/lib/supabase/remote/sync'
import { holdParkedBack } from '@/lib/supabase/remote/parkedRows'
import { emptySnapshot, type Snapshot } from '@/lib/supabase/remote/snapshot'
import type { Expense } from '@/lib/store/types'

const exp = (id: string, amount: number): Expense => ({
  id, date: '2026-10-10', description: 'x', category: 'Food', amount, currency: 'EGP', amountInBaseCurrency: amount,
  paymentMethodId: '', isRecurring: false, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
})
const snap = (...e: Expense[]): Snapshot => ({ ...emptySnapshot(), expenses: e })

function server(code: string, poison: (r: { amount: number }) => boolean) {
  const saved: string[] = []
  let requests = 0
  const client = {
    from: () => ({
      upsert: (rows: Array<{ id: string; amount: number }>) => {
        requests++
        if (rows.some(poison)) return Promise.resolve({ error: { code, message: 'rejected' }, count: null })
        saved.push(...rows.map((r) => r.id))
        return Promise.resolve({ error: null, count: rows.length })
      },
      update: () => ({ in: () => Promise.resolve({ error: null }) }),
    }),
  }
  return { client, saved, requests: () => requests }
}

describe('OFS-3: one poison row does not block its table', () => {
  it.each(['22003', '22001', '22P02', '22007', '23502', '42501'])('a %s row is set aside, the others are written', async (code) => {
    const s = server(code, (r) => r.amount > 1e12)
    const res = await flushDiff(s.client as never, 'u', emptySnapshot(), snap(exp('g1', 5), exp('g2', 6), exp('bad', 1e15), exp('g3', 7)))
    expect(s.saved.sort()).toEqual(['g1', 'g2', 'g3'])
    expect(res.anyError).toBe(false)
    expect(res.parked).toEqual([{ table: 'expenses', id: 'bad', rootId: 'bad', code }])
  })

  it('isolates the row by splitting, not by one request per row', async () => {
    const s = server('22003', (r) => r.amount > 1e12)
    const rows = Array.from({ length: 200 }, (_, i) => exp(`r${i}`, i === 117 ? 1e15 : 1))
    const res = await flushDiff(s.client as never, 'u', emptySnapshot(), snap(...rows))
    expect(s.saved).toHaveLength(199)
    expect(res.parked).toHaveLength(1)
    expect(s.requests()).toBeLessThan(40)
  })

  it('a network-style failure is still a table failure, not a parked row', async () => {
    const s = server('PGRST301', () => true)
    const res = await flushDiff(s.client as never, 'u', emptySnapshot(), snap(exp('a', 1)))
    expect(res.anyError).toBe(true)
    expect(res.parked).toEqual([])
  })

  it('the baseline advances for the rest and keeps the parked row unsent', () => {
    const prev = snap(exp('old', 1))
    const next = snap(exp('old', 1), exp('ok', 2), exp('bad', 3))
    const held = holdParkedBack(next, prev, [{ table: 'expenses', id: 'bad', rootId: 'bad', code: '22003' }])
    expect(held.expenses.map((e) => e.id)).toEqual(['old', 'ok'])
    const editedPrev = snap(exp('bad', 1))
    const heldEdit = holdParkedBack(snap(exp('bad', 9)), editedPrev, [{ table: 'expenses', id: 'bad', rootId: 'bad', code: '22003' }])
    expect(heldEdit.expenses[0].amount).toBe(1)
  })
})
