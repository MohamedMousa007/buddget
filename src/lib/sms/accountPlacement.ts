/**
 * Where a bank message's money sits when the user has not registered the account it names.
 *
 * Decision 6a.1 of docs/launch/S1-sms-audit.md: an account is created for the user only when the message gives all
 * three of bank, account digits and currency. It is marked provisional (out of balances and net worth until the user
 * confirms, renames or merges it). Anything less stays unassigned, which the app shows as "Unassigned", never "Cash".
 */
import type { ServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/database.types'
import { digitsOf, matchByTail, MIN_PARTIAL_DIGITS, type Identified } from '@/lib/accounts/identity/accountRef'
import { PAYMENT_BRANDS, composePaymentMethodName, prefillPaymentType } from '@/lib/payment/paymentMethodDefaults'
import { paymentTypeFromSms } from '@/lib/payment/smsPaymentType'
import { toSupportedCurrency } from './ingestGuards'

export interface SmsAccountRef {
  /** Visible digits of the account the message names as its own. */
  tail: string | null | undefined
  /** Brand key of the bank or wallet that sent it (resolvePaymentBrandKey). */
  bankKey: string | null | undefined
  currency: string | null | undefined
}

export interface ProvisionalSpec {
  bankKey: string
  tail: string
  currency: Database['public']['Enums']['currency_code']
}

export type Placement =
  | { kind: 'existing'; id: string }
  /** Several registered accounts fit: nothing is picked and nothing is created. */
  | { kind: 'ambiguous' }
  | ({ kind: 'provisional' } & ProvisionalSpec)
  | { kind: 'unassigned' }

/** The account to create, or null when any of bank, digits or currency is missing (digits: at least three, fewer is noise). */
export function provisionalSpec(sms: SmsAccountRef): ProvisionalSpec | null {
  const tail = digitsOf(sms.tail)
  const currency = toSupportedCurrency(sms.currency ?? '')
  if (!sms.bankKey || !PAYMENT_BRANDS[sms.bankKey] || tail.length < MIN_PARTIAL_DIGITS || !currency) return null
  // A rail that only forwards money (Apple Pay, InstaPay) holds no balance: there is no account to create.
  if (PAYMENT_BRANDS[sms.bankKey].passThrough) return null
  return { bankKey: sms.bankKey, tail, currency }
}

/** Registered account first (provisional ones included, so a second message lands on the first one's account). */
export function placeSmsAccount(methods: readonly Identified[], sms: SmsAccountRef): Placement {
  const match = matchByTail(methods, sms.tail, sms.bankKey)
  if (match.id) return { kind: 'existing', id: match.id }
  if (match.ambiguous) return { kind: 'ambiguous' }
  const spec = provisionalSpec(sms)
  return spec ? { kind: 'provisional', ...spec } : { kind: 'unassigned' }
}

/** Display name, which is also the dedupe identity (bank + digits; currency is the third index column). */
export const provisionalName = (spec: ProvisionalSpec): string =>
  composePaymentMethodName(PAYMENT_BRANDS[spec.bankKey].name, { last4: spec.tail })

const UNIQUE_VIOLATION = '23505'

/**
 * Finds or creates the provisional account for this bank + digits + currency. Idempotent: a concurrent message that
 * creates it first trips the unique index and this call returns that row. Never throws; null means "leave unassigned".
 */
export async function ensureProvisionalAccount(
  service: ServiceClient,
  userId: string,
  spec: ProvisionalSpec,
  hint: { rawBody?: string | null } = {},
): Promise<string | null> {
  const name = provisionalName(spec)
  const existing = () => service
    .from('payment_methods')
    .select('id')
    .eq('user_id', userId)
    .eq('provisional', true)
    .eq('currency', spec.currency)
    .ilike('name', name)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  try {
    const brand = PAYMENT_BRANDS[spec.bankKey]
    const { data, error } = await service
      .from('payment_methods')
      .insert({
        user_id: userId,
        name,
        type: prefillPaymentType(hint.rawBody ? paymentTypeFromSms(hint.rawBody, null) : null, brand),
        currency: spec.currency,
        last4: spec.tail,
        color: brand.colors[0],
        is_default: false,
        provisional: true,
      })
      .select('id')
      .single()
    if (data?.id) return data.id
    if (error?.code === UNIQUE_VIOLATION) return (await existing()).data?.id ?? null
    if (error) console.warn('[sms/account] provisional create failed', error.message)
    return null
  } catch (e) {
    console.warn('[sms/account] provisional create failed', e)
    return null
  }
}
