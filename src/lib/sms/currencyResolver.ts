/**
 * Resolve the currency for a parsed SMS transaction. Egyptian/Gulf wallet SMS
 * frequently omit the currency literal, so we must never drop a clear
 * transaction for a missing currency — we backfill and, when the value is a
 * guess, mark it provisional so the user confirms it once (then we remember it
 * per (user, sender) and auto-resolve forever after).
 *
 * Order:
 *   1. Literal in the SMS body (parsed currency AND a currency token present).
 *   2. A confirmed (user, sender) learned mapping.
 *   3. An unconfirmed (user, sender) learned guess (still provisional).
 *   4. The user's profile base currency → fallback 'EGP'.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasCurrencyToken } from './patterns/currency'

export interface ResolvedCurrency {
  currency: string
  /** True when the value is a guess (sources 3–4) and should be user-confirmed. */
  provisional: boolean
}

export async function resolveCurrency(
  service: SupabaseClient,
  params: {
    userId: string
    sender: string | null
    rawBody: string
    parsedCurrency: string | null
  },
): Promise<ResolvedCurrency> {
  // 1. Trust a currency the model extracted only when the body actually contains
  //    a currency token — otherwise the model inferred it and we still confirm.
  if (params.parsedCurrency && hasCurrencyToken(params.rawBody)) {
    return { currency: params.parsedCurrency, provisional: false }
  }

  // 2 & 3. Learned per-(user, sender) mapping.
  if (params.sender) {
    const { data: learned } = await service
      .from('sms_sender_currency')
      .select('currency, confirmed')
      .eq('user_id', params.userId)
      .eq('sender', params.sender)
      .maybeSingle()
    if (learned?.currency) {
      return { currency: learned.currency, provisional: !learned.confirmed }
    }
  }

  // 4. Profile base currency → EGP.
  const { data: profile } = await service
    .from('profiles')
    .select('base_currency')
    .eq('id', params.userId)
    .maybeSingle()
  return { currency: (profile?.base_currency as string) ?? 'EGP', provisional: true }
}
