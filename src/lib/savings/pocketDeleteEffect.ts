import { computeBalances, type LedgerInput } from '@/lib/accounts/balance'
import { accountsBasisFor } from '@/lib/accounts/netWorthBasis'
import { pocketCloseAdjustments } from '@/lib/accounts/pocketCloseAdjustments'
import { balanceEpsilon } from './balanceMath'
import { ledgerOf } from './pocketHome'
import type { FinanceStore } from '@/lib/store/types'

/**
 * What deleting a pocket does to net worth, so the warning never promises the wrong thing:
 * - `stays`: net worth is unchanged; the money is (back) in these accounts.
 * - `leaves`: net worth falls by this amount (the part no account holds).
 * - `unknown`: neither can be said (an empty pocket, no rate to the base currency, a gain).
 */
export type PocketDeleteEffect =
  | { kind: 'stays'; accountIds: string[] }
  | { kind: 'leaves'; amount: number; currency: string }
  | { kind: 'unknown' }

type DeleteState = Parameters<typeof ledgerOf>[0] & Pick<FinanceStore, 'settings'>

/** The ledger as `deleteSavingsAccount` leaves it: the pocket and its rows gone, a held pocket's account legs frozen. */
function ledgerAfterDelete(before: LedgerInput, id: string, held: boolean): LedgerInput {
  const after: LedgerInput = {
    ...before,
    savingsAccounts: before.savingsAccounts.filter((a) => a.id !== id),
    savingsTransactions: before.savingsTransactions.filter((t) => t.accountId !== id),
  }
  if (!held) return after
  const now = new Date().toISOString()
  return { ...after, adjustments: [...before.adjustments, ...pocketCloseAdjustments(before, after, '', now, () => '')] }
}

export function pocketDeleteEffect(state: DeleteState, id: string): PocketDeleteEffect {
  const pocket = state.savingsAccounts.find((a) => a.id === id)
  if (!pocket || !(pocket.currentBalance > 0)) return { kind: 'unknown' }
  const base = state.settings.baseCurrency
  const before = ledgerOf(state)
  const after = ledgerAfterDelete(before, id, !!pocket.heldInPaymentMethodId)
  const was = accountsBasisFor(before, base)
  const now = accountsBasisFor(after, base)
  if (was.accountsIncomplete || now.accountsIncomplete) return { kind: 'unknown' }

  // Counted inside its holder's balance: the delete only releases it there.
  if (was.heldInPocketIds?.has(id)) return { kind: 'stays', accountIds: [pocket.heldInPaymentMethodId as string] }

  const own = before.convert(pocket.currentBalance, pocket.currency, base)
  if (own === null) return { kind: 'unknown' }
  const returned = (now.accountsBasis ?? 0) - (was.accountsBasis ?? 0)
  const lost = own - returned
  const eps = balanceEpsilon(base)
  if (lost < -eps) return { kind: 'unknown' }
  if (lost <= eps) {
    const balances = computeBalances(before)
    const accountIds = [...computeBalances(after)].filter(([accountId, b]) => b.balance > (balances.get(accountId)?.balance ?? 0)).map(([accountId]) => accountId)
    return accountIds.length ? { kind: 'stays', accountIds } : { kind: 'unknown' }
  }
  // Nothing came back: the whole pocket leaves, said in its own currency. A part is said in the base currency.
  return Math.abs(returned) <= eps ? { kind: 'leaves', amount: pocket.currentBalance, currency: pocket.currency } : { kind: 'leaves', amount: lost, currency: base }
}
