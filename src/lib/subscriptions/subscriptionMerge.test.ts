import { describe, expect, it } from 'vitest'
import { mergeList } from '@/lib/supabase/remote/merge'
import { subscriptionFromRow, subscriptionToRow } from '@/lib/supabase/remote/mappers/subscriptionMapper'
import type { Subscription } from '@/lib/store/types'

const base: Subscription = {
  id: 's1', name: 'Netflix', brandKey: 'netflix', planName: null, planId: null, catalogRegion: null,
  pendingPlanId: null, pendingAmount: null, amount: 190, currency: 'EGP', billingCycle: 'monthly',
  billingDay: 10, startDate: '2026-01-10', nextBillingDate: null, paymentMethodId: null,
  expenseCategory: 'Enjoyment', linkedRecurringExpenseId: null, status: 'active', notes: null,
  createdAt: '2026-01-10T00:00:00.000Z', cancelledAt: null,
}

describe('subscription offline-merge', () => {
  it('an offline cancel (newer updatedAt) beats the stale active server copy', () => {
    const server = { ...base, updatedAt: '2026-05-01T00:00:00.000Z' }
    const local = { ...base, status: 'cancelled' as const, updatedAt: '2026-06-01T00:00:00.000Z' }
    expect(mergeList([local], [server])[0].status).toBe('cancelled')
  })

  it('a newer server change (SMS pending plan) beats an older local copy', () => {
    const local = { ...base, updatedAt: '2026-05-01T00:00:00.000Z' }
    const server = { ...base, pendingPlanId: 'netflix_premium', updatedAt: '2026-06-01T00:00:00.000Z' }
    expect(mergeList([local], [server])[0].pendingPlanId).toBe('netflix_premium')
  })

  it('reads updatedAt from the row edit time (edited_at) and never writes updated_at (server owns it)', () => {
    const row = { ...subscriptionToRow(base, 'u1'), edited_at: '2026-06-01T00:00:00.000Z' }
    expect(subscriptionFromRow(row as never).updatedAt).toBe('2026-06-01T00:00:00.000Z')
    expect('updated_at' in subscriptionToRow({ ...base, updatedAt: 'x' }, 'u1')).toBe(false)
  })
})
