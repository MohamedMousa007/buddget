import type { PaymentMethodType } from '@/lib/store/types'

/**
 * Payment-method type inference from an SMS body.
 *
 * Only the curated pattern tier sets `sms_parse_log.payment_instrument`, so for
 * every bank without a curated pattern set (the AI tier — the majority of rows)
 * it is null and a detected account would otherwise default to `bank_account`.
 * The body itself carries the signal on every tier and both platforms ("Mada
 * card", "بطاقة الخصم المباشر", "Adding money to account"), and unlike the
 * curated `paymentInstrument: 'card'` it distinguishes debit from credit.
 */

/** Ordered — first hit wins. Card before account: a "Mada card … A/C: **207" SMS is a card transaction. */
const TYPE_RULES: [RegExp, PaymentMethodType][] = [
  [/credit\s*card|بطاقة\s*(?:ال)?ائتمان|بطاقة\s+ائتمانية/i, 'credit_card'],
  [/debit\s*card|mada\s*card|\bmada\b|meeza|بطاقة\s*(?:ال)?خصم|بطاقة\s+الخصم\s+المباشر|ميزة/i, 'debit_card'],
  [/prepaid\s*card|بطاقة\s+مسبقة\s+الدفع/i, 'prepaid_card'],
  [/\bwallet\b|محفظة|cash\s*wallet/i, 'wallet'],
  [/\bcard\b|بطاقة/i, 'debit_card'],
  [/\baccount\b|\bA\/C\b|حساب/i, 'bank_account'],
]

/** Curated-tier instrument — coarser than the body (no debit/credit split), so it only fills the gaps. */
const INSTRUMENT_TYPE: Record<string, PaymentMethodType> = {
  card: 'debit_card',
  account: 'bank_account',
  wallet: 'wallet',
}

/**
 * Type implied by an SMS, else null (the sheet then falls back to the brand's
 * default). Body first — it is the more specific signal and is present on every
 * tier; the curated instrument is the fallback.
 */
export function paymentTypeFromSms(
  body: string | null,
  instrument: string | null,
): PaymentMethodType | null {
  if (body) {
    for (const [re, type] of TYPE_RULES) if (re.test(body)) return type
  }
  return instrument ? INSTRUMENT_TYPE[instrument] ?? null : null
}
