import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { applyDelta, emptySnapshot, flushDiff, pullDelta, type Snapshot } from '@/lib/supabase/remote'
import type { Expense, IncomeEvent } from '@/lib/store/types'
import { liveClient, PUBLISHABLE_KEY, SUPABASE_URL } from '../liveClient'

/** S8b round 2: adversarial sync against the live project, one synthetic user (QA_SYNC_EMAIL_3, qa-e2e-*). */
const EMAIL = process.env.QA_SYNC_EMAIL_3 ?? ''
const iso = (ms = 0) => new Date(Date.now() + ms).toISOString()
const pm = (name: string) => { const n = iso(-600_000); return { id: randomUUID(), name, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: n, updatedAt: n } }
function expense(over: Partial<Expense> = {}): Expense {
  const now = iso(-60_000)
  return { id: randomUUID(), date: now.slice(0, 10), description: 'QA r2', category: 'Food', amount: 100, currency: 'EGP', amountInBaseCurrency: 100, paymentMethodId: 'pm_default_cash', isRecurring: false, createdAt: now, updatedAt: now, ...over } as unknown as Expense
}
const count = async (c: Awaited<ReturnType<typeof liveClient>>['client'], id: string) =>
  (await c.from('expenses').select('id, deleted_at').eq('id', id)).data ?? []

