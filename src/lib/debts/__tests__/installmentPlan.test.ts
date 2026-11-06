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
  const plan = (count: number, completed: number) => ({ count, completed })
  it('the last installment absorbs the rounding residual (100 / 3 leaves 0.01)', () => {
    expect(settleInstallmentAmount(33.33, 33.34, plan(3, 2))).toBe(33.34)
  })
  it('leaves normal installments and real balances alone', () => {
    expect(settleInstallmentAmount(33.33, 66.67, plan(3, 1))).toBe(33.33)
  })
  it('only the last slice absorbs a remainder: a long plan keeps charging its normal slice', () => {
    expect(settleInstallmentAmount(100, 101, plan(360, 10))).toBe(100)
    expect(settleInstallmentAmount(100, 100.04, plan(360, 100))).toBe(100)
  })
  it('clamps an overshoot to what is left (200 / 3 = 66.67 x 3)', () => {
    expect(settleInstallmentAmount(66.67, 66.66, plan(3, 2))).toBe(66.66)
    expect(settleInstallmentAmount(66.67, 66.66)).toBe(66.66)
  })
  it('without a plan (a recurring payment on a loan) a slice is never grown past its amount', () => {
    expect(settleInstallmentAmount(100, 5000)).toBe(100)
  })

  // FUZ-4: 12+ installments stranded 1c-56c because the dust tolerance was capped at 5c.
  it('24 installments of 328,264.39 clear to the cent (was 0.07 stranded)', () => {
    const total = 328264.39
    const per = perFromTotal(total, 24)
    let remaining = total
    for (let k = 0; k < 24; k++) {
      remaining = Math.round((remaining - settleInstallmentAmount(per, remaining, plan(24, k))) * 100) / 100
    }
    expect(remaining).toBe(0)
  })

  it('installments always sum to the total to the cent, over thousands of random plans', () => {
    let seed = 20261106
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const counts = [2, 3, 4, 6, 7, 9, 10, 12, 18, 24, 36, 48, 60, 120, 360]
    for (let i = 0; i < 6000; i++) {
      const n = counts[Math.floor(rnd() * counts.length)]
      const cents = 100 + Math.floor(rnd() * 50_000_000)
      const total = cents / 100
      const per = perFromTotal(total, n)
      let remaining = total
      let paidCents = 0
      let posted = 0
      while (remaining > 0 && posted < n) {
        const pay = settleInstallmentAmount(per, remaining, plan(n, posted))
        paidCents += Math.round(pay * 100)
        remaining = Math.round((remaining - pay) * 100) / 100
        posted++
      }
      expect({ total, n, remaining, paidCents, posted }).toEqual({ total, n, remaining: 0, paidCents: cents, posted })
    }
  })

  it('per-payment entry mode (total = per x count) also clears', () => {
    for (const [per, n] of [[333.33, 3], [0.07, 120], [1999.99, 36], [12.34, 17]] as const) {
      const total = totalFromPer(per, n)
      let remaining = total
      for (let k = 0; k < n && remaining > 0; k++) {
        remaining = Math.round((remaining - settleInstallmentAmount(per, remaining, plan(n, k))) * 100) / 100
      }
      expect(remaining).toBe(0)
    }
  })
})
