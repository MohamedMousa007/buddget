/**
 * createSmsTransaction — the single classification dispatcher for SMS-parsed
 * transactions. Evaluates in a strict order so money-movements are never
 * mis-booked as spend or income:
 *   1. own-account reclassification (before the income branch)
 *   2. transfer / FX pairing (two-leg reconciliation)
 *   3. CC payoff → debt payment
 *   4. income → salary dedup
 *   5. ATM withdrawal → non-spend
 *   6. subscription-linked purchase
 *   7. default purchase
 *
 * Used by both /api/sms/parse (auto) and /api/sms/confirm (user-confirmed).
 */
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import {
  createSmsExpense,
  createSmsDebtPayment,
  matchOriginalExpense,
  markExpenseRefunded,
  findRefundedTwin,
  mapKindToCategory,
  isIncomeKind,
  type SmsRowData,
  type SmsExpenseKind,
} from './createSmsExpense'
import { isOwnAccountTransfer, tryPairLeg, reconcileSibling } from './pairing'
import { matchSalary } from './matchSalary'
import { matchSubscription } from './matchSubscription'

export type SmsTxOutcome =
  | 'expense'
  | 'subscription'
  | 'atm'
  | 'income'
  | 'income_matched'
  | 'refund_matched'
  | 'debt_payment'
  | 'transfer_single'
  | 'transfer_paired'
  | 'awaiting_confirmation'

export interface SmsTxResult {
  outcome: SmsTxOutcome
  expenseId: string | null
  incomeId: string | null
  debtPaymentId: string | null
  /** Final category applied (for logging/notification copy), when an expense was posted. */
  category: string | null
  /** Set for outcome 'awaiting_confirmation' — why confirmation is needed. */
  confirmReason: 'cc_ambiguous' | 'salary' | null
  /** Salary income source the SMS matched/should confirm against. */
  matchedSourceId: string | null
  /** Subscription the expense was linked to, if any. */
  linkedSubscriptionId: string | null
  error: PostgrestError | null
}

function base(outcome: SmsTxOutcome): SmsTxResult {
  return {
    outcome,
    expenseId: null,
    incomeId: null,
    debtPaymentId: null,
    category: null,
    confirmReason: null,
    matchedSourceId: null,
    linkedSubscriptionId: null,
    error: null,
  }
}

