import { computeBalances, type LedgerInput } from './balance'

/**
 * The accounts side of net worth, shared by the hero hook and Buddgy so both always agree. Empty while no account
 * has a starting balance (net worth then keeps its legacy monthly-flow term).
 */
export function accountsBasisFor(ledger: LedgerInput, base: string):
  { accountsBasis: number; heldInPocketIds: ReadonlySet<string>; accountsIncomplete?: true } | Record<string, never> {
  const balances = computeBalances(ledger)
  if (balances.size === 0) return {}
  const excluded = new Set(ledger.paymentMethods.filter((m) => m.excluded).map((m) => m.id))
  let total = 0
  let incomplete = false
  for (const b of balances.values()) {
    if (excluded.has(b.id)) continue
    const v = ledger.convert(b.balance, b.currency, base)
    // No rate to the base currency: leave the account out and say so, never count it at face value.
    if (v === null) incomplete = true
    else total += v
  }
  // A pocket inside a not-counted account is counted on its own (as zakat does): its holder's balance is not in the total.
  const held = new Set(ledger.savingsAccounts.filter((p) => p.heldInPaymentMethodId && balances.has(p.heldInPaymentMethodId) && !excluded.has(p.heldInPaymentMethodId)).map((p) => p.id))
  return { accountsBasis: total, heldInPocketIds: held, ...(incomplete ? { accountsIncomplete: true as const } : {}) }
}
