import { describe, expect, it } from 'vitest'
import { parseEvent, planEffects, type RcEvent } from './revenuecat'

const USER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const DAY = 86_400_000
const T0 = Date.UTC(2026, 11, 1)

const ev = (over: Partial<RcEvent> = {}): RcEvent => ({
  type: 'INITIAL_PURCHASE', id: 'evt-1', appUserId: USER, eventMs: T0, productId: 'pro_monthly', store: 'app_store',
  purchasedMs: T0, expirationMs: T0 + 30 * DAY, graceMs: null, cancelReason: null, originalTxn: 'txn-1', transferredFrom: [], transferredTo: [], transactionId: null, priceMicros: null, currency: null, ...over,
})
const plan = (e: RcEvent, source?: Parameters<typeof planEffects>[1]) => {
  const out = planEffects(e, source)
  if (out === 'ignore') throw new Error('ignored')
  return out
}

describe('parseEvent', () => {
  it('reads a RevenueCat webhook body', () => {
    const body = { api_version: '1.0', event: { type: 'RENEWAL', id: 'e1', app_user_id: USER, product_id: 'pro_annual:base', store: 'PLAY_STORE', event_timestamp_ms: 5, purchased_at_ms: 4, expiration_at_ms: 9, cancel_reason: null, original_transaction_id: 'o1', transferred_from: [], transferred_to: [] } }
    expect(parseEvent(body)).toMatchObject({ type: 'RENEWAL', id: 'e1', appUserId: USER, productId: 'pro_annual:base', store: 'play_store', eventMs: 5, purchasedMs: 4, expirationMs: 9 })
  })
  it('refuses a body with no type, id or timestamp', () => {
    for (const bad of [null, {}, { event: {} }, { event: { type: 'RENEWAL', id: 'e' } }, { event: { type: 'RENEWAL', event_timestamp_ms: 1 } }]) expect(parseEvent(bad)).toBeNull()
  })
  it('S8G-09 refuses an overflowing price or timestamp (a 400, not a 500 that is retried for days)', () => {
    const ok = { type: 'RENEWAL', id: 'e1', app_user_id: USER, event_timestamp_ms: T0, price_in_purchased_currency: 4.99 }
    expect(parseEvent({ event: ok })).not.toBeNull()
    expect(parseEvent({ event: { ...ok, price_in_purchased_currency: -4.99 } })).not.toBeNull()
    for (const over of [{ price_in_purchased_currency: 1e30 }, { event_timestamp_ms: 1e20 }, { expiration_at_ms: 1e20 }, { purchased_at_ms: -1 }, { grace_period_expiration_at_ms: Date.UTC(2100, 0, 1) }, { expiration_at_ms: 'soon' }]) {
      expect(parseEvent({ event: { ...ok, ...over } }), JSON.stringify(over)).toBeNull()
    }
  })
})

describe('first purchase and renewal', () => {
  it('first purchase: active Plus to the period end, store as source, one Sparks period, trial allowance ended', () => {
    const out = plan(ev())
    expect(out.userId).toBe(USER)
    expect(out.entitlement).toMatchObject({ plan_key: 'plus', status: 'active', source: 'apple', current_period_end: new Date(T0 + 30 * DAY).toISOString(), will_renew: true, product_id: 'pro_monthly', store: 'app_store', store_original_txn: 'txn-1', grace_ends_at: null, canceled_at: null })
    expect(out.sparks).toEqual({ action: 'open', start: new Date(T0).toISOString(), end: new Date(T0 + 30 * DAY).toISOString(), ref: 'store:monthly' })
    expect(out.endTrial).toBe(true)
  })
  it('google purchases write source google', () => {
    expect(plan(ev({ store: 'play_store' })).entitlement?.source).toBe('google')
  })
  it('monthly renewal opens the next store period', () => {
    const out = plan(ev({ type: 'RENEWAL', purchasedMs: T0 + 30 * DAY, expirationMs: T0 + 60 * DAY, eventMs: T0 + 30 * DAY }))
    expect(out.sparks).toMatchObject({ action: 'open', start: new Date(T0 + 30 * DAY).toISOString(), end: new Date(T0 + 60 * DAY).toISOString() })
  })
  it('annual purchase opens a one-month Sparks period, not a year, and the monthly anniversary opens the rest', () => {
    const out = plan(ev({ productId: 'pro_annual', expirationMs: T0 + 365 * DAY }))
    expect(out.entitlement?.current_period_end).toBe(new Date(T0 + 365 * DAY).toISOString())
    expect(out.sparks).toMatchObject({ action: 'open', ref: 'store:annual', start: new Date(T0).toISOString() })
    expect(Date.parse((out.sparks as { end: string }).end)).toBeLessThan(T0 + 32 * DAY)
  })
  it('restore: the same purchase seen again plans exactly the same period, so the database makes no second one', () => {
    expect(plan(ev({ id: 'evt-restore' })).sparks).toEqual(plan(ev()).sparks)
  })
})

