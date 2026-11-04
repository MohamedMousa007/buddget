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

/** Totals per currency, so mixed-currency rows are never added together. */
export function totalsByCurrency(rows: readonly Pick<Expense, 'amount' | 'currency'>[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const cur = String(r.currency)
    out[cur] = Math.round(((out[cur] ?? 0) + r.amount) * 100) / 100
  }
  return out
}
