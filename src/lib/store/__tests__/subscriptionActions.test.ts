import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { PaymentMethod, Subscription } from '@/lib/store/types'

type Input = Parameters<ReturnType<typeof useFinanceStore.getState>['addSubscription']>[0]

const pm = { id: 'pm1', name: 'Visa', type: 'credit_card', currency: 'EGP', isDefault: true } as PaymentMethod

const input = (over: Partial<Input> = {}): Input => ({
  name: 'Netflix', brandKey: 'netflix', planName: 'Standard', planId: 'netflix_standard',
  catalogRegion: 'egypt', pendingPlanId: null, pendingAmount: null, amount: 190, currency: 'EGP',
  billingCycle: 'monthly', billingDay: 10, startDate: '2026-01-10', nextBillingDate: null,
  paymentMethodId: 'pm1', expenseCategory: 'Enjoyment', status: 'active', notes: null, ...over,
})

const st = () => useFinanceStore.getState()
const sub = (id: string) => st().subscriptions.find((s) => s.id === id) as Subscription
const re = (id: string) => st().recurringExpenses.find((r) => r.id === sub(id).linkedRecurringExpenseId)!

beforeEach(() => {
  vi.useRealTimers()
  useFinanceStore.setState({ subscriptions: [], recurringExpenses: [], paymentMethods: [pm] })
})