describe('cancellation, un-cancellation, expiry', () => {
  it('cancellation keeps the plan to the period end and grants no Sparks change', () => {
    const out = plan(ev({ type: 'CANCELLATION', cancelReason: 'UNSUBSCRIBE', eventMs: T0 + 5 * DAY }))
    expect(out.entitlement).toMatchObject({ status: 'canceled', will_renew: false, canceled_at: new Date(T0 + 5 * DAY).toISOString(), current_period_end: new Date(T0 + 30 * DAY).toISOString() })
    expect(out.sparks).toBeNull()
  })
  it('un-cancellation reactivates and never mints Sparks', () => {
    const out = plan(ev({ type: 'UNCANCELLATION' }))
    expect(out.entitlement).toMatchObject({ status: 'active', will_renew: true, canceled_at: null })
    expect(out.sparks).toBeNull()
  })
  it('S8A B-12 an un-cancellation or reversed refund with no expiry is ignored, never Plus with no end', () => {
    expect(planEffects(ev({ type: 'UNCANCELLATION', expirationMs: null }))).toBe('ignore')
    expect(planEffects(ev({ type: 'REFUND_REVERSED', expirationMs: null }))).toBe('ignore')
  })
  it('expiry drops to expired and ends the open Sparks period', () => {
    const out = plan(ev({ type: 'EXPIRATION', eventMs: T0 + 31 * DAY }))
    expect(out.entitlement).toMatchObject({ status: 'expired', will_renew: false })
    expect(out.sparks).toEqual({ action: 'end' })
  })
})

describe('refund and reversal', () => {
  it('a cancellation with reason CUSTOMER_SUPPORT is a refund: expired now, Sparks period ended now', () => {
    const out = plan(ev({ type: 'CANCELLATION', cancelReason: 'CUSTOMER_SUPPORT' }))
    expect(out.entitlement).toMatchObject({ status: 'expired', will_renew: false })
    expect(out.sparks).toEqual({ action: 'end' })
  })
  it('a reversed refund restores the entitlement and the Sparks period', () => {
    const out = plan(ev({ type: 'REFUND_REVERSED' }))
    expect(out.entitlement).toMatchObject({ status: 'active', current_period_end: new Date(T0 + 30 * DAY).toISOString() })
    expect(out.sparks).toEqual({ action: 'restore' })
  })
})

describe('billing issue and grace follow the store', () => {
  it('past_due carries the grace expiry the store reported', () => {
    const out = plan(ev({ type: 'BILLING_ISSUE', graceMs: T0 + 37 * DAY }))
    expect(out.entitlement).toMatchObject({ status: 'past_due', grace_ends_at: new Date(T0 + 37 * DAY).toISOString() })
  })
  it('with no expiry reported the grace stays null, which the resolver turns into period end plus three days', () => {
    expect(plan(ev({ type: 'BILLING_ISSUE', graceMs: null })).entitlement?.grace_ends_at).toBeNull()
  })
  it('a scheduled pause changes nothing: access runs to the period end, and the EXPIRATION that follows ends it', () => {
    expect(planEffects(ev({ type: 'SUBSCRIPTION_PAUSED' }))).toBe('ignore')
  })
})

describe('product change and transfer', () => {
  it('a product change is only a notice: the RENEWAL or INITIAL_PURCHASE that follows applies it', () => {
    expect(planEffects(ev({ type: 'PRODUCT_CHANGE', productId: 'pro_monthly', expirationMs: T0 + 30 * DAY }))).toBe('ignore')
  })
  it('a transfer expires the old users, copies the subscription to the new one, and grants no Sparks', () => {
    const copied = { plan_key: 'plus', status: 'active', source: 'apple', trial_ends_at: null, current_period_end: new Date(T0 + 20 * DAY).toISOString(), canceled_at: null, will_renew: true, product_id: 'pro_monthly', store: 'app_store', store_original_txn: 'txn-9', grace_ends_at: null } as const
    const out = plan(ev({ type: 'TRANSFER', transferredFrom: [USER], transferredTo: [OTHER], productId: null, store: null }), copied)
    expect(out.userId).toBe(OTHER)
    expect(out.transfer).toEqual({ from: [USER] })
    expect(out.entitlement).toEqual(copied)
    expect(out.sparks).toBeNull()
  })
  it('a transfer with nothing to copy only expires the old rows', () => {
    const out = plan(ev({ type: 'TRANSFER', transferredFrom: [USER], transferredTo: [OTHER], productId: null, store: null }))
    expect(out.entitlement).toBeNull()
  })
})

