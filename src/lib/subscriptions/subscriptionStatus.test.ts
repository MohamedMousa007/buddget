import { describe, expect, it } from 'vitest'
import type { Expense, Subscription } from '@/lib/store/types'
import { subscriptionStatus } from './subscriptionStatus'

const at = (d: string) => new Date(`${d}T12:00:00`)

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 's1', name: 'Netflix', brandKey: 'netflix', planName: 'Premium', planId: null,
  catalogRegion: null, pendingPlanId: null, pendingAmount: null, amount: 9.99, currency: 'USD',
  billingCycle: 'monthly', billingDay: 2, startDate: '2026-01-02', nextBillingDate: null,
  paymentMethodId: null, expenseCategory: 'Subscription', linkedRecurringExpenseId: null,
  status: 'active', notes: null, createdAt: '2026-01-01T00:00:00Z', cancelledAt: null, ...over,
})
// A charge reaches a subscription through expenses.linked_subscription_id, the same link isCyclePaid reads.
const charge = (date: string, over: Partial<Expense> = {}): Expense =>
  ({ id: `e-${date}`, date, description: 'Netflix', category: 'Subscription', amount: 494, currency: 'EGP', amountInBaseCurrency: 494, paymentMethodId: 'pm', isRecurring: false, linkedSubscriptionId: 's1', createdAt: '', updatedAt: '', ...over }) as Expense

describe('subscriptionStatus', () => {
  it('is Active when every charge landed', () => {
    expect(subscriptionStatus(sub(), [charge('2026-09-02'), charge('2026-10-02')], at('2026-10-20'))).toBe('active')
  })

  it('stays Active inside the grace days of a charge', () => {
    expect(subscriptionStatus(sub(), [charge('2026-09-02')], at('2026-10-03'))).toBe('active')
  })

  it('is Payment due when exactly one charge is missing past its grace days', () => {
    expect(subscriptionStatus(sub(), [charge('2026-09-02')], at('2026-10-06'))).toBe('payment_due')
  })

  it('stays Payment due while the next charge is in its grace days (no flip back to Active at rollover)', () => {
    expect(subscriptionStatus(sub(), [charge('2026-08-02')], at('2026-10-03'))).toBe('payment_due')
  })

  it('is Needs renewal when two charges in a row are missing', () => {
    expect(subscriptionStatus(sub(), [charge('2026-08-02')], at('2026-10-06'))).toBe('needs_renewal')
  })

  it('counts a refunded charge as missing', () => {
    expect(subscriptionStatus(sub(), [charge('2026-09-02', { refundKind: 'refunded' })], at('2026-10-06'))).toBe('needs_renewal')
  })

  it('never calls a new subscription Needs renewal before two tracked cycles have passed', () => {
    const fresh = sub({ startDate: '2026-01-02', createdAt: '2026-09-20T00:00:00Z' })
    expect(subscriptionStatus(fresh, [], at('2026-10-06'))).toBe('payment_due')
    expect(subscriptionStatus(fresh, [], at('2026-09-25'))).toBe('active')
  })

  it('reads weekly cycles', () => {
    const weekly = sub({ billingCycle: 'weekly', startDate: '2026-10-01', billingDay: 1, createdAt: '2026-10-01T00:00:00Z' })
    expect(subscriptionStatus(weekly, [charge('2026-10-01'), charge('2026-10-08')], at('2026-10-19'))).toBe('payment_due')
    expect(subscriptionStatus(weekly, [charge('2026-10-01')], at('2026-10-19'))).toBe('needs_renewal')
  })

  it('reads yearly cycles', () => {
    const yearly = sub({ billingCycle: 'yearly', startDate: '2024-03-02', billingDay: 2, createdAt: '2024-03-01T00:00:00Z' })
    expect(subscriptionStatus(yearly, [charge('2024-03-02'), charge('2025-03-02')], at('2026-03-10'))).toBe('payment_due')
    expect(subscriptionStatus(yearly, [charge('2024-03-02')], at('2026-03-10'))).toBe('needs_renewal')
    expect(subscriptionStatus(yearly, [charge('2025-03-02')], at('2025-11-01'))).toBe('active')
  })

  it('is Trial while the free days last, then bills like an active plan', () => {
    const trial = sub({ status: 'trial', trialEnd: '2026-11-02', startDate: '2026-11-02', createdAt: '2026-10-02T00:00:00Z' })
    expect(subscriptionStatus(trial, [], at('2026-10-20'))).toBe('trial')
    expect(subscriptionStatus(trial, [charge('2026-11-02')], at('2026-11-10'))).toBe('active')
  })

  it('is Cancelled while access remains and after it ends', () => {
    const c = sub({ status: 'cancelled', endsOn: '2026-11-02', cancelledAt: '2026-10-10T00:00:00Z' })
    expect(subscriptionStatus(c, [], at('2026-10-20'))).toBe('cancelled')
    expect(subscriptionStatus(c, [], at('2026-12-01'))).toBe('cancelled')
  })

  it('reads a legacy paused row as Cancelled: it bills nothing and can be re-subscribed', () => {
    expect(subscriptionStatus(sub({ status: 'paused', pausedAt: '2026-08-01T00:00:00Z' }), [], at('2026-10-20'))).toBe('cancelled')
  })
})
