import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import type { Snapshot } from './snapshot'

/**
 * L1-B: rows the user deleted on this device that the server has not acknowledged yet, per synced list, with the time
 * of the delete. While an id is here no pull may bring the row back and every flush sends its delete, so a pull that
 * was in flight when the user deleted (and still carries the row) can no longer resurrect it. Undo takes the id out.
 */
export type PendingDeletes = Partial<Record<ListSlice, Record<string, string>>>

const LIST_SLICES = [
  'paymentMethods', 'incomeSources', 'incomeEvents', 'expenses', 'receipts', 'recurringExpenses', 'subscriptions', 'debts',
  'debtPayments', 'recurringDebtPayments', 'savingsAccounts', 'investmentHoldings', 'savingsTransactions',
  'recurringSavingsDeposits', 'goals', 'budgetPlans', 'budgetPlanActivations', 'buddgyMemories', 'accountAdjustments',
] as const satisfies readonly (keyof Snapshot)[]
type ListSlice = (typeof LIST_SLICES)[number]
type Lists = Pick<Snapshot, ListSlice>
type Row = { id: string }

const PREFIX = 'buddget:pending-deletes:'
/** This tab's copy: the truth while the app runs, and the only copy when storage is blocked. Storage carries it across a reload. */
const memory = new Map<string, PendingDeletes>()

export function readPendingDeletes(userId: string): PendingDeletes {
  const known = memory.get(userId)
  if (known) return known
  let loaded: PendingDeletes = {}
  try {
    const raw = window.localStorage.getItem(PREFIX + userId)
    if (raw) loaded = JSON.parse(raw) as PendingDeletes
  } catch { /* no storage: nothing survived a reload */ }
  memory.set(userId, loaded)
  return loaded
}

export function writePendingDeletes(userId: string, pending: PendingDeletes): void {
  memory.set(userId, pending)
  try {
    if (hasPendingDeletes(pending)) window.localStorage.setItem(PREFIX + userId, JSON.stringify(pending))
    else window.localStorage.removeItem(PREFIX + userId)
  } catch { /* storage full or blocked: kept in memory for this run */ }
}

/** Sign-out, account switch or an account reset: no one's pending deletes may reach the next session. */
export function clearPendingDeletes(): void {
  memory.clear()
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i)
      if (k?.startsWith(PREFIX)) window.localStorage.removeItem(k)
    }
  } catch { /* restricted storage */ }
}

export function hasPendingDeletes(pending: PendingDeletes): boolean {
  return Object.values(pending).some((ids) => ids && Object.keys(ids).length > 0)
}

export function deletedIdsOf(pending: PendingDeletes): ReadonlySet<string> {
  return new Set(Object.values(pending).flatMap((ids) => Object.keys(ids ?? {})))
}

export function deleteTimesOf(pending: PendingDeletes): ReadonlyMap<string, string> {
  return new Map(Object.values(pending).flatMap((ids) => Object.entries(ids ?? {})))
}

/**
 * Folds one store change into the set: an id gone from a synced list is a delete (its first delete time is kept), an id
 * that is back is an Undo. Null when nothing changed. The caller skips changes that came from the server.
 */
export function trackDeletes(pending: PendingDeletes, prev: Lists, next: Lists, at: string): PendingDeletes | null {
  let out: PendingDeletes | null = null
  for (const key of LIST_SLICES) {
    const before = prev[key] as Row[] | undefined
    const after = next[key] as Row[] | undefined
    if (before === after || !before || !after) continue
    const known = pending[key] ?? {}
    const live = new Set(after.map((r) => r.id))
    let slice: Record<string, string> | null = null
    for (const r of before) {
      if (!live.has(r.id) && r.id !== DEFAULT_CASH_ID && !(r.id in known)) (slice ??= { ...known })[r.id] = at
    }
    for (const id of Object.keys(known)) {
      if (live.has(id)) delete (slice ??= { ...known })[id]
    }
    if (!slice) continue
    out = { ...(out ?? pending), [key]: slice }
    if (Object.keys(slice).length === 0) delete out[key]
  }
  return out
}

/** The set after a flush the server accepted: what it sent is done; a delete made (or re-made) meanwhile stays. */
export function ackDeletes(current: PendingDeletes, sent: PendingDeletes): PendingDeletes {
  const out: PendingDeletes = {}
  for (const key of LIST_SLICES) {
    const ids = current[key]
    if (!ids) continue
    const left = Object.fromEntries(Object.entries(ids).filter(([id, at]) => sent[key]?.[id] !== at))
    if (Object.keys(left).length > 0) out[key] = left
  }
  return out
}

/** A merged list without the rows deleted here, unless the local list itself still holds one. */
export function withoutDeleted<T extends Row>(merged: T[], local: readonly T[], deleted: ReadonlySet<string> | undefined): T[] {
  if (!deleted || deleted.size === 0) return merged
  const mine = new Set(local.map((r) => r.id))
  return merged.filter((r) => mine.has(r.id) || !deleted.has(r.id))
}

/** The lists of `snap` that still hold a pending-deleted row (a store persisted before the delete), filtered. Null when none do. */
export function dropDeleted(snap: Lists, pending: PendingDeletes): Partial<Lists> | null {
  let out: Partial<Lists> | null = null
  for (const key of LIST_SLICES) {
    const ids = pending[key]
    if (!ids || !(snap[key] as Row[]).some((r) => r.id in ids)) continue
    ;(out ??= {} as Partial<Lists>)[key] = (snap[key] as Row[]).filter((r) => !(r.id in ids)) as never
  }
  return out
}

/** `prev` with a bare row for every pending delete it no longer holds, so the diff against `next` sends that delete again. */
export function withDeleteStubs(prev: Snapshot, next: Snapshot, pending: PendingDeletes): Snapshot {
  let out: Snapshot | null = null
  for (const key of LIST_SLICES) {
    const ids = Object.keys(pending[key] ?? {})
    if (ids.length === 0) continue
    const present = new Set([...(prev[key] as Row[]), ...(next[key] as Row[])].map((r) => r.id))
    const stubs = ids.filter((id) => !present.has(id)).map((id) => (key === 'budgetPlans' ? { id, categories: [] } : { id }))
    if (stubs.length > 0) (out ??= { ...prev })[key] = [...(prev[key] as Row[]), ...stubs] as never
  }
  return out ?? prev
}
