import {
  findBrandByKey,
  plansForRegion,
  type CatalogRegion,
  type SubscriptionPlan,
} from '@/lib/constants/subscriptionCatalog'
import type { Subscription } from '@/lib/store/types'

/** A charge within this of a plan's price is that plan. Matches matchSubscription's band. */
const PLAN_MATCH_TOLERANCE = 0.05

export interface PlanChange {
  /** The plan the charge matches — never applied automatically. */
  plan: SubscriptionPlan
  direction: 'upgrade' | 'downgrade'
}

/**
 * Which catalog plan does a charge correspond to?
 *
 * Compared against the region the subscription was PRICED against (`catalogRegion`), not
 * wherever the user is now — someone who set up Netflix in Egypt and later travels does not
 * change plan by moving.
 */
export function planForAmount(
  sub: Pick<Subscription, 'brandKey' | 'catalogRegion' | 'currency'>,
  amount: number,
): SubscriptionPlan | null {
  const brand = findBrandByKey(sub.brandKey)
  if (!brand || !sub.catalogRegion) return null
  const plans = plansForRegion(brand, sub.catalogRegion as CatalogRegion)
  return (
    plans.find((p) => {
      // A plan quoted in a fixed currency (USD software) is only comparable to a charge in
      // that same currency; converting here would invent precision we do not have.
      const planCurrency = p.currency ?? sub.currency
      if (planCurrency !== sub.currency) return false
      return Math.abs(amount - p.amount) / p.amount <= PLAN_MATCH_TOLERANCE
    }) ?? null
  )
}

/**
 * Did a charge indicate the user moved to a DIFFERENT plan?
 *
 * Returns null unless the charge confidently matches another plan of the same brand — a
 * price that simply differs (a promo, a proration, a provider price rise) is NOT a plan
 * change, and guessing otherwise would rewrite what the user told us they are on.
 *
 * The caller must prompt rather than apply. This function only proposes.
 */
export function detectPlanChange(
  sub: Pick<Subscription, 'brandKey' | 'catalogRegion' | 'currency' | 'planId' | 'amount'>,
  chargedAmount: number,
): PlanChange | null {
  if (!sub.planId) return null // nothing to compare against
  const matched = planForAmount(sub, chargedAmount)
  if (!matched || matched.id === sub.planId) return null
  return { plan: matched, direction: chargedAmount > sub.amount ? 'upgrade' : 'downgrade' }
}