describe('what is ignored', () => {
  it('a product that is not Plus, an anonymous app user, a pack purchase and an unknown type', () => {
    expect(planEffects(ev({ productId: 'something_else' }))).toBe('ignore')
    expect(planEffects(ev({ appUserId: '$RCAnonymousID:abc' }))).toBe('ignore')
    expect(planEffects(ev({ type: 'NON_RENEWING_PURCHASE' }))).toBe('ignore')
    expect(planEffects(ev({ type: 'TEST' }))).toBe('ignore')
  })
})

describe('S8A B-1 sandbox events', () => {
  it('parseEvent reads the environment', () => {
    const base = { type: 'RENEWAL', id: 'e1', app_user_id: USER, event_timestamp_ms: T0 }
    expect(parseEvent({ event: { ...base, environment: 'SANDBOX' } })?.sandbox).toBe(true)
    expect(parseEvent({ event: { ...base, environment: 'PRODUCTION' } })?.sandbox).toBe(false)
    expect(parseEvent({ event: base })?.sandbox).toBe(false)
  })
  it('a sandbox purchase or pack is ignored when sandbox is refused; accepted by default (App Review buys in the sandbox)', () => {
    expect(planEffects(ev({ sandbox: true }), null, new Set(), false)).toBe('ignore')
    expect(planEffects(ev({ sandbox: true, productId: 'sparks_650' }), null, new Set(['sparks_650']), false)).toBe('ignore')
    expect(planEffects(ev({ sandbox: true }))).not.toBe('ignore')
  })
})

describe('Sparks packs', () => {
  const PACKS = new Set(['sparks_400'])
  const pack = (over: Partial<RcEvent> = {}) => ev({ type: 'NON_RENEWING_PURCHASE', productId: 'sparks_400', transactionId: 'txn-9', priceMicros: 990_000, currency: 'USD', purchasedMs: null, expirationMs: null, ...over })
  it('a pack purchase adds Sparks through the pack effect, with no entitlement change', () => {
    const out = planEffects(pack(), null, PACKS)
    expect(out).toMatchObject({ userId: USER, entitlement: null, sparks: null, pack: { action: 'purchase', store: 'app_store', store_txn: 'txn-9', product_id: 'sparks_400', price_micros: 990_000, currency: 'USD' } })
  })
  it('a refund removes the unspent Sparks of that transaction', () => {
    expect(planEffects(pack({ type: 'CANCELLATION', cancelReason: 'CUSTOMER_SUPPORT' }), null, PACKS)).toMatchObject({ pack: { action: 'refund', store_txn: 'txn-9' } })
  })
  it('a pack is ignored when its product is not a known pack, or has no transaction id', () => {
    expect(planEffects(pack(), null, new Set())).toBe('ignore')
    expect(planEffects(pack({ transactionId: null }), null, PACKS)).toBe('ignore')
  })
  it('a subscription event keeps what the store charged on the receipt note', () => {
    const out = plan(ev({ priceMicros: 499_000_000, currency: 'EGP' }))
    expect(out.receipt).toEqual({ store: 'app_store', product_id: 'pro_monthly', price_micros: 499_000_000, currency: 'EGP' })
  })
  it('parses the transaction id and the price in the purchase currency', () => {
    const parsed = parseEvent({ event: { type: 'NON_RENEWING_PURCHASE', id: 'e1', app_user_id: USER, product_id: 'sparks_400', store: 'PLAY_STORE', event_timestamp_ms: 5, transaction_id: 'T1', price_in_purchased_currency: 3.99, currency: 'SAR' } })
    expect(parsed).toMatchObject({ transactionId: 'T1', priceMicros: 3_990_000, currency: 'SAR' })
  })
})

describe('store country (Egypt Pro limits)', () => {
  it('reads country_code and passes it on subscription effects only when present', () => {
    expect(parseEvent({ event: { type: 'RENEWAL', id: 'e1', app_user_id: USER, event_timestamp_ms: 5, country_code: 'EG' } })?.countryCode).toBe('EG')
    expect(plan(ev({ countryCode: 'EG' })).country).toBe('EG')
    expect(plan(ev()).country).toBeUndefined()
  })
})
