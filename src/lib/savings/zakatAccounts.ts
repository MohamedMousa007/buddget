import { computeBalances, type AccountBalance, type LedgerInput } from '@/lib/accounts/balance'
import type { ZakatTrackedAccount } from '@/lib/savings/zakatInputs'

/**
 * Tracked, non-excluded account balances for zakat, plus the pockets whose money they already contain. With `asOf`,
 * balances are as they stood then; an account whose known balance starts later is taken at today's, flagged `noHistory`.
 * Pass `current` (today's balances) when rebuilding many days, so they are computed once.
 */
export function zakatAccountsFromLedger(ledger: LedgerInput, asOf?: number, current?: ReadonlyMap<string, AccountBalance>): {
  trackedAccounts: ZakatTrackedAccount[]
  heldInPocketIds: ReadonlySet<string>
} {
  const balances = current ?? computeBalances(ledger)
  const then = asOf === undefined ? balances : computeBalances(ledger, asOf)
  const excluded = new Set(ledger.paymentMethods.filter((m) => m.excluded).map((m) => m.id))
  const trackedAccounts = [...balances.values()]
    .filter((b) => !excluded.has(b.id))
    .map((b) => {
      const past = then.get(b.id)
      return past ? { balance: past.balance, currency: past.currency } : { balance: b.balance, currency: b.currency, noHistory: true }
    })
  const heldInPocketIds = new Set(
    ledger.savingsAccounts.filter((p) => p.heldInPaymentMethodId && balances.has(p.heldInPaymentMethodId) && !excluded.has(p.heldInPaymentMethodId)).map((p) => p.id)
  )
  return { trackedAccounts, heldInPocketIds }
}
