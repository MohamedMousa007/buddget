import { describe, expect, it } from 'vitest'
import { lengthForPayments, paymentsForLength, perFromTotal, totalFromPer } from '../installmentPlan'

describe('installmentPlan', () => {
  it('maps plan length to a payment count per frequency', () => {
    expect(paymentsForLength(12, 'months', 'monthly')).toBe(12)
    expect(paymentsForLength(2, 'years', 'monthly')).toBe(24)
    expect(paymentsForLength(1, 'years', 'quarterly')).toBe(4)
    expect(paymentsForLength(1, 'years', 'weekly')).toBe(52)
    expect(paymentsForLength(0, 'months', 'monthly')).toBe(1)
  })
  it('round-trips count to length', () => {
    expect(lengthForPayments(24, 'years', 'monthly')).toBe(2)
    expect(lengthForPayments(6, 'months', 'monthly')).toBe(6)
    expect(lengthForPayments(4, 'years', 'quarterly')).toBe(1)
  })
  it('converts between total and per-payment', () => {
    expect(totalFromPer(250, 12)).toBe(3000)
    expect(perFromTotal(1000, 3)).toBe(333.33)
  })
})
