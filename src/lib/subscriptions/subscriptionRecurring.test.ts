import { describe, expect, it } from 'vitest'
import type { Subscription } from '@/lib/store/types'
import {
  buildRecurringExpenseFromSubscription,
  patchRecurringFromSubscription,
  subscriptionToMonthlyPlannerAmount,
  subscriptionsMonthlyBaseTotal,
} from './subscriptionRecurring'

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 's1', name: 'Netflix', brandKey: 'netflix', planName: 'Premium', planId: 'netflix_premium',
  catalogRegion: 'egypt', pendingPlanId: null, pendingAmount: null, amount: 270, currency: 'EGP',
  billingCycle: 'monthly', billingDay: 10, startDate: '2026-01-10', nextBillingDate: null,
  paymentMethodId: 'pm1', expenseCategory: 'Enjoyment', linkedRecurringExpenseId: 're1',
  status: 'active', notes: null, createdAt: '2026-01-10T00:00:00Z', cancelledAt: null, ...over,
})

describe('subscriptionToMonthlyPlannerAmount', () => {
  it.each([
    [120, 'monthly', 120],
    [300, 'quarterly', 100],
    [600, 'semiannual', 100],
    [1200, 'yearly', 100],
    [12, 'weekly', 52],
  ] as const)('%d %s -> %d / month', (amount, cycle, expected) => {
    expect(subscriptionToMonthlyPlannerAmount(amount, cycle)).toBeCloseTo(expected, 6)
  })
})

describe('subscriptionsMonthlyBaseTotal', () => {
  const rates = { USD_EGP: 50 }

  it('converts each subscription from its own currency into the base currency', () => {
    const total = subscriptionsMonthlyBaseTotal(
      [sub({ amount: 200, currency: 'EGP' }), sub({ id: 's2', amount: 10, currency: 'USD' })],
      'EGP',
      rates
    )
    expect(total).toBe(700)
  })

  it('normalises yearly and quarterly to monthly before converting (USD billed in EGP)', () => {
    const total = subscriptionsMonthlyBaseTotal(
      [sub({ amount: 120, currency: 'USD', billingCycle: 'yearly' }), sub({ id: 's2', amount: 30, currency: 'USD', billingCycle: 'quarterly' })],
      'EGP',
      rates
    )
    expect(total).toBe(10 * 50 + 10 * 50)
  })

  it('counts active only: a trial is not charged yet, cancelled and paused never are', () => {
    const total = subscriptionsMonthlyBaseTotal(
      [
        sub({ id: 'a', status: 'active', amount: 100 }),
        sub({ id: 't', status: 'trial', amount: 10 }),
        sub({ id: 'c', status: 'cancelled', amount: 1000 }),
        sub({ id: 'p', status: 'paused', amount: 1000 }),
      ],
      'EGP',
      rates
    )
    expect(total).toBe(100)
  })

  it('counts my share of a shared plan, not the full price', () => {
    expect(subscriptionsMonthlyBaseTotal([sub({ amount: 300, myShare: 100 })], 'EGP', rates)).toBe(100)
  })

  it('is zero with no subscriptions', () => {
    expect(subscriptionsMonthlyBaseTotal([], 'EGP', rates)).toBe(0)
  })
})

describe('buildRecurringExpenseFromSubscription', () => {
  it('mirrors a monthly sub 1:1 and labels it with the plan', () => {
    const re = buildRecurringExpenseFromSubscription(sub(), 're1', 'fallback')
    expect(re).toMatchObject({
      id: 're1', description: 'Netflix (Premium)', amount: 270, currency: 'EGP',
      dayOfMonth: 10, isActive: true, paymentMethodId: 'pm1', category: 'Enjoyment',
    })
    expect(re.notes).toBe('Auto-created from subscription: Netflix')
  })

  it('stores the monthly equivalent for a yearly sub and keeps the real price in the notes', () => {
    const re = buildRecurringExpenseFromSubscription(sub({ amount: 1200, billingCycle: 'yearly' }), 're1', 'f')
    expect(re.amount).toBe(100)
    expect(re.notes).toContain('1200 EGP per cycle')
  })

  it('falls back to the default payment method and clamps dayOfMonth', () => {
    const re = buildRecurringExpenseFromSubscription(sub({ paymentMethodId: null, billingDay: 45 }), 're1', 'fallback')
    expect(re.paymentMethodId).toBe('fallback')
    expect(re.dayOfMonth).toBe(31)
  })

  it.each([
    ['active', true], ['trial', true], ['paused', false], ['cancelled', false],
  ] as const)('%s -> isActive %s', (status, active) => {
    expect(buildRecurringExpenseFromSubscription(sub({ status }), 're1', 'f').isActive).toBe(active)
  })
})

describe('patchRecurringFromSubscription', () => {
  it('keeps shared-plan link and creation time, and stamps the edit', () => {
    const prev = { ...buildRecurringExpenseFromSubscription(sub(), 're1', 'f'), sharedPlanId: 'plan9', createdAt: '2026-01-10T00:00:00Z' }
    const out = patchRecurringFromSubscription(prev, sub({ amount: 300 }), 'f')
    expect(out.amount).toBe(300)
    expect(out.sharedPlanId).toBe('plan9')
    expect(out.createdAt).toBe('2026-01-10T00:00:00Z')
    expect(out.updatedAt && out.updatedAt > '2026-01-10').toBe(true)
  })
})
