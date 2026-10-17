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
