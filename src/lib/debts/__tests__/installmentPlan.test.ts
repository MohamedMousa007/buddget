import { describe, expect, it } from 'vitest'
import { lengthForPayments, paymentsForLength, perFromTotal, settleInstallmentAmount, totalFromPer } from '../installmentPlan'

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

describe('settleInstallmentAmount', () => {
  it('the last installment absorbs the rounding residual (100 / 3 leaves 0.01)', () => {
    expect(settleInstallmentAmount(33.33, 33.34, 3)).toBe(33.34)
  })
  it('leaves normal installments and real balances alone', () => {
    expect(settleInstallmentAmount(33.33, 66.67, 3)).toBe(33.33)
  })
  it('dust is capped for long plans (360 installments must not swallow a real 1.00 balance)', () => {
    expect(settleInstallmentAmount(100, 101, 360)).toBe(100)
    expect(settleInstallmentAmount(100, 100.04, 360)).toBe(100.04)
  })
  it('clamps an overshoot to what is left (200 / 3 = 66.67 x 3)', () => {
    expect(settleInstallmentAmount(66.67, 66.66, 3)).toBe(66.66)
  })
})
