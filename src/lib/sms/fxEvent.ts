/**
 * A currency exchange is ONE event with two bank messages: a debit in one currency and a credit in another, in either
 * order (docs/launch/S1-sms-audit.md RC-D). It is booked as one non-spend row whose source is the debited account and
 * whose destination is the credited one. The credited account is never booked as the account the money left.
 */
import type { MoneyDirection } from './directionGuard'
import { tryConvertCurrency } from '@/lib/utils/currency'

export type FxLegAction =
  /** No row exists yet: post it, with this message's account in the named role. */
  | { type: 'post'; role: 'source' | 'destination' }
  /** The other leg already posted the row: fill in this message's side of it and post nothing. */
  | { type: 'complete'; set: 'source' | 'destination' }

/**
 * What one leg does. A leg whose direction cannot be read is treated as the debit side, which is what the pairing
 * function assumes too (it never pairs an unreadable leg, so such a leg always posts on its own).
 */
export function fxLegAction(direction: MoneyDirection | null, siblingHasRow: boolean): FxLegAction {
  const side = direction === 'credit' ? 'destination' : 'source'
  return siblingHasRow ? { type: 'complete', set: side } : { type: 'post', role: side }
}

/** How far the two legs of one exchange may sit from the reference rate (bank spread plus the rate's age). */
export const FX_PAIR_RATE_MARGIN = 0.03

export interface FxLegFacts { amount: number; currency: string | null; last4: string | null }

/**
 * True when two opposite legs can be one exchange: they name different accounts, and one amount converted at the
 * reference rate lands within FX_PAIR_RATE_MARGIN of the other. With no rate for the two currencies the amounts
 * cannot be judged and the pair stands, as before (QA-37).
 */
export function fxLegsAgree(a: FxLegFacts, b: FxLegFacts, rates: Record<string, number>): boolean {
  if (a.last4 && b.last4 && a.last4 === b.last4) return false
  if (!a.currency || !b.currency || !(b.amount > 0)) return true
  const converted = tryConvertCurrency(a.amount, a.currency, b.currency, rates)
  if (converted == null) return true
  return Math.abs(converted - b.amount) / b.amount <= FX_PAIR_RATE_MARGIN
}
