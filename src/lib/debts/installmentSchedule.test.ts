import { describe, expect, it } from 'vitest'
import type { Debt, DebtPayment } from '@/lib/store/types'
import { installmentPaymentsCompleted, nextInstallmentDueFormatted } from './installmentSchedule'

const plan = { id: 'i1', debtType: 'installment', installmentCount: 12, installmentAmount: 100, installmentFrequency: 'monthly', startDate: '2026-01-15' } as Debt
const pay = (amountPaid: number): DebtPayment => ({ id: String(Math.random()), debtId: 'i1', date: '2026-02-01', amountPaid, createdAt: '' })

describe('installment progress counts amounts, not rows (D7)', () => {
  it('a half payment is not an installment', () => {
    expect(installmentPaymentsCompleted(plan, [pay(50)])).toBe(0)
  })
  it('one payment covering two installments counts as two', () => {
    expect(installmentPaymentsCompleted(plan, [pay(200)])).toBe(2)
  })
  it('two halves make one', () => {
    expect(installmentPaymentsCompleted(plan, [pay(50), pay(50)])).toBe(1)
  })
  it('caps at the plan length and the next due date follows the completed count', () => {
    expect(installmentPaymentsCompleted(plan, [pay(5000)])).toBe(12)
    expect(nextInstallmentDueFormatted(plan, 2)).toBe('Mar 15, 2026')
    expect(nextInstallmentDueFormatted(plan, 12)).toBeNull()
  })
  it('falls back to the row count when the plan has no per-installment amount', () => {
    expect(installmentPaymentsCompleted({ ...plan, installmentAmount: undefined }, [pay(1), pay(1)])).toBe(2)
  })
})
