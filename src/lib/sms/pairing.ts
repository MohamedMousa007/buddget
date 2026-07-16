/**
 * Own-account transfer + currency-exchange pairing.
 *
 * Two-leg reality: a transfer/FX produces two independent /api/sms/parse calls
 * (debit + credit), seconds apart, in either order. The first leg posts a single
 * non-spend row; when the second leg lands it claims the sibling atomically (via
 * the `sms_try_pair` RPC, FOR UPDATE SKIP LOCKED) and reconciles so the pair is
 * represented ONCE and never double-counts — soft-deleting a leg that was
 * mistakenly posted as income.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SmsExpenseKind } from './createSmsExpense'

const PAIR_WINDOW_SECONDS = 300

/**
 * True when a transfer is between the user's OWN accounts: the counterparty
 * account last4 must match a registered payment method. (The source last4 is
 * always the user's own account, so it alone can't distinguish own vs external.)
 */
export async function isOwnAccountTransfer(
  service: SupabaseClient,
  userId: string,
  counterpartyLast4: string | null,
): Promise<boolean> {
  if (!counterpartyLast4) return false
  const { data } = await service
    .from('payment_methods')
    .select('id')
    .eq('user_id', userId)
    .eq('last4', counterpartyLast4)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  return !!data?.id
}

export interface PairSibling {
  siblingId: string
  siblingKind: string
  siblingExpenseId: string | null
  siblingIncomeId: string | null
  siblingStatus: string
}

/**
 * Absolute slack when matching two legs of the same movement.
 *
 * A CC payoff by Instapay debits the funding bank for the amount PLUS a transfer fee
 * (e.g. 12,012 vs 12,000), so exact equality never matches. Bounded so it stays a fee
 * allowance and cannot start pairing unrelated same-ish amounts.
 */
export function pairAmountTolerance(kind: SmsExpenseKind, amount: number): number {
  if (kind !== 'cc_payoff') return 0
  return Math.min(Math.max(amount * 0.02, 25), 250)
}

/**
 * Atomically claims an unpaired sibling leg. `own_transfer` requires an equal amount;
 * `cc_payoff` allows a fee-sized difference; `currency_exchange` does not constrain the
 * amount at all (cross-currency legs differ by the rate).
 */
export async function tryPairLeg(
  service: SupabaseClient,
  params: { userId: string; logId: string; receivedAtIso: string; amount: number; kind: SmsExpenseKind },
): Promise<PairSibling | null> {
  const requireEqual = params.kind === 'own_transfer' || params.kind === 'cc_payoff'
  // FX pairs with FX. An own_transfer pairs with the opposite-direction transfer legs.
  // A cc_payoff pairs with the funding leg, which the bank reports as an outbound
  // transfer — and which dispatch reclassifies to own_transfer when the counterparty
  // last4 matches the user's own registered card.
  const matchKinds =
    params.kind === 'currency_exchange'
      ? ['currency_exchange']
      : params.kind === 'cc_payoff'
        ? ['own_transfer', 'instant_transfer_out']
        : ['own_transfer', 'instant_transfer_in', 'instant_transfer_out']

  const { data, error } = await service.rpc('sms_try_pair', {
    p_user_id: params.userId,
    p_log_id: params.logId,
    p_received_at: params.receivedAtIso,
    p_window_seconds: PAIR_WINDOW_SECONDS,
    p_amount: params.amount,
    p_require_equal_amount: requireEqual,
    p_match_kinds: matchKinds,
    p_amount_tolerance: pairAmountTolerance(params.kind, params.amount),
  })
  if (error) {
    console.warn('[sms/pairing] sms_try_pair failed', error)
    return null
  }
  const row = Array.isArray(data) ? data[0] : null
  if (!row) return null
  return {
    siblingId: row.sibling_id,
    siblingKind: row.sibling_kind,
    siblingExpenseId: row.sibling_expense_id ?? null,
    siblingIncomeId: row.sibling_income_id ?? null,
    siblingStatus: row.sibling_status ?? '',
  }
}

export interface CcPayoffFundingLeg {
  /** Source account last4 of the leg that actually funded the payoff. */
  fundingLast4: string | null
  /** What left the funding account — payoff amount PLUS any transfer fee. */
  fundingAmount: number | null
}

/**
 * Reconciles the FUNDING leg of a credit-card payoff against the card leg.
 *
 * Paying a card by Instapay produces two SMS: the funding bank ("12,012 sent to ••2016")
 * and the card bank ("payment of 12,000 received"). The funding leg is reclassified to
 * `own_transfer` by dispatch — because the counterparty last4 matches the user's own
 * registered card — and posts a Transfer row. That row and the payoff are the SAME money,
 * which is why the user saw the payoff twice.
 *
 * The payoff row is the better representation (it drives the debt payment), so the funding
 * leg's row is retired here. Its value before it goes: it is the ONLY place the funding
 * account appears — the card bank's SMS carries the CARD's last4, not the source.
 */
export async function reconcileCcPayoffFundingLeg(
  service: SupabaseClient,
  sibling: PairSibling,
): Promise<CcPayoffFundingLeg> {
  const { data: log } = await service
    .from('sms_parse_log')
    .select('amount, account_last4')
    .eq('id', sibling.siblingId)
    .maybeSingle()

  if (sibling.siblingExpenseId) {
    await service
      .from('expenses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', sibling.siblingExpenseId)
    await service
      .from('sms_parse_log')
      .update({ status: 'paired', expense_id: null })
      .eq('id', sibling.siblingId)
  }
  // A funding leg misread as income would inflate income; retire it too.
  if (sibling.siblingIncomeId) {
    await service
      .from('income_sources')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', sibling.siblingIncomeId)
    await service
      .from('sms_parse_log')
      .update({ status: 'paired', income_id: null })
      .eq('id', sibling.siblingId)
  }

  return {
    fundingLast4: (log?.account_last4 as string | null) ?? null,
    fundingAmount: (log?.amount as number | null) ?? null,
  }
}

/**
 * Reconciles a found sibling so the pair is represented by exactly ONE non-spend
 * row. Returns `needsPost`:
 *  - false when the sibling already holds a usable non-spend expense (keep it,
 *    suppress the current leg).
 *  - true when the sibling was posted as INCOME (now soft-deleted) and the
 *    current leg should post a single non-spend Transfer/FX expense for visibility.
 */
export async function reconcileSibling(
  service: SupabaseClient,
  sibling: PairSibling,
): Promise<{ needsPost: boolean }> {
  if (sibling.siblingIncomeId) {
    await service
      .from('income_sources')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', sibling.siblingIncomeId)
    await service
      .from('sms_parse_log')
      .update({ status: 'paired', income_id: null })
      .eq('id', sibling.siblingId)
    return { needsPost: true }
  }
  // Sibling already carries the (non-spend) expense representation; keep it.
  return { needsPost: false }
}
