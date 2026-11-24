import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { computeBalances, type LedgerInput } from '@/lib/accounts/balance'
import { isTracked } from '@/lib/accounts/kinds'

/** Where a pocket's money is: inside a tracked account (part of that account's balance), or outside every account. */
export type PocketHome = { kind: 'reserved'; accountId: string } | { kind: 'outside' }

export function pocketHome(pocket: Pick<SavingsAccount, 'heldInPaymentMethodId'>, methods: readonly PaymentMethod[]): PocketHome {
  const holder = pocket.heldInPaymentMethodId ? methods.find((m) => m.id === pocket.heldInPaymentMethodId) : undefined
  return holder && isTracked(holder) ? { kind: 'reserved', accountId: holder.id } : { kind: 'outside' }
}

/** Money in the account that no pocket has set aside, in the account's currency. Zero for an untracked account. */
export function availableIn(accountId: string, ledger: LedgerInput): number {
  return computeBalances(ledger).get(accountId)?.free ?? 0
}
