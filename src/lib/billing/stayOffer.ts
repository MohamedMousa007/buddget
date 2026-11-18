/**
 * Stay (retention) offers, docs/launch/STORE_SETUP.md: shown once when a store subscriber taps to cancel. Pure rules;
 * the route reads the state from `stay_offer_state` and the webhook marks a redemption it can see.
 * Rules the app enforces (Apple does not): one redemption per account per lifetime, no offer within 30 days of a lapse.
 */

export const STAY_OFFERS = { pro_monthly: 'stay30_2m', pro_annual: 'stay_annual_20' } as const
export type StayOfferId = (typeof STAY_OFFERS)[keyof typeof STAY_OFFERS]

const STAY_IDS: ReadonlySet<string> = new Set(Object.values(STAY_OFFERS))

/** The offer for a Plus product id (`pro_annual:base` on Play counts as annual); null for anything else. */
export function stayOfferFor(productId: string | null): { offerId: StayOfferId; productId: 'pro_monthly' | 'pro_annual' } | null {
  if (!productId) return null
  if (productId.startsWith('pro_annual')) return { offerId: STAY_OFFERS.pro_annual, productId: 'pro_annual' }
  if (productId.startsWith('pro_monthly')) return { offerId: STAY_OFFERS.pro_monthly, productId: 'pro_monthly' }
  return null
}

export const isStayOffer = (id: string | null): id is StayOfferId => id !== null && STAY_IDS.has(id)

export interface StayOfferState {
  status: string | null
  source: string | null
  product_id: string | null
  redeemed_at: string | null
  lapsed_recently: boolean
}

export type StayOfferAnswer = { eligible: false } | { eligible: true; offerId: StayOfferId; productId: 'pro_monthly' | 'pro_annual' }

/** Eligible: a store subscription that still runs (active, or canceled but inside the paid period), never redeemed, no expiry in the last 30 days. */
export function stayEligibility(state: StayOfferState | null): StayOfferAnswer {
  if (!state || state.redeemed_at || state.lapsed_recently) return { eligible: false }
  if (state.source !== 'apple' && state.source !== 'google') return { eligible: false }
  if (state.status !== 'active' && state.status !== 'canceled') return { eligible: false }
  const offer = stayOfferFor(state.product_id)
  return offer ? { eligible: true, ...offer } : { eligible: false }
}
