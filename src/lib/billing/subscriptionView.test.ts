import { describe, expect, it } from 'vitest'
import { subscriptionView } from './subscriptionView'
import type { BillingMe } from './billingStore'

const NOW = Date.UTC(2026, 10, 15)
const sub = (over: Partial<NonNullable<BillingMe['subscription']>> = {}) => ({ fromStore: true, billingIssue: false, graceEndsAt: null, willRenew: true, renewsAt: '2026-12-14T00:00:00Z', productId: 'pro_monthly', memberSince: '2026-10-14T00:00:00Z', ...over })
const me = (over: Partial<BillingMe> = {}): BillingMe => ({ planKey: 'plus', planName: 'Pro', status: 'active', trialEndsAt: null, billingEnabled: true, sparks: null, loyalty: null, subscription: sub(), ...over })

describe('subscriptionView', () => {
  it.each([
    ['pro_monthly', 'monthly'], ['pro_annual', 'yearly'], ['pro_annual', 'yearly'], ['buddget_pro_monthly', 'monthly'],
    ['pro:yearly', 'yearly'], ['buddget_pro:monthly-base', 'monthly'], ['pro_lifetime', null], [null, null],
  ] as const)('reads the period from any product id naming: %s', (productId, period) => {
    expect(subscriptionView(me({ subscription: sub({ productId }) }), NOW).period).toBe(period)
  })
  it('free with no history is free', () => {
    expect(subscriptionView(me({ planKey: 'free', status: 'active', subscription: sub({ memberSince: null, fromStore: false }) }), NOW).kind).toBe('free')
    expect(subscriptionView(null, NOW).kind).toBe('free')
  })
  it('a lapsed member reads as expired and keeps the member-since date', () => {
    const v = subscriptionView(me({ planKey: 'free', status: 'expired' }), NOW)
    expect(v).toMatchObject({ kind: 'expired', proActive: false, memberSince: '2026-10-14T00:00:00Z' })
  })
  it('a trial counts its day out of 30 from the end date', () => {
    const day = (daysLeft: number) => subscriptionView(me({ planKey: 'plus_trial', status: 'trialing', trialEndsAt: new Date(NOW + daysLeft * 86_400_000).toISOString(), subscription: null }), NOW)
    expect(day(30)).toMatchObject({ kind: 'trial', trialDay: 1 })
    expect(day(25)).toMatchObject({ trialDay: 6 })
    expect(day(1).trialDay).toBe(30)
    expect(day(0.2).trialDay).toBe(30)
  })
  it('active reads the period from the product and the renewal date', () => {
    expect(subscriptionView(me(), NOW)).toMatchObject({ kind: 'active', period: 'monthly', until: '2026-12-14T00:00:00Z' })
    expect(subscriptionView(me({ subscription: sub({ productId: 'pro_annual:base' }) }), NOW).period).toBe('yearly')
  })
  it('a billing issue keeps Pro on and points at the grace expiry', () => {
    const v = subscriptionView(me({ status: 'past_due', subscription: sub({ billingIssue: true, graceEndsAt: '2026-11-30T00:00:00Z' }) }), NOW)
    expect(v).toMatchObject({ kind: 'issue', proActive: true, until: '2026-11-30T00:00:00Z' })
  })
  it('a cancelled period still runs to its end', () => {
    expect(subscriptionView(me({ status: 'canceled', subscription: sub({ willRenew: false }) }), NOW)).toMatchObject({ kind: 'canceled', proActive: true })
  })
})