export async function createSmsTransaction(
  service: SupabaseClient,
  row: SmsRowData,
  opts: { exchangeRates: Record<string, number>; userConfirmed?: boolean },
): Promise<SmsTxResult> {
  let kind: SmsExpenseKind = row.kind

  // 1. Own-account reclassification — an inbound/outbound transfer whose
  //    counterparty is a registered own account is a Transfer, not income/spend.
  if (
    (kind === 'instant_transfer_in' || kind === 'instant_transfer_out') &&
    (await isOwnAccountTransfer(service, row.userId, row.counterpartyLast4 ?? null))
  ) {
    kind = 'own_transfer'
  }

  // 2. Transfer / FX — pair the two legs, represent the pair once (non-spend).
  if (kind === 'own_transfer' || kind === 'currency_exchange') {
    if (row.logId && row.receivedAtIso) {
      const sibling = await tryPairLeg(service, {
        userId: row.userId,
        logId: row.logId,
        receivedAtIso: row.receivedAtIso,
        amount: row.amount,
        kind,
      })
      if (sibling) {
        const { needsPost } = await reconcileSibling(service, sibling)
        if (!needsPost) return base('transfer_paired')
        // Income sibling was removed — post a single visible non-spend row.
        const posted = await createSmsExpense(service, { ...row, kind })
        return {
          ...base('transfer_paired'),
          expenseId: posted.expenseId,
          category: kind === 'currency_exchange' ? 'Currency Exchange' : 'Transfer',
          error: posted.error,
        }
      }
    }
    const res = await createSmsExpense(service, { ...row, kind })
    return {
      ...base('transfer_single'),
      expenseId: res.expenseId,
      category: kind === 'currency_exchange' ? 'Currency Exchange' : 'Transfer',
      error: res.error,
    }
  }

  // 3. CC payoff → debt payment (funded from bank/cash, never the card).
  if (kind === 'cc_payoff') {
    const res = await createSmsDebtPayment(service, row)
    if (res.needsConfirm) {
      // Ambiguous (multiple cards, no last4 match): degrade gracefully — post a
      // non-spend CC Payoff expense with NO card linkage (last4 null) so spend
      // totals stay correct and the card balance isn't wrongly inflated. The
      // debt is not auto-reduced in this rare case; the user can attach it.
      const fb = await createSmsExpense(service, { ...row, kind, last4: null })
      return { ...base('expense'), expenseId: fb.expenseId, category: 'CC Payoff', error: fb.error }
    }
    return {
      ...base('debt_payment'),
      expenseId: res.expenseId,
      debtPaymentId: res.debtPaymentId,
      category: 'CC Payoff',
      error: res.error,
    }
  }

  // 3.5 Refund / decline → reverse the ORIGINAL expense instead of booking
  //     one-time income. `declined`/reversal wording = no money moved.
  if (kind === 'refund' || kind === 'declined') {
    const refundKind: 'refunded' | 'declined' =
      kind === 'declined' || /declin|revers|reject|مرفوض|رفض|عكس/i.test(row.rawBody)
        ? 'declined'
        : 'refunded'
    // Duplicate guard: same refund re-sent as differently-worded SMS. If an
    // equal-amount charge on the same card was already reversed within ±3 days,
    // ack against it instead of reversing a second unrelated charge.
    const twin = await findRefundedTwin(service, row)
    if (twin) {
      return { ...base('refund_matched'), expenseId: twin.id, category: twin.category }
    }
    const match = await matchOriginalExpense(service, row)
    if (match) {
      const { error } = await markExpenseRefunded(service, match.id, refundKind, row.day, row.logId)
      return { ...base('refund_matched'), expenseId: match.id, category: match.category, error }
    }
    if (refundKind === 'declined') {
      // No original to reverse, but a decline moved no money — track it as a
      // net-zero expense so the user sees it (never income).
      const res = await createSmsExpense(service, { ...row, kind, refundMark: { refundKind, day: row.day } })
      return {
        ...base('expense'),
        expenseId: res.expenseId,
        category: mapKindToCategory(kind, row.categoryHint),
        error: res.error,
      }
    }
    // Refunded with no match → one-time income (unchanged legacy behavior).
    const res = await createSmsExpense(service, { ...row, kind: 'refund' })
    return { ...base('income'), incomeId: res.incomeId, error: res.error }
  }

  // 4. Income → salary matching. A confident match posts the ACTUAL received
  //    amount as an event LINKED to the recurring template (templateId), so the
  //    income tab can show projected vs actual (on-time/late/±Δ). A close-but-off
  //    match (e.g. a raise) asks the user first; on confirm we post it linked too.
  //    Only a genuinely new credit is captured as unlinked one-time income.
  if (isIncomeKind(kind)) {
    const decision = await matchSalary(service, {
      userId: row.userId,
      amount: row.amount,
      currency: row.currency,
      day: row.day,
    })
    if (decision.outcome === 'matched' || (decision.outcome === 'confirm' && opts.userConfirmed)) {
      const res = await createSmsExpense(service, { ...row, kind, templateId: decision.sourceId })
      return { ...base('income'), incomeId: res.incomeId, matchedSourceId: decision.sourceId, error: res.error }
    }
    if (decision.outcome === 'confirm') {
      return { ...base('income_matched'), matchedSourceId: decision.sourceId, confirmReason: 'salary' }
    }
    const res = await createSmsExpense(service, { ...row, kind })
    return { ...base('income'), incomeId: res.incomeId, error: res.error }
  }

  // 5. ATM withdrawal → non-spend (category mapped in createSmsExpense).
  if (kind === 'atm_withdrawal') {
    const res = await createSmsExpense(service, { ...row, kind })
    return { ...base('atm'), expenseId: res.expenseId, category: 'ATM Cash Withdrawal', error: res.error }
  }

  // 6. Purchase / online purchase → subscription linking, then expense.
  let linkedSubscriptionId: string | null = null
  if (kind === 'purchase' || kind === 'online_purchase') {
    const sub = await matchSubscription(service, {
      userId: row.userId,
      merchant: row.merchant,
      merchantNormalized: row.merchantNormalized,
      amount: row.amount,
      currency: row.currency,
      exchangeRates: opts.exchangeRates,
    })
    if (sub) linkedSubscriptionId = sub.subscriptionId
  }

  const res = await createSmsExpense(service, {
    ...row,
    kind,
    linkedSubscriptionId,
    categoryOverride: linkedSubscriptionId ? 'Subscription' : null,
  })
  return {
    ...base(linkedSubscriptionId ? 'subscription' : 'expense'),
    expenseId: res.expenseId,
    category: linkedSubscriptionId ? 'Subscription' : null,
    linkedSubscriptionId,
    error: res.error,
  }
}
