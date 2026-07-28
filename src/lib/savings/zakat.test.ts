import { describe, it, expect } from 'vitest'
import { computeZakat, type ZakatInput } from './zakat'

const base: ZakatInput = {
  cashAndSavings: 0, goldValue: 0, cryptoValue: 0, stocksValue: 0,
  holdsForTrading: false, debtsDueThisYear: 0,
  nisabBasis: 'silver', gold24kSellPerGram: 6846, silverPerGram: 75,
}

describe('computeZakat', () => {
  it('2.5% when above the silver nisab', () => {
    const r = computeZakat({ ...base, cashAndSavings: 100_000 })
    expect(r.nisab).toBeCloseTo(595 * 75, 5) // 44,625
    expect(r.due).toBe(true)
    expect(r.zakat).toBeCloseTo(2_500, 5)
    expect(r.gap).toBe(0)
  })

  it('below nisab → nothing owed, reports the shortfall', () => {
    const r = computeZakat({ ...base, cashAndSavings: 40_000 })
    expect(r.due).toBe(false)
    expect(r.zakat).toBe(0)
    expect(r.gap).toBeCloseTo(4_625, 5) // 44,625 − 40,000
  })

  it('long-term stocks count 30%, trading counts 100%', () => {
    const longTerm = computeZakat({ ...base, stocksValue: 100_000 })
    expect(longTerm.zakatable).toBe(30_000)
    const trading = computeZakat({ ...base, stocksValue: 100_000, holdsForTrading: true })
    expect(trading.zakatable).toBe(100_000)
  })

  it('subtracts short-term debts, floored at zero', () => {
    expect(computeZakat({ ...base, cashAndSavings: 50_000, debtsDueThisYear: 10_000 }).zakatable).toBe(40_000)
    expect(computeZakat({ ...base, cashAndSavings: 5_000, debtsDueThisYear: 10_000 }).zakatable).toBe(0)
  })

  it('gold nisab is the higher line (85g × 24k sell)', () => {
    const r = computeZakat({ ...base, nisabBasis: 'gold', cashAndSavings: 500_000 })
    expect(r.nisab).toBeCloseTo(85 * 6846, 5) // ~581,910
    expect(r.due).toBe(false) // 500k < 581.9k
  })

  it('manual override replaces the figure entirely', () => {
    const r = computeZakat({ ...base, cashAndSavings: 100_000, manualAmount: 1_234 })
    expect(r.zakat).toBe(1_234)
    expect(r.due).toBe(true)
  })

  it('property principal is never passed in — cash is the only property-derived input', () => {
    // (documents the contract: goldValue/cryptoValue/stocksValue only; no property field exists)
    const r = computeZakat({ ...base, cashAndSavings: 50_000 })
    expect(r.zakatable).toBe(50_000)
  })
})
