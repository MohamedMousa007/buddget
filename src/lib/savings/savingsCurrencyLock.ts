import type { SavingsAccount, SavingsTransaction } from '@/lib/store/types'

/** Relabelling a funded pocket's currency would silently change its value, so it is read-only once it holds money or history. */
export function isSavingsCurrencyLocked(
  account: Pick<SavingsAccount, 'id' | 'currentBalance'>,
  transactions: ReadonlyArray<Pick<SavingsTransaction, 'accountId'>>,
): boolean {
  return account.currentBalance !== 0 || transactions.some((t) => t.accountId === account.id)
}