describe('round 2 sync (live)', () => {
  it('guard: runs only as a qa-e2e synthetic user', () => {
    expect(EMAIL).toMatch(/^qa-e2e-.*@buddget-qa\.test$/)
  })

  it('same insert from two devices at once and five parallel flushes: exactly one row, no errors', async () => {
    const A = await liveClient(EMAIL); const B = await liveClient(EMAIL)
    const e = expense(); const s1: Snapshot = { ...emptySnapshot(), expenses: [e] }
    const rs = await Promise.all([A, B, A, B, A].map((d) => flushDiff(d.client, d.userId, emptySnapshot(), s1)))
    expect(rs.flatMap((r) => r.errors)).toEqual([])
    expect(rs.flatMap((r) => r.parked ?? [])).toEqual([])
    expect(await count(A.client, e.id)).toHaveLength(1)
  })

  it('interrupted save: failed flush keeps the diff, the retry lands it once', async () => {
    const A = await liveClient(EMAIL)
    const dead = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false }, global: { fetch: () => Promise.reject(new TypeError('offline')) } })
    const e = expense(); const s1: Snapshot = { ...emptySnapshot(), expenses: [e] }
    const bad = await flushDiff(dead, A.userId, emptySnapshot(), s1).catch((x) => ({ anyError: true, errors: [String(x)] }))
    expect(bad.anyError).toBe(true)
    expect(await count(A.client, e.id)).toHaveLength(0)
    expect((await flushDiff(A.client, A.userId, emptySnapshot(), s1)).errors).toEqual([])
    expect((await flushDiff(A.client, A.userId, emptySnapshot(), s1)).errors).toEqual([])
    expect(await count(A.client, e.id)).toHaveLength(1)
  })

  it('internal transfer keeps both legs, round-trips through a pull, and creates no income row', async () => {
    const A = await liveClient(EMAIL); const B = await liveClient(EMAIL)
    const from = pm('QA from'); const to = pm('QA to')
    const base: Snapshot = { ...emptySnapshot(), paymentMethods: [from, to] } as unknown as Snapshot
    expect((await flushDiff(A.client, A.userId, emptySnapshot(), base)).errors).toEqual([])
    const t = expense({ description: 'QA own transfer', category: 'Transfer', paymentMethodId: from.id, toPaymentMethodId: to.id, amount: 250 })
    const s2: Snapshot = { ...base, expenses: [t] }
    const before = (await A.client.from('income_events').select('id', { count: 'exact', head: true })).count
    expect((await flushDiff(A.client, A.userId, base, s2)).errors).toEqual([])
    const row = (await A.client.from('expenses').select('payment_method_id,to_payment_method_id,amount').eq('id', t.id)).data
    expect(row).toEqual([{ payment_method_id: from.id, to_payment_method_id: to.id, amount: 250 }])
    expect((await A.client.from('income_events').select('id', { count: 'exact', head: true })).count).toBe(before)
    const d = (await pullDelta(B.client, null))!
    const got = applyDelta(emptySnapshot(), d, emptySnapshot()).expenses.find((x) => x.id === t.id)
    expect(got?.toPaymentMethodId).toBe(to.id)
    expect(got?.paymentMethodId).toBe(from.id)
  })

  it('month boundary in Africa/Cairo: late-evening UTC instant keeps its Cairo day key and instant', async () => {
    const A = await liveClient(EMAIL); const B = await liveClient(EMAIL)
    const e = expense({ date: '2026-11-01', occurredAt: '2026-10-31T22:30:00.000Z', description: 'QA boundary' })
    expect((await flushDiff(A.client, A.userId, emptySnapshot(), { ...emptySnapshot(), expenses: [e] })).errors).toEqual([])
    const r = (await A.client.from('expenses').select('expense_date,occurred_at').eq('id', e.id)).data![0]
    expect(r.expense_date).toBe('2026-11-01')
    expect(new Date(r.occurred_at as string).toISOString()).toBe('2026-10-31T22:30:00.000Z')
    const got = applyDelta(emptySnapshot(), (await pullDelta(B.client, null))!, emptySnapshot()).expenses.find((x) => x.id === e.id)
    expect(got?.date).toBe('2026-11-01')
  })

  it('money precision round-trips (1234.56, 0.01) and a 2-dec sum stays exact', async () => {
    const A = await liveClient(EMAIL)
    const a = expense({ amount: 1234.56 }); const b = expense({ amount: 0.01 })
    await flushDiff(A.client, A.userId, emptySnapshot(), { ...emptySnapshot(), expenses: [a, b] })
    const rows = (await A.client.from('expenses').select('id,amount').in('id', [a.id, b.id])).data!
    expect(rows.map((r) => Number(r.amount)).sort()).toEqual([0.01, 1234.56])
  })

  it('delete on A propagates to B via delta (no resurrection after B flushes unrelated edit)', async () => {
    const A = await liveClient(EMAIL); const B = await liveClient(EMAIL)
    const e = expense(); const other = expense({ description: 'other' })
    const s1: Snapshot = { ...emptySnapshot(), expenses: [e, other] }
    await flushDiff(A.client, A.userId, emptySnapshot(), s1)
    const cursor = (await pullDelta(B.client, null))!.cursor
    await flushDiff(A.client, A.userId, s1, { ...s1, expenses: [other] })
    const d = (await pullDelta(B.client, cursor))!
    expect(d.expenses.deletedIds).toContain(e.id)
    const merged = applyDelta(s1, d, s1)
    expect(merged.expenses.map((x) => x.id)).not.toContain(e.id)
    expect(merged.expenses.map((x) => x.id)).toContain(other.id)
    // B flushes an unrelated edit from the merged state: the deleted row must stay deleted.
    expect((await flushDiff(B.client, B.userId, merged, { ...merged, expenses: merged.expenses.map((x) => (x.id === other.id ? { ...x, amount: 5, updatedAt: iso(500) } : x)) })).errors).toEqual([])
    expect((await count(A.client, e.id))[0]?.deleted_at).not.toBeNull()
  })

  it('B deletes offline with an older stamp than A\'s later edit: edit wins or delete wins, never duplicated', async () => {
    const A = await liveClient(EMAIL); const B = await liveClient(EMAIL)
    const e = expense({ createdAt: iso(-300_000), updatedAt: iso(-300_000) }); const s1: Snapshot = { ...emptySnapshot(), expenses: [e] }
    await flushDiff(A.client, A.userId, emptySnapshot(), s1)
    await flushDiff(A.client, A.userId, s1, { ...s1, expenses: [{ ...e, amount: 777, updatedAt: iso(-30_000) }] })
    await flushDiff(B.client, B.userId, s1, { ...s1, expenses: [] }) // B's delete is stamped now (later), so delete wins
    const rows = await count(A.client, e.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].deleted_at).not.toBeNull()
  })
  it('D-9: an offline edit that reaches a deleted row leaves it deleted with its content unchanged, and the device converges', async () => {
    const A = await liveClient(EMAIL); const B = await liveClient(EMAIL)
    const e = expense({ amount: 120 }); const s1: Snapshot = { ...emptySnapshot(), expenses: [e] }
    await flushDiff(A.client, A.userId, emptySnapshot(), s1)
    await flushDiff(A.client, A.userId, s1, { ...s1, expenses: [] })
    const r = await flushDiff(B.client, B.userId, s1, { ...s1, expenses: [{ ...e, amount: 999, updatedAt: iso(1000) }] })
    expect(r.errors).toEqual([])
    expect(r.skippedWrites, 'the skip is reported so the app re-pulls').toBe(1)
    const row = (await A.client.from('expenses').select('amount, deleted_at').eq('id', e.id).single()).data!
    expect(row.deleted_at).not.toBeNull()
    expect(Number(row.amount)).toBe(120)
  })

  it('D-5: a delete stamped in the server\'s future (device clock ahead) is still undone by the Undo that follows', async () => {
    const A = await liveClient(EMAIL)
    const e = expense(); const s1: Snapshot = { ...emptySnapshot(), expenses: [e] }
    await flushDiff(A.client, A.userId, emptySnapshot(), s1)
    await A.client.from('expenses').update({ deleted_at: iso(90_000) }).eq('id', e.id)
    const r = await flushDiff(A.client, A.userId, { ...s1, expenses: [] }, { ...s1, expenses: [{ ...e, updatedAt: iso(0) }] })
    expect(r.errors).toEqual([])
    expect((await count(A.client, e.id))[0]?.deleted_at, 'undo brought the row back').toBeNull()
  })

  it('D-9: a re-sent tombstone does not move the delete time', async () => {
    const A = await liveClient(EMAIL)
    const e = expense(); const s1: Snapshot = { ...emptySnapshot(), expenses: [e] }
    await flushDiff(A.client, A.userId, emptySnapshot(), s1)
    await flushDiff(A.client, A.userId, s1, { ...s1, expenses: [] })
    const first = (await count(A.client, e.id))[0]?.deleted_at
    await new Promise((r) => setTimeout(r, 1500))
    await flushDiff(A.client, A.userId, s1, { ...s1, expenses: [] })
    expect((await count(A.client, e.id))[0]?.deleted_at).toBe(first)
  })
  it('S-1: an edit made while a pull is in flight is on the server after the next flush', async () => {
    const A = await liveClient(EMAIL)
    const e = expense(); const s1: Snapshot = { ...emptySnapshot(), expenses: [e] }
    await flushDiff(A.client, A.userId, emptySnapshot(), s1)
    const delta = (await pullDelta(A.client, null))!
    // The device added `mid` while that pull was answering; the baseline is the delivered copy plus the pulled rows.
    const mid = expense({ description: 'QA r2 mid-pull' })
    const baseline = applyDelta(s1, delta, s1)
    const store = { ...applyDelta({ ...s1, expenses: [...s1.expenses, mid] }, delta, s1) }
    expect((await flushDiff(A.client, A.userId, baseline, store)).errors).toEqual([])
    expect(await count(A.client, mid.id)).toHaveLength(1)
  })
})
