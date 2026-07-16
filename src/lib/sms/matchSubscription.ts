/**
 * Links an online/purchase SMS to a tracked subscription (Netflix, Spotify, …).
 *
 * Only ever fires for a subscription the user ALREADY tracks, so the sub row carries the
 * amount the user is really billed — better evidence than any catalog price. A match
 * therefore has to clear three gates: the merchant resolves to the brand, the amount
 * agrees (currency-aware — subs are often billed in USD while the SMS is EGP/AED), and the
 * charge lands near the expected billing date.
 *
 * The bar is high on purpose: a false positive both miscategorises a real purchase (the
 * caller force-overrides the category to `Subscription`) and corrupts the subscription's
 * payment history.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getDaysInMonth, parseISO } from 'date-fns'
import { resolveBrandKeyFromMerchant } from '@/lib/constants/subscriptionCatalog'
import { detectPlanChange } from '@/lib/subscriptions/planChange'
import type { Currency } from '@/lib/store/types'
import { tryConvertCurrency } from '@/lib/utils/currency'

export interface SubscriptionMatch {
  subscriptionId: string
  /** A different plan the charge matches. PROPOSED — the caller prompts, never applies. */
  planChange: { planId: string; planName: string; direction: 'upgrade' | 'downgrade' } | null
}

const AMOUNT_TOLERANCE = 0.05 // ±5%
/** How far from the billing day a charge may land and still be that cycle's charge. */
const BILLING_DAY_TOLERANCE = 5

/**
 * Distance in days between a charge date and a monthly billing day, the short way round
 * the month — a charge on the 28th for a sub billed on the 1st is 4 days early, not 27
 * days late. The billing day is clamped into the month first (a 31st sub in February).
 */
export function daysFromBillingDay(day: string, billingDay: number): number {
  const date = parseISO(day.slice(0, 10))
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY
  const daysInMonth = getDaysInMonth(date)
  const target = Math.min(Math.max(billingDay, 1), daysInMonth)
  const diff = Math.abs(date.getDate() - target)
  return Math.min(diff, daysInMonth - diff)
}

export async function matchSubscription(
  service: SupabaseClient,
  params: {
    userId: string
    merchant: string | null
    merchantNormalized: string | null
    amount: number
    currency: string
    day?: string | null
    exchangeRates: Record<string, number>
  },
): Promise<SubscriptionMatch | null> {
  const brandKey =
    resolveBrandKeyFromMerchant(params.merchantNormalized) ??
    resolveBrandKeyFromMerchant(params.merchant)
  if (!brandKey) return null

  const { data: subs } = await service
    .from('subscriptions')
    .select('id, amount, currency, brand_key, billing_day, status, plan_id, catalog_region')
    .eq('user_id', params.userId)
    .eq('brand_key', brandKey)
    .eq('status', 'active')
    .is('deleted_at', null)

  const candidates = subs ?? []
  if (candidates.length === 0) return null

  for (const sub of candidates) {
    // No amount recorded — the brand match is all we have to go on.
    if (!sub.amount) return { subscriptionId: sub.id, planChange: null }

    const smsInSubCurrency =
      sub.currency === params.currency
        ? params.amount
        : tryConvertCurrency(params.amount, params.currency, sub.currency as string, params.exchangeRates)
    // No FX path: a strong brand match stands alone rather than guessing on the amount.
    if (smsInSubCurrency == null) return { subscriptionId: sub.id, planChange: null }

    const agrees = Math.abs(smsInSubCurrency - sub.amount) / sub.amount <= AMOUNT_TOLERANCE

    // The amount diverged — but if it lands squarely on ANOTHER plan of the same brand,
    // this is the user changing plan, not an unrelated purchase. Without this, the ±5%
    // gate would drop a real Netflix upgrade (190 -> 270 is 43% off) and the charge would
    // lose its Subscription category too.
    const planChange = agrees
      ? null
      : detectPlanChange(
          {
            brandKey: sub.brand_key as string | null,
            catalogRegion: (sub.catalog_region as string | null) ?? null,
            currency: sub.currency as Currency,
            planId: (sub.plan_id as string | null) ?? null,
            amount: sub.amount,
          },
          smsInSubCurrency,
        )
    if (!agrees && !planChange) continue

    // Same brand AND a plausible amount, but nowhere near the billing date — a repeat
    // purchase that happens to cost the subscription price, not the subscription renewing.
    if (params.day && sub.billing_day && daysFromBillingDay(params.day, sub.billing_day) > BILLING_DAY_TOLERANCE) {
      continue
    }

    return {
      subscriptionId: sub.id,
      // Proposed only. The caller must ask — a proration or a provider price rise is not
      // the user switching plan, and silently rewriting their plan would be worse than
      // saying nothing.
      planChange: planChange
        ? { planId: planChange.plan.id, planName: planChange.plan.name, direction: planChange.direction }
        : null,
    }
  }

  // Brand matched but nothing agreed. Previously this returned the sole candidate anyway,
  // which made the amount check above dead code for the common one-sub-per-brand case: a
  // 2,000 EGP purchase would link to a 200 EGP Netflix sub and be booked as its payment.
  return null
}
