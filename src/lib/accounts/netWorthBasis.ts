import { computeBalances, type LedgerInput } from './balance'

/**
 * The accounts side of net worth, shared by the hero hook and Buddgy so both always agree. Empty while no account
 * has a starting balance (net worth then keeps its legacy monthly-flow term).
 */
export function accountsBasisFor(ledger: LedgerInput, base: string):
  { accountsBasis: number; heldInPocketIds: ReadonlySet<string> } | Record<string, never> {
  const balances = computeBalances(ledger)
  if (balances.size === 0) return {}
  const excluded = new Set(ledger.paymentMethods.filter((m) => m.excluded).map((m) => m.id))
  let total = 0
  for (const b of balances.values()) if (!excluded.has(b.id)) total += ledger.convert(b.balance, b.currency, base) ?? b.balance
  const held = new Set(ledger.savingsAccounts.filter((p) => p.heldInPaymentMethodId && balances.has(p.heldInPaymentMethodId)).map((p) => p.id))
  return { accountsBasis: total, heldInPocketIds: held }
}
