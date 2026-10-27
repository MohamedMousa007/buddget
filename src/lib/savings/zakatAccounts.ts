import { computeBalances, type LedgerInput } from '@/lib/accounts/balance'
import type { ZakatTrackedAccount } from '@/lib/savings/zakatInputs'

/** Tracked, non-excluded account balances for zakat, plus the pockets whose money they already contain. */
export function zakatAccountsFromLedger(ledger: LedgerInput): {
  trackedAccounts: ZakatTrackedAccount[]
  heldInPocketIds: ReadonlySet<string>
} {
  const balances = computeBalances(ledger)
  const excluded = new Set(ledger.paymentMethods.filter((m) => m.excluded).map((m) => m.id))
  const trackedAccounts = [...balances.values()]
    .filter((b) => !excluded.has(b.id))
    .map((b) => ({ balance: b.balance, currency: b.currency }))
  const heldInPocketIds = new Set(
    ledger.savingsAccounts.filter((p) => p.heldInPaymentMethodId && balances.has(p.heldInPaymentMethodId) && !excluded.has(p.heldInPaymentMethodId)).map((p) => p.id)
  )
  return { trackedAccounts, heldInPocketIds }
}
