import type { Expense } from '@/lib/store/types'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'

/**
 * Bank-message expenses that name no account. `computeBalances` leaves them out of every balance on purpose (an SMS the
 * resolver could not place must not drain Cash), so the user has to be told and given a way to place them.
 */
export function unplacedSmsExpenses(expenses: readonly Expense[]): Expense[] {
  return expenses.filter(
    (e) => !!e.smsLogId && !e.refundedAt && e.category !== 'CC Payoff' && (!e.paymentMethodId || e.paymentMethodId === DEFAULT_CASH_ID),
  )
}

/**
 * How a ledger row names where its money came from. A bank-message expense the server could not place is stored with
 * no account, which the store reads back as the cash sentinel: that is a storage default, not a fact, so it is shown as
 * "Unassigned". A manual expense on the same sentinel really is cash.
 */
export function smsAccountLabelKind(e: Pick<Expense, 'smsLogId' | 'paymentMethodId'>): 'unassigned' | 'method' {
  return e.smsLogId && (!e.paymentMethodId || e.paymentMethodId === DEFAULT_CASH_ID) ? 'unassigned' : 'method'
}

/** Totals per currency, so mixed-currency rows are never added together. */
export function totalsByCurrency(rows: readonly Pick<Expense, 'amount' | 'currency'>[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const cur = String(r.currency)
    out[cur] = Math.round(((out[cur] ?? 0) + r.amount) * 100) / 100
  }
  return out
}
