import { resolveBrandKeyFromMerchant } from '@/lib/constants/subscriptionCatalog'
import type { Expense, Subscription } from '@/lib/store/types'
import type { DetectedSubscription } from './detectRecurringCharges'

export interface SmsFind extends DetectedSubscription {
  /** An existing subscription of this brand that has never been matched to a charge: link to it instead of adding a duplicate. */
  match: Subscription | null
}

/** `subnot:<brandKey>` — the key a "Not a subscription" answer is remembered under. */
export const notASubscriptionKey = (brandKey: string) => `subnot:${brandKey}`

/**
 * What the review sheet lists. A find for a brand the user already tracks is only useful when
 * that subscription has never had a charge linked (a manual entry); once charges link on
 * their own there is nothing to ask. Cancelled brands and answered "not a subscription"
 * finds stay out.
 */
export function buildSmsFinds(
  detected: DetectedSubscription[],
  subscriptions: Subscription[],
  expenses: Pick<Expense, 'linkedSubscriptionId'>[],
  dismissed: ReadonlySet<string>
): SmsFind[] {
  const linked = new Set(expenses.flatMap((e) => (e.linkedSubscriptionId ? [e.linkedSubscriptionId] : [])))
  return detected.flatMap((d) => {
    if (dismissed.has(notASubscriptionKey(d.brandKey))) return []
    const same = subscriptions.filter((s) => s.brandKey === d.brandKey)
    if (same.some((s) => s.status === 'cancelled')) return []
    const live = same.find((s) => s.status !== 'paused')
    if (live && linked.has(live.id)) return []
    return [{ ...d, match: live ?? null }]
  })
}

/** Brand keys that must not be re-suggested at all: cancelled subscriptions. */
export const cancelledBrandKeys = (subscriptions: Pick<Subscription, 'brandKey' | 'status'>[]) =>
  new Set(subscriptions.filter((s) => s.status === 'cancelled').map((s) => s.brandKey))

const AMOUNT_BAND = 0.15

/**
 * Past expenses that are this subscription's charges: same brand by merchant text, within the
 * amount band of the find, not already linked. Linking them is what "Link to Netflix" does.
 */
export function chargesToLink(
  find: Pick<SmsFind, 'brandKey' | 'amount'>,
  expenses: Pick<Expense, 'id' | 'description' | 'amount' | 'currency' | 'linkedSubscriptionId' | 'refundKind'>[],
  currency: string
): string[] {
  return expenses
    .filter(
      (e) =>
        !e.linkedSubscriptionId &&
        !e.refundKind &&
        e.currency === currency &&
        resolveBrandKeyFromMerchant(e.description) === find.brandKey &&
        Math.abs(e.amount - find.amount) / find.amount <= AMOUNT_BAND
    )
    .map((e) => e.id)
}
