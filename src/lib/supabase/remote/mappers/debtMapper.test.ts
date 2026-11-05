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
})
