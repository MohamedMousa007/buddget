import { instantOf } from '@/lib/accounts/balance'
import { assetFundingId } from '@/lib/savings/assetPurchase'
import { catForAccount, type CatKey } from '@/lib/savings/wealthModel'
import type { Expense, InvestmentHolding, SavingsAccount, SavingsTransaction } from '@/lib/store/types'
import { safeLocalDayKey } from '@/lib/utils/localDate'

/**
 * One row of Wealth's Activity:
 * - `tx`: a pocket move (deposit, withdrawal, pocket-to-pocket, month-end carry, money from outside, a goal's opening money).
 * - `buy`: an asset bought from an account or from outside. Only the holding records an outside buy, and an account buy's
 *   money row is an expense, so neither has a pocket row; a buy paid from a pocket shows as that pocket's withdrawal instead.
 */
export type ActivityMove =
  | { kind: 'tx'; id: string; at: number; tx: SavingsTransaction }
  | { kind: 'buy'; id: string; at: number; holding: InvestmentHolding; paidFromAccountId?: string }

export interface ActivityMovesInput {
  transactions: readonly SavingsTransaction[]
  holdings: readonly InvestmentHolding[]
  expenses: readonly Pick<Expense, 'id' | 'paymentMethodId'>[]
  accounts: readonly SavingsAccount[]
  /** Only moves on accounts (or assets) of this kind. */
  filter?: CatKey | null
  /** Newest N. */
  limit?: number
}

/** A buy's instant: when it was entered, if that was on its purchase day; else noon of the purchase day. */
function buyInstant(h: InvestmentHolding & { purchaseDate: string }): number {
  return safeLocalDayKey(h.createdAt) === h.purchaseDate.slice(0, 10) ? new Date(h.createdAt).getTime() : instantOf(undefined, h.purchaseDate)
}

/** Every move, newest first (deposits before withdrawals at the same instant). */
export function activityMoves({ transactions, holdings, expenses, accounts, filter, limit }: ActivityMovesInput): ActivityMove[] {
  const catOf = (accountId: string) => {
    const a = accounts.find((x) => x.id === accountId)
    return a ? catForAccount(a) : null
  }
  // Corrections and opening balances are not moves; the rest of the non-cash-flow rows are.
  const txs: ActivityMove[] = transactions
    .filter((t) => t.isCashFlow !== false || t.source === 'carry' || !!t.transferGroupId || t.source === 'goal_opening' || t.source === 'outside')
    .filter((t) => !filter || catOf(t.accountId) === filter)
    .map((tx) => ({ kind: 'tx', id: tx.id, at: instantOf(tx.occurredAt, tx.date), tx }))

  const pocketRows = new Set(transactions.map((t) => t.id))
  const buys: ActivityMove[] = holdings
    .filter((h): h is InvestmentHolding & { purchaseDate: string } => !!h.purchaseDate && !pocketRows.has(assetFundingId(h.id)))
    .filter((h) => !filter || h.assetType === filter)
    .map((holding) => {
      const paidFromAccountId = expenses.find((e) => e.id === assetFundingId(holding.id))?.paymentMethodId ?? undefined
      return { kind: 'buy', id: holding.id, at: buyInstant(holding), holding, ...(paidFromAccountId ? { paidFromAccountId } : {}) }
    })

  const isDeposit = (m: ActivityMove) => (m.kind === 'tx' ? m.tx.type === 'deposit' : true)
  const list = [...txs, ...buys].sort((a, b) => b.at - a.at || Number(isDeposit(b)) - Number(isDeposit(a)))
  return limit ? list.slice(0, limit) : list
}
