/**
 * Do these counterparty digits name one of the user's own accounts? (S2c step 3, N5; docs/launch/S2c-invariants.md,
 * signals `account` and `registered`.)
 *
 * Uses the same alias- and length-aware match the account resolver uses (`matchByTail`): an account saved as 0001
 * answers to a tail printed as 001, and an account answers to the numbers in its `last4_aliases` (a merged
 * provisional account keeps its old digits there). Closed accounts never answer.
 */
import type { ServiceClient } from '@/lib/supabase/service'
import { matchByTail, type Identified } from '@/lib/accounts/identity/accountRef'
import { decomposePaymentMethodName, resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'

export interface OwnAccountRow {
  id: string
  name: string | null
  last4: string | null
  last4_aliases?: string[] | null
  provisional?: boolean | null
  closed_at?: string | null
}

export interface OwnAccountMatch {
  /** At least one open account of the user answers to the tail, provisional ones included. */
  account: boolean
  /** Exactly one open, confirmed (not provisional) account answers to the tail. Two or more is not registered. */
  registered: boolean
  /** The account `registered` found. */
  registeredId: string | null
}

export const NO_OWN_ACCOUNT: OwnAccountMatch = { account: false, registered: false, registeredId: null }

const identify = (m: OwnAccountRow): Identified => ({
  id: m.id,
  last4: m.last4,
  last4Aliases: m.last4_aliases,
  bankKey: resolvePaymentBrandKey(decomposePaymentMethodName((m.name ?? '').trim(), m.last4 ?? undefined).provider) ?? resolvePaymentBrandKey(m.name),
})

/**
 * Pure decision over the user's non-deleted accounts. `smsBankKey` is the bank of the message being read, as the
 * account resolver uses it: a 2-3 digit or partial tail is only taken when that bank is the account's bank.
 */
export function matchOwnAccount(accounts: readonly OwnAccountRow[], tail: string | null | undefined, smsBankKey?: string | null): OwnAccountMatch {
  if (!tail) return NO_OWN_ACCOUNT
  const open = accounts.filter((m) => !m.closed_at)
  const any = matchByTail(open.map(identify), tail, smsBankKey)
  const confirmed = matchByTail(open.filter((m) => !m.provisional).map(identify), tail, smsBankKey)
  return { account: any.id !== null || any.ambiguous, registered: confirmed.id !== null, registeredId: confirmed.id }
}

/** Reads the user's accounts once and decides. A failed read answers "no": nothing is settled on an unread fact. */
export async function readOwnAccount(service: ServiceClient, userId: string, tail: string | null | undefined, smsBankKey?: string | null): Promise<OwnAccountMatch> {
  if (!tail) return NO_OWN_ACCOUNT
  const { data, error } = await service
    .from('payment_methods')
    .select('id, name, last4, last4_aliases, provisional, closed_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
  if (error) {
    console.warn('[sms/ownAccounts] account lookup failed', error.message)
    return NO_OWN_ACCOUNT
  }
  return matchOwnAccount((data ?? []) as OwnAccountRow[], tail, smsBankKey)
}

/**
 * The pair of tails a one-leg transfer's remembered answer is stored under. The message's own tail may be unknown, so
 * '-' stands in for it: the answer is then still stored and found. '-' sorts before every digit, as the stored pair's
 * ordering needs.
 */
export const UNKNOWN_OWN_TAIL = '-'
export const oneLegTails = (ownTail: string | null | undefined, counterpartyTail: string): [string, string] => [ownTail || UNKNOWN_OWN_TAIL, counterpartyTail]
