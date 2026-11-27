import { computeBalances, type LedgerInput } from './balance'

export interface AccountsBasis {
  /** Absent while no account has a starting balance (net worth then counts no account cash). */
  accountsBasis?: number
  /** Pockets whose money already sits inside a counted account balance. */
  heldInPocketIds?: ReadonlySet<string>
  accountsIncomplete?: true
  /** Pockets in a closed or deleted account: that money left the user's totals, so they count 0 (I-5). */
  goneHolderPocketIds?: ReadonlySet<string>
  /** Pockets in a closed, deleted or untracked account, for "What's the balance of X?" repair. */
  needsRepair?: readonly string[]
}

/**
 * The accounts side of net worth, shared by the hero hook and Buddgy so both always agree. A closed account has left
 * the user's totals, and so has every pocket held in it.
 */
export function accountsBasisFor(ledger: LedgerInput, base: string): AccountsBasis {
  const balances = computeBalances(ledger)
  const methods = new Map(ledger.paymentMethods.map((m) => [m.id, m]))
  const gone = new Set<string>()
  const repair: string[] = []
  const held = new Set<string>()
  for (const p of ledger.savingsAccounts) {
    if (!p.heldInPaymentMethodId) continue
    const holder = methods.get(p.heldInPaymentMethodId)
    if (!holder || holder.closedAt) {
      gone.add(p.id)
      repair.push(p.id)
    } else if (!balances.has(holder.id)) repair.push(p.id) // untracked: counted on its own until its balance is set
    else if (!holder.excluded) held.add(p.id) // a pocket in a not-counted account is counted on its own (as zakat does)
  }
  const pockets = {
    ...(gone.size ? { goneHolderPocketIds: gone } : {}),
    ...(repair.length ? { needsRepair: repair } : {}),
  }
  if (balances.size === 0) return pockets
  let total = 0
  let incomplete = false
  for (const b of balances.values()) {
    const m = methods.get(b.id)
    if (m?.excluded || m?.closedAt) continue
    const v = ledger.convert(b.balance, b.currency, base)
    // No rate to the base currency: leave the account out and say so, never count it at face value.
    if (v === null) incomplete = true
    else total += v
  }
  return { accountsBasis: total, heldInPocketIds: held, ...(incomplete ? { accountsIncomplete: true as const } : {}), ...pockets }
}
