/**
 * Links an online/purchase SMS to a tracked subscription (Netflix, Spotify, …).
 * Matches the parsed merchant → brand key, then confirms with a currency-aware
 * amount check (subs are often billed in USD while the SMS is EGP/AED). A strong
 * merchant match stands alone when no FX rate is available.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveBrandKeyFromMerchant } from '@/lib/constants/subscriptionCatalog'
import { tryConvertCurrency } from '@/lib/utils/currency'

const AMOUNT_TOLERANCE = 0.05 // ±5%

export async function matchSubscription(
  service: SupabaseClient,
  params: {
    userId: string
    merchant: string | null
    merchantNormalized: string | null
    amount: number
    currency: string
    exchangeRates: Record<string, number>
  },
): Promise<{ subscriptionId: string } | null> {
  const brandKey =
    resolveBrandKeyFromMerchant(params.merchantNormalized) ??
    resolveBrandKeyFromMerchant(params.merchant)
  if (!brandKey) return null

  const { data: subs } = await service
    .from('subscriptions')
    .select('id, amount, currency, brand_key, status')
    .eq('user_id', params.userId)
    .eq('brand_key', brandKey)
    .eq('status', 'active')
    .is('deleted_at', null)

  const candidates = subs ?? []
  if (candidates.length === 0) return null

  for (const sub of candidates) {
    if (!sub.amount) return { subscriptionId: sub.id } // brand match, no amount to check
    const smsInSubCurrency =
      sub.currency === params.currency
        ? params.amount
        : tryConvertCurrency(params.amount, params.currency, sub.currency as string, params.exchangeRates)
    if (smsInSubCurrency == null) return { subscriptionId: sub.id } // strong brand match, no FX
    if (Math.abs(smsInSubCurrency - sub.amount) / sub.amount <= AMOUNT_TOLERANCE) {
      return { subscriptionId: sub.id }
    }
  }
  // Brand matched but amount diverged — still link to the single candidate.
  return candidates.length === 1 ? { subscriptionId: candidates[0].id } : null
}
