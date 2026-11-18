import { describe, expect, it } from 'vitest'
import { parseEvent, planEffects } from './revenuecat'
import { stayEligibility, stayOfferFor, type StayOfferState } from './stayOffer'

const state = (over: Partial<StayOfferState> = {}): StayOfferState => ({ status: 'active', source: 'apple', product_id: 'pro_monthly', redeemed_at: null, lapsed_recently: false, ...over })

describe('stayEligibility', () => {
  it('offers the monthly and the annual stay offer to a running store subscription', () => {
    expect(stayEligibility(state())).toEqual({ eligible: true, offerId: 'stay30_2m', productId: 'pro_monthly' })
    expect(stayEligibility(state({ product_id: 'pro_annual:base', source: 'google', status: 'canceled' }))).toEqual({ eligible: true, offerId: 'stay_annual_20', productId: 'pro_annual' })
  })
  it('never twice: a redemption stamp ends it for life', () => {
    expect(stayEligibility(state({ redeemed_at: '2026-01-01T00:00:00Z' }))).toEqual({ eligible: false })
  })
  it('not within 30 days of a lapse, not without a store subscription, not for an unknown product', () => {
    expect(stayEligibility(state({ lapsed_recently: true }))).toEqual({ eligible: false })
    expect(stayEligibility(state({ status: 'expired' }))).toEqual({ eligible: false })
    expect(stayEligibility(state({ status: 'trialing', source: 'trial' }))).toEqual({ eligible: false })
    expect(stayEligibility(state({ source: 'promo' }))).toEqual({ eligible: false })
    expect(stayEligibility(state({ product_id: 'sparks_200' }))).toEqual({ eligible: false })
    expect(stayEligibility(null)).toEqual({ eligible: false })
  })
  it('maps products to offers', () => {
    expect(stayOfferFor('pro_annual')?.offerId).toBe('stay_annual_20')
    expect(stayOfferFor(null)).toBeNull()
  })
})

describe('webhook marking', () => {
  const USER = '11111111-1111-4111-8111-111111111111'
  const T0 = Date.UTC(2026, 11, 1)
  const body = (over: Record<string, unknown>) => ({ event: { type: 'RENEWAL', id: 'e1', app_user_id: USER, product_id: 'pro_monthly', store: 'APP_STORE', event_timestamp_ms: T0, purchased_at_ms: T0, expiration_at_ms: T0 + 30 * 86_400_000, ...over } })
  const effect = (over: Record<string, unknown>) => {
    const out = planEffects(parseEvent(body(over))!)
    if (out === 'ignore') throw new Error('ignored')
    return out
  }
  it('reads the offer from offer_code, else discount_identifier', () => {
    expect(parseEvent(body({ offer_code: 'stay30_2m' }))?.offerId).toBe('stay30_2m')
    expect(parseEvent(body({ discount_identifier: 'stay_annual_20' }))?.offerId).toBe('stay_annual_20')
    expect(parseEvent(body({}))?.offerId).toBeNull()
  })
  it('a renewal or first purchase carrying a stay offer marks it; any other offer or event does not', () => {
    expect(effect({ offer_code: 'stay30_2m' }).stayOffer).toBe('stay30_2m')
    expect(effect({ type: 'INITIAL_PURCHASE', offer_code: 'stay_annual_20', product_id: 'pro_annual' }).stayOffer).toBe('stay_annual_20')
    expect(effect({ offer_code: 'SUMMER10' }).stayOffer).toBeUndefined()
    expect(effect({})).not.toHaveProperty('stayOffer')
    expect(effect({ type: 'UNCANCELLATION', offer_code: 'stay30_2m' }).stayOffer).toBeUndefined()
  })
})
