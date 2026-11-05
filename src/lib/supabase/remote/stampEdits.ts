import { deepEqual } from './diff'
import type { Snapshot } from './snapshot'

/**
 * The lists whose store actions never stamped `updatedAt`. Without a stamp the server cannot tell a stale offline edit
 * from a fresh one, and the pull merge cannot order a local edit against a server copy.
 */
const STAMPED_SLICES = ['savingsAccounts', 'debtPayments', 'recurringDebtPayments', 'recurringSavingsDeposits', 'budgetPlanActivations'] as const

type Stamped = { id: string; updatedAt?: string }

/**
 * Rows of those lists that changed content between two store states without their stamp moving are local edits: stamp
 * them with the edit time. A row taken from the server always arrives with a newer stamp, so it is never touched.
 * Returns the slices to set, or null when nothing needs a stamp.
 */
export function stampEdits(prev: Pick<Snapshot, (typeof STAMPED_SLICES)[number]>, next: Pick<Snapshot, (typeof STAMPED_SLICES)[number]>, at: string): Partial<Pick<Snapshot, (typeof STAMPED_SLICES)[number]>> | null {
  let patch: Record<string, Stamped[]> | null = null
  for (const key of STAMPED_SLICES) {
    const before = prev[key] as Stamped[]
    const after = next[key] as Stamped[]
    if (before === after) continue
    const prevById = new Map(before.map((r) => [r.id, r]))
    let changed = false
    const stamped = after.map((row) => {
      const old = prevById.get(row.id)
      if (!old || old.updatedAt !== row.updatedAt || deepEqual(old, row)) return row
      changed = true
      return { ...row, updatedAt: at }
    })
    if (changed) (patch ??= {})[key] = stamped
  }
  return patch as Partial<Pick<Snapshot, (typeof STAMPED_SLICES)[number]>> | null
}
