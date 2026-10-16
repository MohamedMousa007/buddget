import { describe, expect, it } from 'vitest'
import { goalAmountPerPayment, goalDurationFromTarget, goalPaymentCount, goalTargetDate } from '../borrowGoal'

describe('borrowGoal', () => {
  it('counts payments per frequency', () => {
    expect(goalPaymentCount(12, 'months', 'monthly')).toBe(12)
    expect(goalPaymentCount(2, 'years', 'monthly')).toBe(24)
    expect(goalPaymentCount(1, 'years', 'quarterly')).toBe(4)
    expect(goalPaymentCount(2, 'years', 'annually')).toBe(2)
    expect(goalPaymentCount(1, 'months', 'annually')).toBe(1)
    expect(goalPaymentCount(6, 'months', 'weekly')).toBe(26)
  })
  it('splits the total evenly with no interest', () => {
    expect(goalAmountPerPayment(12000, 1, 'years', 'monthly')).toBe(1000)
    expect(goalAmountPerPayment(1000, 3, 'months', 'monthly')).toBe(333.33)
  })
  it('derives and recovers the target date', () => {
    const from = new Date(2026, 0, 15)
    expect(goalTargetDate(18, 'months', from)).toBe('2027-07-15')
    expect(goalDurationFromTarget('2028-01-15', from)).toEqual({ duration: 2, unit: 'years' })
    expect(goalDurationFromTarget('2026-10-15', from)).toEqual({ duration: 9, unit: 'months' })
  })
})
