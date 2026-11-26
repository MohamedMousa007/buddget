import type { Expense } from '@/lib/store/types'

/**
 * A Cash out (account → Cash on hand): the one own-account move Flow still lists, as an uncounted transfer row, so the money
 * leaving the account is visible where the user looks for it (live QA round 2, W2). Other moves (transfers, top-ups,
 * exchanges) stay hidden from Flow (bug 14).
 */
export function isCashOut(e: Pick<Expense, 'category' | 'toPaymentMethodId' | 'refundKind'>): boolean {
  return e.category === 'ATM Cash Withdrawal' && Boolean(e.toPaymentMethodId) && !e.refundKind
}
