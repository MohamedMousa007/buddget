/**
 * A currency exchange is ONE event with two bank messages: a debit in one currency and a credit in another, in either
 * order (docs/launch/S1-sms-audit.md RC-D). It is booked as one non-spend row whose source is the debited account and
 * whose destination is the credited one. The credited account is never booked as the account the money left.
 */
import type { MoneyDirection } from './directionGuard'

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
