import { describe, expect, it } from 'vitest'
import { tryConvertCurrency } from '@/lib/utils/currency'

describe('tryConvertCurrency live-rate precedence (M17)', () => {
  it('a two-hop bridge uses live rates, not the stale built-in AED pairs', () => {
    const live = { EUR_USD: 1.1, SAR_USD: 0.2667 }
    expect(tryConvertCurrency(1, 'EUR', 'SAR', live)).toBeCloseTo(1.1 / 0.2667, 4)
  })
  it('a live reverse pair beats a stale built-in direct pair', () => {
    expect(tryConvertCurrency(1, 'USD', 'AED', { AED_USD: 0.25 })).toBeCloseTo(4, 6)
  })
  it('still falls back to built-in pairs when live rates have no path', () => {
    expect(tryConvertCurrency(100, 'USD', 'AED', {})).toBeCloseTo(367.25, 6)
    expect(tryConvertCurrency(1, 'JPY', 'EGP', {})).toBeNull()
  })
})
