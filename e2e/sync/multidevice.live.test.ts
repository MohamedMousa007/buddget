import { randomUUID } from 'crypto'
import { writeFileSync, mkdirSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { applyDelta, emptySnapshot, flushDiff, pullDelta, type Snapshot } from '@/lib/supabase/remote'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import type { DebtPayment, Expense, Debt } from '@/lib/store/types'
import { liveClient } from './liveClient'

/** Two "devices" = two independently signed-in clients for the same synthetic user, each with its own snapshot and baseline. */
const EMAIL = 'qa-sync-2@buddget-qa.test'
const evidence: Record<string, unknown> = {}
const iso = (ms = 0) => new Date(Date.now() + ms).toISOString()

function expense(over: Partial<Expense> = {}): Expense {
  const now = iso()
  return {
    id: randomUUID(), date: now.slice(0, 10), description: 'QA sync', category: 'Food', amount: 100, currency: 'EGP',
    amountInBaseCurrency: 100, paymentMethodId: DEFAULT_CASH_ID, isRecurring: false, createdAt: now, updatedAt: now, ...over,
  } as unknown as Expense
}

async function serverExpense(client: Awaited<ReturnType<typeof liveClient>>['client'], id: string) {
  const { data } = await client.from('expenses').select('id, amount, description, deleted_at, edited_at').eq('id', id).maybeSingle()
  return data
}

describe('multi-device consistency (live, synthetic user)', () => {
  it('stale device B: an older edit does not overwrite a newer edit from A (stale-write guard)', async () => {
    const A = await liveClient(EMAIL)
    const B = await liveClient(EMAIL)
    // Past stamps: the server clamps future edit times to now() (private.stamp_insert / reject_stale_write).
    const e0 = expense({ createdAt: iso(-120_000), updatedAt: iso(-120_000) })
    const s0 = emptySnapshot()
    const s1: Snapshot = { ...s0, expenses: [e0] }
    expect((await flushDiff(A.client, A.userId, s0, s1)).errors).toEqual([])
    // B edits first (older stamp, 20 s before A's) but flushes after A.
    const bEdit = { ...e0, amount: 222, updatedAt: iso(-60_000) }
    const aEdit = { ...e0, amount: 333, updatedAt: iso(-40_000) }
    expect((await flushDiff(A.client, A.userId, s1, { ...s1, expenses: [aEdit] })).errors).toEqual([])
    const rb = await flushDiff(B.client, B.userId, s1, { ...s1, expenses: [bEdit] })
    evidence.staleWrite = { bResult: { errors: rb.errors, skipped: rb.skippedWrites }, server: await serverExpense(A.client, e0.id) }
    expect(rb.skippedWrites).toBe(1)
    expect((await serverExpense(A.client, e0.id))?.amount).toBe(333)
  })

  it('field-level conflict: A edits amount, B edits description of the same row -> whole-row LWW drops one field', async () => {
    const A = await liveClient(EMAIL)
    const B = await liveClient(EMAIL)
    const e0 = expense({ description: 'orig', amount: 100 })
    const s1: Snapshot = { ...emptySnapshot(), expenses: [e0] }
    await flushDiff(A.client, A.userId, emptySnapshot(), s1)
    const aEdit = { ...e0, amount: 150, updatedAt: iso(1_000) }
    const bEdit = { ...e0, description: 'renamed on B', updatedAt: iso(2_000) }
    await flushDiff(A.client, A.userId, s1, { ...s1, expenses: [aEdit] })
    await flushDiff(B.client, B.userId, s1, { ...s1, expenses: [bEdit] })
    const srv = await serverExpense(A.client, e0.id)
    evidence.fieldConflict = srv
    // Documenting behaviour: B's full row (amount 100) replaced A's amount edit.
    expect(srv?.description).toBe('renamed on B')
    expect(Number(srv?.amount)).toBe(100)
  })

  it('delete on A, offline edit on B: B reconnects and flushes an update; row must stay deleted', async () => {
    const A = await liveClient(EMAIL)
    const B = await liveClient(EMAIL)
    const e0 = expense()
    const s1: Snapshot = { ...emptySnapshot(), expenses: [e0] }
    await flushDiff(A.client, A.userId, emptySnapshot(), s1)
    const cursor = (await pullDelta(B.client, null))!.cursor
    // A deletes (tombstone).
    const ra = await flushDiff(A.client, A.userId, s1, { ...s1, expenses: [] })
    expect(ra.errors).toEqual([])
    // B (offline, stale) edits the same row later, then reconnects: flush first, then pull (pendingSync order).
    const bEdit = { ...e0, amount: 999, updatedAt: iso(10_000) }
    const rb = await flushDiff(B.client, B.userId, s1, { ...s1, expenses: [bEdit] })
    const srvAfterB = await serverExpense(A.client, e0.id)
    const delta = await pullDelta(B.client, cursor)
    const merged = applyDelta({ ...s1, expenses: [bEdit] }, delta!, { ...s1, expenses: [bEdit] })
    evidence.deleteVsOfflineEdit = { bFlush: { errors: rb.errors, skipped: rb.skippedWrites, parked: rb.parked }, server: srvAfterB, deltaDeleted: delta!.expenses.deletedIds.includes(e0.id), bLocalAfterPull: merged.expenses.map((x) => x.id) }
    expect(srvAfterB?.deleted_at).not.toBeNull()
    expect(merged.expenses.find((x) => x.id === e0.id)).toBeUndefined()
  })

  it('undo-delete on B after A deleted: an insert revives the tombstone (deleted_at: null)', async () => {
    const A = await liveClient(EMAIL)
    const B = await liveClient(EMAIL)
    const e0 = expense()
    const s1: Snapshot = { ...emptySnapshot(), expenses: [e0] }
    await flushDiff(A.client, A.userId, emptySnapshot(), s1)
    await flushDiff(A.client, A.userId, s1, { ...s1, expenses: [] })
    // B never had it in its baseline (e.g. baseline lost / fingerprint absent) and holds the row: it is an insert.
    const rb = await flushDiff(B.client, B.userId, emptySnapshot(), s1)
    const srv = await serverExpense(A.client, e0.id)
    evidence.resurrectViaInsert = { bFlush: { errors: rb.errors, skipped: rb.skippedWrites }, server: srv }
    // Recorded, not asserted either way: see report SYNC-006.
  })

  it('delta cursor: a server-side change after the cursor is delivered; an unchanged row is not', async () => {
    const A = await liveClient(EMAIL)
    const e0 = expense(); const e1 = expense()
    const s1: Snapshot = { ...emptySnapshot(), expenses: [e0, e1] }
    await flushDiff(A.client, A.userId, emptySnapshot(), s1)
    const c1 = (await pullDelta(A.client, null))!.cursor
    await flushDiff(A.client, A.userId, s1, { ...s1, expenses: [{ ...e0, amount: 101, updatedAt: iso(1_000) }, e1] })
    const d = (await pullDelta(A.client, c1))!
    evidence.cursor = { c1, next: d.cursor, upserts: d.expenses.upserts.map((x) => x.id), e0: e0.id, e1: e1.id }
    expect(d.expenses.upserts.map((x) => x.id)).toContain(e0.id)
    // sync_pull re-sends everything touched in the 2 minutes before the cursor (deliberate overlap, idempotent merge).
    expect(d.expenses.upserts.map((x) => x.id)).toContain(e1.id)
  })

  it('debt payment funded by a real account still syncs; Cash fails (scope of SYNC-001)', async () => {
    const A = await liveClient(EMAIL)
    const now = iso()
    const debt = { id: randomUUID(), name: 'QA scope', person: 'QA', startingBalance: 1000, currency: 'EGP', isGold: false, createdAt: now, updatedAt: now } as unknown as Debt
    const s1: Snapshot = { ...emptySnapshot(), debts: [debt] }
    await flushDiff(A.client, A.userId, emptySnapshot(), s1)
    const none = { id: randomUUID(), debtId: debt.id, date: now.slice(0, 10), amountPaid: 10, createdAt: now, updatedAt: now } as DebtPayment
    const cash = { ...none, id: randomUUID(), paymentMethodId: DEFAULT_CASH_ID }
    const r = await flushDiff(A.client, A.userId, s1, { ...s1, debtPayments: [none, cash] })
    evidence.scope = r.parked
    expect(r.parked?.map((p) => p.id)).toEqual([cash.id])
    mkdirSync('e2e/sync/evidence', { recursive: true })
    writeFileSync('e2e/sync/evidence/multidevice.json', JSON.stringify(evidence, null, 2))
  })
})