describe('addSubscription', () => {
  it('creates the subscription and its linked recurring expense together', () => {
    const id = st().addSubscription(input())
    expect(sub(id).linkedRecurringExpenseId).toBe(re(id).id)
    expect(re(id)).toMatchObject({ amount: 190, isActive: true, dayOfMonth: 10 })
    expect(sub(id).updatedAt).toBeTruthy()
    expect(sub(id).nextBillingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('updateSubscription', () => {
  it('propagates price and cycle to the recurring expense and recomputes the next billing date', () => {
    const id = st().addSubscription(input())
    st().updateSubscription(id, { amount: 1200, billingCycle: 'yearly' })
    expect(re(id).amount).toBe(100)
    expect(sub(id).nextBillingDate! > '2026-10-17').toBe(true)
  })

  it('stamps updatedAt so an offline edit wins the merge against the server copy', () => {
    const id = st().addSubscription(input())
    vi.useFakeTimers().setSystemTime(new Date('2030-01-01T00:00:00Z'))
    st().updateSubscription(id, { notes: 'x' })
    expect(sub(id).updatedAt).toBe('2030-01-01T00:00:00.000Z')
  })

  it('ignores an unknown id', () => {
    const before = st().subscriptions
    st().updateSubscription('nope', { amount: 1 })
    expect(st().subscriptions).toBe(before)
  })
})

describe('cancel / reactivate', () => {
  it('cancel deactivates the recurring expense, stamps cancelledAt and drops a pending plan prompt', () => {
    const id = st().addSubscription(input({ pendingPlanId: 'netflix_premium', pendingAmount: 270 }))
    st().cancelSubscription(id)
    expect(sub(id)).toMatchObject({ status: 'cancelled', pendingPlanId: null, pendingAmount: null })
    expect(sub(id).cancelledAt).toBeTruthy()
    expect(sub(id).updatedAt).toBe(sub(id).cancelledAt)
    expect(re(id).isActive).toBe(false)
  })

  it('reactivate restores active, clears cancelledAt and reactivates the recurring expense', () => {
    const id = st().addSubscription(input())
    st().cancelSubscription(id)
    st().reactivateSubscription(id)
    expect(sub(id)).toMatchObject({ status: 'active', cancelledAt: null })
    expect(re(id).isActive).toBe(true)
    expect(sub(id).nextBillingDate! >= '2026-10-17').toBe(true)
  })

  it('cancelled then edited stays cancelled (edit does not resurrect)', () => {
    const id = st().addSubscription(input())
    st().cancelSubscription(id)
    st().updateSubscription(id, { notes: 'was cancelled' })
    expect(sub(id).status).toBe('cancelled')
    expect(re(id).isActive).toBe(false)
  })
})

describe('pending plan change', () => {
  it('apply adopts plan id, label and the tracked amount, clears pending and syncs the recurring row', () => {
    const id = st().addSubscription(input({ pendingPlanId: 'netflix_premium', pendingAmount: 270 }))
    st().applyPendingPlanChange(id)
    expect(sub(id)).toMatchObject({
      planId: 'netflix_premium', planName: 'Premium', amount: 270, pendingPlanId: null, pendingAmount: null,
    })
    expect(re(id).amount).toBe(270)
    expect(re(id).description).toBe('Netflix (Premium)')
  })

  it('apply is a no-op with nothing pending', () => {
    const id = st().addSubscription(input())
    const before = sub(id)
    st().applyPendingPlanChange(id)
    expect(sub(id)).toBe(before)
  })

  it('dismiss clears pending and changes nothing else', () => {
    const id = st().addSubscription(input({ pendingPlanId: 'netflix_premium', pendingAmount: 270 }))
    st().dismissPendingPlanChange(id)
    expect(sub(id)).toMatchObject({ planId: 'netflix_standard', amount: 190, pendingPlanId: null })
  })
})

describe('deleteSubscription', () => {
  it('removes the subscription and its recurring expense', () => {
    const id = st().addSubscription(input())
    st().deleteSubscription(id)
    expect(st().subscriptions).toHaveLength(0)
    expect(st().recurringExpenses).toHaveLength(0)
  })
})

describe('lifecycle actions', () => {
  beforeEach(() => {
    useFinanceStore.setState({ expenses: [] })
    vi.useFakeTimers().setSystemTime(new Date('2026-10-17T12:00:00'))
  })

  it('cancel records the last day of access; reactivate clears it', () => {
    const id = st().addSubscription(input({ billingDay: 19, startDate: '2026-01-19' }))
    st().cancelSubscription(id, '2026-10-18')
    expect(sub(id)).toMatchObject({ status: 'cancelled', endsOn: '2026-10-18' })
    expect(re(id).isActive).toBe(false)
    st().reactivateSubscription(id)
    expect(sub(id)).toMatchObject({ status: 'active', endsOn: null })
  })

  it('pause stops the recurring mirror and resume restarts it', () => {
    const id = st().addSubscription(input())
    st().pauseSubscription(id)
    expect(sub(id)).toMatchObject({ status: 'paused' })
    expect(sub(id).pausedAt).toBeTruthy()
    expect(re(id).isActive).toBe(false)
    st().resumeSubscription(id)
    expect(sub(id)).toMatchObject({ status: 'active', pausedAt: null })
    expect(re(id).isActive).toBe(true)
  })

  it('converting a trial makes it an active, charged plan', () => {
    const id = st().addSubscription(input({ status: 'trial', trialEnd: '2026-10-24' }))
    st().convertTrial(id)
    expect(sub(id)).toMatchObject({ status: 'active', trialEnd: null })
  })

  it('adopting a price keeps the old one in history', () => {
    const id = st().addSubscription(input())
    st().adoptSubscriptionPrice(id, 210)
    expect(sub(id).amount).toBe(210)
    expect(sub(id).priceHistory).toEqual([
      { amount: 190, from: '2026-01-10' },
      { amount: 210, from: '2026-10-17' },
    ])
    expect(re(id).amount).toBe(210)
  })

  it('applying a pending plan change records the new price in history and clears the prompt', () => {
    const id = st().addSubscription(input({ pendingPlanId: 'netflix_premium', pendingAmount: 270, pendingPlanFrom: '2026-11-02' }))
    st().applyPendingPlanChange(id)
    expect(sub(id)).toMatchObject({ planId: 'netflix_premium', amount: 270, pendingPlanId: null, pendingPlanFrom: null })
    expect(sub(id).priceHistory?.at(-1)).toEqual({ amount: 270, from: '2026-11-02' })
  })
})

describe('recording charges', () => {
  beforeEach(() => {
    useFinanceStore.setState({ expenses: [] })
    vi.useFakeTimers().setSystemTime(new Date('2026-10-17T12:00:00'))
  })
  const charges = () => st().expenses.filter((e) => e.linkedSubscriptionId)

  it('mark paid on an open cycle records a linked charge dated today, once', () => {
    const id = st().addSubscription(input({ billingDay: 15, startDate: '2026-01-15' }))
    useFinanceStore.setState({ subscriptions: st().subscriptions.map((s) => ({ ...s, createdAt: '2026-01-01T00:00:00Z' })) })
    st().markSubscriptionPaid(id)
    st().markSubscriptionPaid(id)
    expect(charges()).toHaveLength(1)
    expect(charges()[0]).toMatchObject({ date: '2026-10-17', amount: 190, currency: 'EGP', category: 'Subscription', linkedSubscriptionId: id })
  })

  it('paying ahead dates the charge on the due date and cannot be repeated', () => {
    const id = st().addSubscription(input({ billingDay: 19, startDate: '2026-01-19' }))
    useFinanceStore.setState({ subscriptions: st().subscriptions.map((s) => ({ ...s, createdAt: '2026-10-01T00:00:00Z' })) })
    st().markSubscriptionPaid(id)
    st().markSubscriptionPaid(id)
    expect(charges().map((e) => e.date)).toEqual(['2026-10-19'])
  })

  it('log mode writes the due charge itself, and only when it is due', () => {
    const due = st().addSubscription(input({ tracking: 'log', billingDay: 15, startDate: '2026-01-15' }))
    const later = st().addSubscription(input({ tracking: 'log', billingDay: 25, startDate: '2026-01-25' }))
    const sms = st().addSubscription(input({ tracking: 'sms', billingDay: 15, startDate: '2026-01-15' }))
    useFinanceStore.setState({ subscriptions: st().subscriptions.map((s) => ({ ...s, createdAt: '2026-10-01T00:00:00Z' })) })
    st().logDueSubscriptions()
    st().logDueSubscriptions()
    expect(charges().map((e) => [e.linkedSubscriptionId, e.date])).toEqual([[due, '2026-10-15']])
    expect(later).not.toBe(sms)
  })

  it('unlinking detaches the charge but keeps the expense', () => {
    const id = st().addSubscription(input({ billingDay: 15, startDate: '2026-01-15' }))
    useFinanceStore.setState({ subscriptions: st().subscriptions.map((s) => ({ ...s, createdAt: '2026-01-01T00:00:00Z' })) })
    st().markSubscriptionPaid(id)
    st().unlinkSubscriptionCharge(st().expenses[0].id)
    expect(st().expenses).toHaveLength(1)
    expect(st().expenses[0].linkedSubscriptionId).toBeUndefined()
  })

  it('linking attaches existing expenses', () => {
    const id = st().addSubscription(input())
    st().addExpense({ date: '2026-09-10', description: 'NETFLIX.COM', category: 'Enjoyment', amount: 190, currency: 'EGP', paymentMethodId: 'pm1', isRecurring: false })
    st().linkSubscriptionCharges(id, [st().expenses[0].id])
    expect(st().expenses[0].linkedSubscriptionId).toBe(id)
  })

  it('an incoming SMS charge replaces the app-written one for the same cycle', () => {
    const id = st().addSubscription(input({ billingDay: 15, startDate: '2026-01-15' }))
    useFinanceStore.setState({ subscriptions: st().subscriptions.map((s) => ({ ...s, createdAt: '2026-01-01T00:00:00Z' })) })
    st().markSubscriptionPaid(id)
    st().upsertServerExpense({ ...st().expenses[0], id: 'sms-exp', isRecurring: false, smsLogId: 'log1', date: '2026-10-16' })
    expect(st().expenses.map((e) => e.id)).toEqual(['sms-exp'])
  })
})
