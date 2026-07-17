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
import {
  PAYMENT_BRANDS,
  decomposePaymentMethodName,
  isPassThroughBrand,
  normalizeBrandToken,
  resolvePaymentBrandKey,
} from '@/lib/payment/paymentMethodDefaults'

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

/**
 * Explicit "money is being loaded" wording, EN + AR. Only consulted for brands you can
 * also buy from (see {@link AlsoMerchantBrand}) — a tank of fuel and a card reload both
 * come from ADNOC, and only this tells them apart. Deliberately excludes a bare "load",
 * which shows up in unrelated wording too often to be a signal.
 */
const TOP_UP_WORDING = /\btop[\s-]?up\b|\btopup\b|\breload\b|\brecharge\b|شحن|تعبئة/i

interface StoredValueMethod {
  provider: string
  alsoMerchant: boolean
}

/**
 * The user's own methods that actually HOLD a balance — wallets and prepaid cards.
 *
 * These are the only things that can be topped up, and the only ones whose top-up needs
 * name matching at all: a bank or card leg is identified by last4 via
 * {@link isOwnAccountTransfer}. A wallet may have no card, so the NAME is often the only
 * handle an SMS gives us. Three filters keep that handle honest:
 *  - pass-through brands are dropped: Apple Pay and InstaPay are `type: 'wallet'` and sit
 *    in the SA/AE/EG quick-add lists, but hold no balance, so "topping one up" is not a
 *    thing and treating a payment through one as a transfer would erase real spend.
 *  - the " · tag" and " ••1234" suffixes are stripped, so "Barq · Personal" and
 *    "Telda ••1234" still match as "Barq" / "Telda". Wallets carry a last4 now, because a
 *    wallet's card is part of the wallet — so the last4 form is normal, not an edge case.
 *  - names under 3 chars are too generic to match safely.
 */
async function ownStoredValueMethods(
  service: SupabaseClient,
  userId: string,
): Promise<StoredValueMethod[]> {
  const { data } = await service
    .from('payment_methods')
    .select('name, last4')
    .eq('user_id', userId)
    .in('type', ['wallet', 'prepaid_card'])
    .is('deleted_at', null)
  return (data ?? [])
    .map((m) => {
      const raw = (m.name as string | null)?.trim() ?? ''
      const provider = decomposePaymentMethodName(raw, (m.last4 as string | null) ?? undefined).provider
      const brandId = resolvePaymentBrandKey(provider)
      return {
        provider,
        alsoMerchant: brandId ? PAYMENT_BRANDS[brandId].alsoMerchant === true : false,
        passThrough: isPassThroughBrand(provider),
      }
    })
    .filter((m) => m.provider.length >= 3 && !m.passThrough)
}

/**
 * True when `merchant` IS one of the user's own stored-value methods — i.e. this leg is
 * the funding side of a top-up rather than a purchase.
 *
 * Compares the WHOLE merchant string, never a substring and never via brand aliases:
 * `careem` is a catalogue alias of the Careem Pay wallet, so alias matching would turn
 * every ride into a transfer, and substring matching would do the same to a shop called
 * "Lucky Market". Exact matching fails safe — an unrecognised top-up just stays spend,
 * which is only the status quo.
 *
 * For a brand you can also buy FROM, an exact merchant hit is still ambiguous (fuel at
 * ADNOC vs reloading the ADNOC card), so those additionally require {@link TOP_UP_WORDING}.
 * For everything else the hit is unambiguous: nobody buys goods from their own wallet.
 */
export async function isOwnTopUpTarget(
  service: SupabaseClient,
  userId: string,
  merchant: string | null,
  body: string | null,
): Promise<boolean> {
  if (!merchant) return false
  const norm = normalizeBrandToken(merchant)
  if (!norm) return false
  const hit = (await ownStoredValueMethods(service, userId)).find(
    (m) => normalizeBrandToken(m.provider) === norm,
  )
  if (!hit) return false
  return hit.alsoMerchant ? TOP_UP_WORDING.test(body ?? '') : true
}

/**
 * True when `text` mentions one of the user's own stored-value methods — the wallet's own
 * SMS ("Money Added to your Barq wallet", "Withdrawal from your Barq wallet").
 *
 * Word-boundary rather than exact, because here the name sits inside a sentence ("Barq"
 * must not fire on "Barqawi"). Safe to be lenient where {@link isOwnTopUpTarget} is not:
 * the caller treats this leg as a transfer only once a sibling proves the pair, and
 * otherwise books it as income or a remittance exactly as before.
 */
export async function namesOwnStoredValue(
  service: SupabaseClient,
  userId: string,
  text: string | null,
): Promise<boolean> {
  if (!text) return false
  const methods = await ownStoredValueMethods(service, userId)
  return methods.some((m) => {
    const escaped = m.provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i').test(text)
  })
}

