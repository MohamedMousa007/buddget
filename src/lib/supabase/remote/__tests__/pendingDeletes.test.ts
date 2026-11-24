import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { applyDelta, type MappedDelta } from '@/lib/supabase/remote/delta'
import { mergeSnapshots } from '@/lib/supabase/remote/merge'
import { emptySnapshot, snapshot, type Snapshot } from '@/lib/supabase/remote/snapshot'
import { flushDiff } from '@/lib/supabase/remote/sync'
import {
  ackDeletes, clearPendingDeletes, deletedIdsOf, dropDeleted, hasPendingDeletes, readPendingDeletes, trackDeletes, writePendingDeletes,
  type PendingDeletes,
} from '@/lib/supabase/remote/pendingDeletes'
import type { Expense, Goal, PaymentMethod, SavingsAccount, SavingsTransaction } from '@/lib/store/types'
import { expenseAt } from './fakeEditTimeServer'

const U = 'u1'
const T0 = Date.UTC(2026, 10, 20, 10)
const iso = (ms: number) => new Date(ms).toISOString()

function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size },
  }
}

/** Records every write a flush sends: upserts per table, and each tombstone's table, ids and delete time. */
function recorder() {
  const tombstones: { table: string; ids: string[]; deletedAt: string }[] = []
  const upserts: { table: string; rows: Record<string, unknown>[] }[] = []
  const client = {
    from: (table: string) => ({
      upsert: (rows: Record<string, unknown>[]) => {
        upserts.push({ table, rows })
        return Promise.resolve({ error: null, count: rows.length })
      },
      update: (patch: { deleted_at: string }) => ({
        in: (_c: string, ids: string[]) => {
          tombstones.push({ table, ids, deletedAt: patch.deleted_at })
          return Promise.resolve({ error: null })
        },
      }),
      delete: () => ({ in: () => Promise.resolve({ error: null }) }),
    }),
  }
  return { client, tombstones, upserts }
}

const none = { upserts: [], deletedIds: [] }
function delta(over: Partial<MappedDelta>): MappedDelta {
  return {
    cursor: iso(T0), profile: null, settings: null, paymentMethods: none, incomeSources: none, incomeEvents: none, expenses: none,
    receipts: none, recurringExpenses: none, subscriptions: none, debts: none, debtPayments: none, recurringDebtPayments: none,
    savingsAccounts: none, investmentHoldings: none, savingsTransactions: none, recurringSavingsDeposits: none, goals: none,
    buddgyMemories: none, accountAdjustments: none, budgetPlans: [], deletedBudgetPlanIds: [], budgetPlanActivations: [],
    deletedBudgetPlanActivationIds: [], staleBefore: null, ...over,
  } as MappedDelta
}

const pm: PaymentMethod = {
  id: 'pm1', name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: false, openingBalance: 20000, openingAt: '2026-10-01T00:00:00.000Z', createdAt: iso(T0 - 9e6), updatedAt: iso(T0 - 9e6),
} as unknown as PaymentMethod
const pocket = (balance: number): SavingsAccount => ({
  id: 'p1', name: 'Trip', currency: 'EGP', currentBalance: balance, heldInPaymentMethodId: 'pm1', createdAt: iso(T0 - 9e6), updatedAt: iso(T0 - 9e6),
}) as unknown as SavingsAccount
const deposit: SavingsTransaction = {
  id: 't1', accountId: 'p1', type: 'deposit', amount: 500, currency: 'EGP', date: '2026-11-19', createdAt: iso(T0 - 9e6), updatedAt: iso(T0 - 9e6),
} as unknown as SavingsTransaction
/** Spent straight from the pocket: an exit leg out of CIB that closing the pocket must freeze. */
const spent: SavingsTransaction = {
  id: 't2', accountId: 'p1', type: 'withdrawal', amount: 100, currency: 'EGP', date: '2026-11-19', occurredAt: '2026-11-19T10:00:00.000Z', createdAt: iso(T0 - 9e6), updatedAt: iso(T0 - 9e6),
} as unknown as SavingsTransaction
const goal = (linked: string[]): Goal => ({
  id: 'g1', name: 'Trip', targetAmount: 2000, currency: 'EGP', linkedSavingsAccountIds: linked, createdAt: iso(T0 - 9e6), updatedAt: iso(T0 - 9e6),
}) as unknown as Goal

