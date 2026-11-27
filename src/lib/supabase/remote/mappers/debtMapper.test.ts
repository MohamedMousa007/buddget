import { describe, expect, it } from 'vitest'
import { debtFromRow, debtToRow } from '@/lib/supabase/remote/mappers/debtMapper'
import type { Debt } from '@/lib/store/types'

describe('debt mapper', () => {
  it('keeps the payoff goal and emoji across a sync round trip', () => {
    const goal = { targetDate: '2027-01-31', paymentFrequency: 'monthly' as const, calculatedAmount: 250 }
    const debt = { id: 'd', name: 'Car', person: 'Bank', startingBalance: 3000, currency: 'EGP', createdAt: '2026-01-01T00:00:00.000Z', goal, emoji: '🚗' } as unknown as Debt
    const back = debtFromRow({ ...debtToRow(debt, 'u'), user_id: 'u' } as never)
    expect(back.goal).toEqual(goal)
    expect(back.emoji).toBe('🚗')
  })

  it('keeps an installment default card across a round trip, and sends Cash or none as NULL', () => {
    const base = { id: 'd', name: 'iPhone', person: 'Installment', startingBalance: 30000, currency: 'EGP', createdAt: '2026-01-01T00:00:00.000Z', debtType: 'installment' } as unknown as Debt
    const pm = '0b8f2c1e-1111-4222-8333-944455556666'
    const row = debtToRow({ ...base, defaultPaymentMethodId: pm }, 'u')
    expect(row.default_payment_method_id).toBe(pm)
    expect(debtFromRow({ ...row, user_id: 'u' } as never).defaultPaymentMethodId).toBe(pm)
    expect(debtToRow(base, 'u').default_payment_method_id).toBeNull()
    expect(debtFromRow({ ...debtToRow(base, 'u'), user_id: 'u' } as never).defaultPaymentMethodId).toBeUndefined()
  })

  it('keeps an installment item type and its own icon across a round trip; an unknown type reads as unset', () => {
    const base = { id: 'd', name: 'Sofa', person: 'valU', startingBalance: 12000, currency: 'EGP', createdAt: '2026-01-01T00:00:00.000Z', debtType: 'installment' } as unknown as Debt
    const row = debtToRow({ ...base, installmentItemType: 'other', installmentItemIcon: 'gem' }, 'u')
    expect(row).toMatchObject({ installment_item_type: 'other', installment_item_icon: 'gem' })
    expect(debtFromRow({ ...row, user_id: 'u' } as never)).toMatchObject({ installmentItemType: 'other', installmentItemIcon: 'gem' })
    expect(debtFromRow({ ...debtToRow(base, 'u'), installment_item_type: 'boat', user_id: 'u' } as never).installmentItemType).toBeUndefined()
  })
})