/**
 * Retags a sibling's expense as a non-spend Transfer.
 *
 * Needed because the FIRST leg of a two-leg movement must commit before it can know: a
 * wallet debit is booked `Remittance` (spend) on the assumption it went to a real person,
 * which is the safe guess — most do. When the matching credit into the user's OWN account
 * lands, that guess is disproved, and the surviving row would otherwise count a withdrawal
 * to your own bank as spending.
 *
 * Scoped to the caller's `instant_transfer_out` case on purpose: an FX sibling must stay
 * `Currency Exchange`, and a `cc_payoff` sibling must stay a payoff.
 */
export async function retagSiblingAsTransfer(
  service: SupabaseClient,
  sibling: PairSibling,
): Promise<void> {
  if (!sibling.siblingExpenseId) return
  await service
    .from('expenses')
    .update({ category: 'Transfer' })
    .eq('id', sibling.siblingExpenseId)
}

export interface PairSibling {
  siblingId: string
  siblingKind: string
  siblingExpenseId: string | null
  siblingIncomeId: string | null
  siblingStatus: string
}

/**
 * Absolute slack for two reports of the SAME movement that a transfer fee separates.
 *
 * A CC payoff by Instapay debits the funding bank for the amount PLUS a fee (12,012 vs
 * 12,000), so exact equality never matches. Bounded so it stays a fee allowance and cannot
 * start pairing unrelated similar amounts.
 *
 * Deliberately NOT keyed on the caller's kind: the tolerance belongs to the PAIR, and the
 * caller cannot know what it will be paired with. The RPC applies it only when one of the
 * two legs is a `cc_payoff`, so own_transfer <-> own_transfer still matches exactly.
 */
export function transferFeeTolerance(amount: number): number {
  return Math.min(Math.max(amount * 0.02, 25), 250)
}

/**
 * Atomically claims an unpaired sibling leg.
 *
 * Symmetric by design — either leg of a CC payoff may arrive first. SMS delivery order is
 * not guaranteed: SmsForwardWorker retries with WorkManager backoff on a 502 or on network
 * loss, so the leg the bank sent first can land second.
 */
export async function tryPairLeg(
  service: SupabaseClient,
  params: { userId: string; logId: string; receivedAtIso: string; amount: number; kind: SmsExpenseKind },
): Promise<PairSibling | null> {
  const requireEqual = params.kind === 'own_transfer' || params.kind === 'cc_payoff'
  // FX pairs with FX. Everything else pairs across the transfer/payoff family, in both
  // directions: a cc_payoff finds its funding leg, and a funding leg finds its payoff.
  // The funding leg reports as an outbound transfer, which dispatch reclassifies to
  // own_transfer when the counterparty last4 is the user's own registered card.
  const matchKinds =
    params.kind === 'currency_exchange'
      ? ['currency_exchange']
      : params.kind === 'cc_payoff'
        ? ['own_transfer', 'instant_transfer_out']
        : ['own_transfer', 'instant_transfer_in', 'instant_transfer_out', 'cc_payoff']

  const { data, error } = await service.rpc('sms_try_pair', {
    p_user_id: params.userId,
    p_log_id: params.logId,
    p_received_at: params.receivedAtIso,
    p_window_seconds: PAIR_WINDOW_SECONDS,
    p_amount: params.amount,
    p_require_equal_amount: requireEqual,
    p_match_kinds: matchKinds,
    // Always offered; the RPC ignores it unless a cc_payoff is on one side of the pair.
    p_amount_tolerance: transferFeeTolerance(params.amount),
    p_self_kind: params.kind ?? null,
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
      .from('income_events')
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

export interface PayoffAttribution {
  /** The payoff's own amount, so the caller can difference out the fee. */
  payoffAmount: number | null
}

/**
 * Mirror of {@link reconcileCcPayoffFundingLeg}, for when the FUNDING leg arrives second.
 *
 * The payoff leg already posted its CC Payoff expense + debt payment, but had no sibling
 * at the time — so it could not know the funding account and fell back to null ("Cash").
 * This leg is the only place that account appears, so it is back-filled onto both rows
 * here. The result is identical whichever leg lands first.
 */
export async function attributeFundingToPayoff(
  service: SupabaseClient,
  sibling: PairSibling,
  fundingPaymentMethodId: string | null,
): Promise<PayoffAttribution> {
  const { data: log } = await service
    .from('sms_parse_log')
    .select('amount, debt_payment_id')
    .eq('id', sibling.siblingId)
    .maybeSingle()

  if (fundingPaymentMethodId) {
    if (sibling.siblingExpenseId) {
      await service
        .from('expenses')
        .update({ payment_method_id: fundingPaymentMethodId })
        .eq('id', sibling.siblingExpenseId)
    }
    const debtPaymentId = log?.debt_payment_id as string | null | undefined
    if (debtPaymentId) {
      await service
        .from('debt_payments')
        .update({ payment_method_id: fundingPaymentMethodId })
        .eq('id', debtPaymentId)
    }
  }

  return { payoffAmount: (log?.amount as number | null) ?? null }
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
    // income_events, NOT income_sources: sms_parse_log.income_id points at the EVENT
    // (the money actually received); income_sources holds the recurring templates.
    // Soft-deleting the template table matched zero rows and reported no error, so the
    // phantom income leg survived every pairing this function was written to retract.
    await service
      .from('income_events')
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
