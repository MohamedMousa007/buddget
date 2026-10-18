import { describe, expect, it } from 'vitest'
import type { Subscription } from '@/lib/store/types'
import { committedImpact, draftToSubscription, type SubscriptionDraft } from './subscriptionDraft'

const draft = (over: Partial<SubscriptionDraft> = {}): SubscriptionDraft => ({
  name: ' ChatGPT ', brandKey: 'chatgpt_plus', planId: 'chatgpt_plus_plus', planName: 'Plus', planRegion: 'egypt',
  amount: 20, currency: 'USD', cycle: 'monthly', firstCharge: '2026-10-21', paymentMethodId: 'pm1',
  tracking: 'ask', reminder: true, trial: false, sharedWith: [], myShare: null, category: 'Subscription', notes: '', ...over,
})
const existing = (over: Partial<Subscription> = {}): Subscription =>
  ({ id: 's1', amount: 190, currency: 'EGP', billingCycle: 'monthly', status: 'active', startDate: '2026-01-19', pendingPlanId: 'p', pendingAmount: 270, pendingPlanFrom: '2026-11-02', planId: 'chatgpt_plus_plus', priceHistory: [], endsOn: null, pausedAt: null, ...over }) as Subscription

describe('draftToSubscription', () => {
  it('anchors the schedule on the first charge date', () => {
    const p = draftToSubscription(draft(), null, '2026-10-17')
    expect(p).toMatchObject({ name: 'ChatGPT', startDate: '2026-10-21', billingDay: 21, status: 'active', tracking: 'ask', trialEnd: null, sharedWith: null })
  })
  it('stores a trial as a trial that ends on the first paid charge', () => {
    expect(draftToSubscription(draft({ trial: true, firstCharge: '2026-10-24' }), null, '2026-10-17')).toMatchObject({ status: 'trial', trialEnd: '2026-10-24', billingDay: 24 })
  })
  it('keeps my share only on a shared plan', () => {
    expect(draftToSubscription(draft({ sharedWith: ['Omar'], myShare: 10 }), null, '2026-10-17')).toMatchObject({ sharedWith: ['Omar'], myShare: 10 })
    expect(draftToSubscription(draft({ myShare: 10 }), null, '2026-10-17').myShare).toBeNull()
  })
  it('records a changed price in the history, seeding the old one', () => {
    const p = draftToSubscription(draft({ amount: 210, planId: 'chatgpt_plus_plus' }), existing(), '2026-10-17')
    expect(p.priceHistory).toEqual([{ amount: 190, from: '2026-01-19' }, { amount: 210, from: '2026-10-17' }])
  })
  it('keeps a pending plan change when plan and price are untouched, clears it when either changes', () => {
    expect(draftToSubscription(draft({ amount: 190 }), existing(), 't').pendingPlanId).toBe('p')
    expect(draftToSubscription(draft({ amount: 200 }), existing(), 't').pendingPlanId).toBeNull()
  })
  it('preserves the lifecycle an edit does not own', () => {
    const p = draftToSubscription(draft({ amount: 190 }), existing({ status: 'paused', pausedAt: 'x' }), 't')
    expect(p).toMatchObject({ status: 'paused', pausedAt: 'x' })
  })
  it('a trial that is saved as paid becomes active', () => {
    expect(draftToSubscription(draft({ amount: 190 }), existing({ status: 'trial' }), 't').status).toBe('active')
  })
})

describe('committedImpact', () => {
  const rates = { USD_EGP: 53.45 }
  const base = [existing({ id: 'a', amount: 2200 }), existing({ id: 'b', amount: 1200, billingCycle: 'yearly' })]
  it('adds the new monthly cost in the base currency', () => {
    const i = committedImpact(draft(), base, null, 'EGP', rates)
    expect(i.monthly).toBeCloseTo(1069, 5)
    expect(i.after).toBeCloseTo(2200 + 100 + 1069, 5)
  })
  it('replaces the old figure when editing', () => {
    const i = committedImpact(draft({ amount: 300, currency: 'EGP' }), base, 'a', 'EGP', rates)
    expect(i.after).toBe(100 + 300)
  })
  it('adds nothing during a trial and counts my share on a shared plan', () => {
    expect(committedImpact(draft({ trial: true }), base, null, 'EGP', rates).monthly).toBe(0)
    expect(committedImpact(draft({ currency: 'EGP', amount: 270, sharedWith: ['Omar'], myShare: 135 }), [], null, 'EGP', rates).monthly).toBe(135)
  })
})
