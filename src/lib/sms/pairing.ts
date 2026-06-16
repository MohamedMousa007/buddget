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
 * Atomically claims an unpaired sibling leg. `own_transfer` requires an equal
 * amount; `currency_exchange` does not (cross-currency amounts differ).
 */
export async function tryPairLeg(
  service: SupabaseClient,
  params: { userId: string; logId: string; receivedAtIso: string; amount: number; kind: SmsExpenseKind },
): Promise<PairSibling | null> {
  const requireEqual = params.kind === 'own_transfer'
  // FX pairs with FX; an own_transfer pairs with the opposite-direction transfer legs.
  const matchKinds =
    params.kind === 'currency_exchange'
      ? ['currency_exchange']
      : ['own_transfer', 'instant_transfer_in', 'instant_transfer_out']

  const { data, error } = await service.rpc('sms_try_pair', {
    p_user_id: params.userId,
    p_log_id: params.logId,
    p_received_at: params.receivedAtIso,
    p_window_seconds: PAIR_WINDOW_SECONDS,
    p_amount: params.amount,
    p_require_equal_amount: requireEqual,
    p_match_kinds: matchKinds,
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