/** The sync's store subscriber: every user removal from a synced list is recorded with its time. */
function trackStore() {
  return useFinanceStore.subscribe((state, prev) => {
    const next = trackDeletes(readPendingDeletes(U), prev, state, new Date().toISOString())
    if (next) writePendingDeletes(U, next)
  })
}

function seed(partial: Partial<Snapshot>) {
  useFinanceStore.setState({ ...emptySnapshot(), profile: { ...emptySnapshot().profile, id: U }, ...partial })
}

let stop: () => void = () => {}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  vi.stubGlobal('window', { localStorage: memoryStorage() })
  clearPendingDeletes()
})
afterEach(() => {
  stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('L1-B: a local delete stays deleted until the server has it', () => {
  it('expense: a delta pull in flight that still carries the row does not bring it back, and the flush sends the delete', async () => {
    const e1 = expenseAt('e1', 50, T0 - 60_000)
    seed({ expenses: [e1, expenseAt('e2', 70, T0 - 60_000)] })
    const delivered = snapshot(useFinanceStore.getState())
    stop = trackStore()
    useFinanceStore.getState().deleteExpense('e1')
    const deletedAt = iso(T0)
    vi.setSystemTime(T0 + 200)

    // The pull started before the delete reached the server: it still has e1, as a recent change.
    const d = delta({ expenses: { upserts: [e1], deletedIds: [] } })
    const merged = applyDelta(snapshot(useFinanceStore.getState()), d, delivered, deletedIdsOf(readPendingDeletes(U)))
    expect(merged.expenses.map((x) => x.id)).toEqual(['e2'])
    useFinanceStore.setState({ expenses: merged.expenses })

    const baseline = applyDelta(delivered, d, delivered)
    const { client, tombstones } = recorder()
    const res = await flushDiff(client as never, U, baseline, snapshot(useFinanceStore.getState()), readPendingDeletes(U))
    expect(res.anyError).toBe(false)
    expect(tombstones).toEqual([{ table: 'expenses', ids: ['e1'], deletedAt }])
  })

  it('the mount pull (no delivered baseline) does not bring it back, and the flush still sends the delete', async () => {
    seed({ expenses: [expenseAt('e2', 70, T0 - 60_000)] })
    writePendingDeletes(U, { expenses: { e1: iso(T0 - 5_000) } })
    const d = delta({ expenses: { upserts: [expenseAt('e1', 50, T0 - 60_000), expenseAt('e2', 70, T0 - 60_000)], deletedIds: [] } })
    const merged = applyDelta(snapshot(useFinanceStore.getState()), d, null, deletedIdsOf(readPendingDeletes(U)))
    expect(merged.expenses.map((x) => x.id)).toEqual(['e2'])

    // The cold path baselines on the live store, which no longer has the row: only the pending set can send the delete.
    const live = { ...snapshot(useFinanceStore.getState()), expenses: merged.expenses }
    const { client, tombstones } = recorder()
    await flushDiff(client as never, U, live, live, readPendingDeletes(U))
    expect(tombstones).toEqual([{ table: 'expenses', ids: ['e1'], deletedAt: iso(T0 - 5_000) }])
  })

  it('the legacy full snapshot merge does not bring it back', () => {
    const local = { ...emptySnapshot(), expenses: [expenseAt('e2', 70, T0)] }
    const server = { ...emptySnapshot(), expenses: [expenseAt('e1', 50, T0), expenseAt('e2', 70, T0)] }
    expect(mergeSnapshots(local, server, new Set(['e1'])).expenses.map((x) => x.id)).toEqual(['e2'])
    expect(mergeSnapshots(local, server).expenses.map((x) => x.id)).toEqual(['e1', 'e2'])
  })

  it('a reload before the flush keeps the delete, even when the cached store still has the row', async () => {
    seed({ expenses: [expenseAt('e1', 50, T0 - 60_000)] })
    stop = trackStore()
    useFinanceStore.getState().deleteExpense('e1')
    stop()
    // Reload: a fresh module reads the set back from storage; the debounced store write had not landed yet.
    vi.resetModules()
    const fresh = await import('@/lib/supabase/remote/pendingDeletes')
    const pending = fresh.readPendingDeletes(U)
    expect(pending).toEqual({ expenses: { e1: iso(T0) } })
    const cache = { ...emptySnapshot(), expenses: [expenseAt('e1', 50, T0 - 60_000)] }
    const booted = { ...cache, ...fresh.dropDeleted(cache, pending) }
    expect(booted.expenses).toEqual([])
    const { client, tombstones } = recorder()
    await flushDiff(client as never, U, cache, booted, pending)
    expect(tombstones).toEqual([{ table: 'expenses', ids: ['e1'], deletedAt: iso(T0) }])
  })

  it('Undo takes the id out of the set: the row comes back and no delete is sent', async () => {
    const e1 = expenseAt('e1', 50, T0 - 60_000)
    seed({ expenses: [e1] })
    const delivered = snapshot(useFinanceStore.getState())
    stop = trackStore()
    useFinanceStore.getState().deleteExpense('e1')
    expect(hasPendingDeletes(readPendingDeletes(U))).toBe(true)
    useFinanceStore.setState((s) => ({ expenses: [...s.expenses, e1] }))
    expect(readPendingDeletes(U)).toEqual({})
    const merged = applyDelta(snapshot(useFinanceStore.getState()), delta({ expenses: { upserts: [e1], deletedIds: [] } }), delivered, deletedIdsOf(readPendingDeletes(U)))
    expect(merged.expenses.map((x) => x.id)).toEqual(['e1'])
    const { client, tombstones } = recorder()
    await flushDiff(client as never, U, delivered, snapshot(useFinanceStore.getState()), readPendingDeletes(U))
    expect(tombstones).toEqual([])
  })

  it('a held pocket with money: the pocket and its rows stay gone, the freeze and the goal unlink stay, every delete is sent', async () => {
    seed({ paymentMethods: [pm], savingsAccounts: [pocket(400)], savingsTransactions: [deposit, spent], goals: [goal(['p1'])] })
    const delivered = snapshot(useFinanceStore.getState())
    stop = trackStore()
    useFinanceStore.getState().deleteSavingsAccount('p1')
    const afterDelete = snapshot(useFinanceStore.getState())
    expect(afterDelete.goals[0].linkedSavingsAccountIds).toEqual([])
    // The 100 spent from the pocket left CIB: closing it freezes that leg as an adjustment on CIB.
    expect(afterDelete.accountAdjustments).toMatchObject([{ paymentMethodId: 'pm1', delta: -100 }])
    vi.setSystemTime(T0 + 200)

    // The in-flight pull brings the pocket and its deposit back as they were (recently written rows inside the window).
    const d = delta({ savingsAccounts: { upserts: [pocket(400)], deletedIds: [] }, savingsTransactions: { upserts: [deposit, spent], deletedIds: [] } })
    const merged = applyDelta(afterDelete, d, delivered, deletedIdsOf(readPendingDeletes(U)))
    expect(merged.savingsAccounts).toEqual([])
    expect(merged.savingsTransactions).toEqual([])
    expect(merged.accountAdjustments).toEqual(afterDelete.accountAdjustments)
    expect(merged.goals[0].linkedSavingsAccountIds).toEqual([])

    const { client, tombstones, upserts } = recorder()
    await flushDiff(client as never, U, applyDelta(delivered, d, delivered), merged, readPendingDeletes(U))
    const sent = Object.fromEntries(tombstones.map((t) => [t.table, t.ids]))
    expect(sent).toMatchObject({ savings_accounts: ['p1'], savings_transactions: ['t1', 't2'] })
    expect(tombstones.every((t) => t.deletedAt === iso(T0))).toBe(true)
    expect(upserts.find((u) => u.table === 'account_adjustments')?.rows).toMatchObject([{ payment_method_id: 'pm1' }])
    expect(upserts.find((u) => u.table === 'goals')?.rows[0]).toMatchObject({ id: 'g1' })
  })

  it('deleted_at is the time of the delete, not the time of the flush', async () => {
    seed({ expenses: [expenseAt('e1', 50, T0 - 60_000)] })
    const delivered = snapshot(useFinanceStore.getState())
    stop = trackStore()
    useFinanceStore.getState().deleteExpense('e1')
    vi.setSystemTime(T0 + 45_000)
    const { client, tombstones } = recorder()
    await flushDiff(client as never, U, delivered, snapshot(useFinanceStore.getState()), readPendingDeletes(U))
    expect(tombstones).toEqual([{ table: 'expenses', ids: ['e1'], deletedAt: iso(T0) }])
  })
})

describe('pending delete set bookkeeping', () => {
  it('an acknowledged flush clears only what it sent: a delete made during the flush stays', () => {
    const sent: PendingDeletes = { expenses: { e1: iso(T0) } }
    const now: PendingDeletes = { expenses: { e1: iso(T0), e2: iso(T0 + 100) } }
    expect(ackDeletes(now, sent)).toEqual({ expenses: { e2: iso(T0 + 100) } })
    // Undone and deleted again meanwhile: a new delete, kept.
    expect(ackDeletes({ expenses: { e1: iso(T0 + 900) } }, sent)).toEqual({ expenses: { e1: iso(T0 + 900) } })
  })

  it('is per user, and clearing it (sign-out) forgets every user', () => {
    writePendingDeletes(U, { expenses: { e1: iso(T0) } })
    expect(readPendingDeletes('u2')).toEqual({})
    clearPendingDeletes()
    expect(readPendingDeletes(U)).toEqual({})
  })

  it('a second removal of the same id keeps the first delete time', () => {
    const before = { ...emptySnapshot(), expenses: [expenseAt('e1', 1, T0)] }
    const after = emptySnapshot()
    const first = trackDeletes({}, before, after, iso(T0))!
    expect(trackDeletes(first, before, after, iso(T0 + 5_000))).toBeNull()
  })

  it('a row that was there before and after (a stale cached copy) is not an Undo', () => {
    const cached = { ...emptySnapshot(), expenses: [expenseAt('e1', 1, T0)] }
    const edited = { ...emptySnapshot(), expenses: [expenseAt('e1', 1, T0), expenseAt('e2', 2, T0)] }
    expect(trackDeletes({ expenses: { e1: iso(T0) } }, cached, edited, iso(T0 + 1))).toBeNull()
  })

  it('the built-in Cash method is never recorded', () => {
    const before = { ...emptySnapshot(), paymentMethods: [{ id: 'pm_default_cash' } as PaymentMethod] }
    expect(trackDeletes({}, before, emptySnapshot(), iso(T0))).toBeNull()
  })

  it('dropDeleted leaves a store with nothing pending untouched', () => {
    expect(dropDeleted({ ...emptySnapshot(), expenses: [expenseAt('e1', 1, T0)] as Expense[] }, {})).toBeNull()
  })

  it('works with no storage at all (in memory)', () => {
    vi.stubGlobal('window', {})
    writePendingDeletes(U, { expenses: { e1: iso(T0) } })
    expect(readPendingDeletes(U)).toEqual({ expenses: { e1: iso(T0) } })
  })
})
