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
  resolveExactPaymentMethod,
  type SmsRowData,
  type SmsExpenseKind,
} from './createSmsExpense'
import {
  isOwnAccountTransfer,
  tryPairLeg,
  reconcileSibling,
  reconcileCcPayoffFundingLeg,
  attributeFundingToPayoff,
  type CcPayoffFundingLeg,
} from './pairing'
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

/** Ignore rounding noise; only post a fee that is actually a fee. */
const MIN_FEE = 0.5

/**
 * Posts the funding bank's transfer fee as its own row.
 *
 * The funding leg debits payoff + fee (12,012 for a 12,000 payoff). The payoff is
 * non-spend — the purchases it settles were already counted — but the fee is money
 * genuinely consumed and must hit spend. Splitting them keeps one payoff transaction
 * while staying accurate; the fee is knowable only by differencing the two legs.
 *
 * Takes both sides explicitly rather than reading them off `row`, because `row` is the
 * payoff leg in one arrival order and the funding leg in the other.
 */
async function postTransferFee(
  service: SupabaseClient,
  row: SmsRowData,
  pair: { fundingLast4: string | null; fundingAmount: number | null; payoffAmount: number | null },
): Promise<void> {
  if (pair.fundingAmount == null || pair.payoffAmount == null) return
  const fee = pair.fundingAmount - pair.payoffAmount
  // Guard the sign too: a negative difference means the legs are not what we think, and
  // inventing a refund would be worse than skipping the fee.
  if (!(fee >= MIN_FEE)) return

  await service.from('expenses').insert({
    user_id: row.userId,
    expense_date: row.day,
    description: 'Transfer fee',
    category: 'Other',
    amount: fee,
    currency: row.currency,
    payment_method_id: await resolveExactPaymentMethod(service, row.userId, pair.fundingLast4),
    sms_log_id: row.logId ?? null,
  })
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
        // This leg funded a credit-card payoff that already posted. The payoff row is the
        // better representation (it drives the debt payment), so post no Transfer row —
        // otherwise the user sees the same money twice, which is the whole bug. Back-fill
        // the funding account the payoff could not know, and keep the fee it took on top.
        if (sibling.siblingKind === 'cc_payoff') {
          const fundingPmId = await resolveExactPaymentMethod(service, row.userId, row.last4)
          const { payoffAmount } = await attributeFundingToPayoff(service, sibling, fundingPmId)
          await postTransferFee(service, row, {
            fundingLast4: row.last4 ?? null,
            // This leg IS the funding side, so the fee is what it debited beyond the payoff.
            fundingAmount: row.amount,
            payoffAmount,
          })
          return base('transfer_paired')
        }

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

  // 3. CC payoff → debt payment, funded from the paired bank leg.
  if (kind === 'cc_payoff') {
    // Claim the funding leg. Paying a card by Instapay emits two SMS — the funding bank
    // ("12,012 sent to ••2016", which step 1 reclassifies to own_transfer because the
    // counterparty is the user's own card) and the card bank ("12,000 received"). They
    // are the same money, so without this the user sees the payoff twice; the amounts
    // differ only by the transfer fee, which `pairAmountTolerance` allows for.
    let funding: CcPayoffFundingLeg | null = null
    if (row.logId && row.receivedAtIso) {
      const sibling = await tryPairLeg(service, {
        userId: row.userId,
        logId: row.logId,
        receivedAtIso: row.receivedAtIso,
        amount: row.amount,
        kind,
      })
      if (sibling) funding = await reconcileCcPayoffFundingLeg(service, sibling)
    }

    const res = await createSmsDebtPayment(service, row, { fundingLast4: funding?.fundingLast4 })
    if (res.needsConfirm) {
      // Ambiguous (multiple cards, no last4 match): degrade gracefully — post a
      // non-spend CC Payoff expense with NO card linkage (last4 null) so spend
      // totals stay correct and the card balance isn't wrongly inflated. The
      // debt is not auto-reduced in this rare case; the user can attach it.
      const fb = await createSmsExpense(service, { ...row, kind, last4: null })
      return { ...base('expense'), expenseId: fb.expenseId, category: 'CC Payoff', error: fb.error }
    }

    // The fee the funding bank took on top. It is real spend and must count — only the
    // payoff itself is non-spend. Derivable only from the pair. Here `row` is the payoff.
    await postTransferFee(service, row, {
      fundingLast4: funding?.fundingLast4 ?? null,
      fundingAmount: funding?.fundingAmount ?? null,
      payoffAmount: row.amount,
    })

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
      day: row.day,
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
