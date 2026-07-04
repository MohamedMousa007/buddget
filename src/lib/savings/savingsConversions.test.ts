import { describe, it, expect } from 'vitest'
import type { SavingsAccount } from '@/lib/store/types'
import { savingsAccountConversionAmounts } from './savingsConversions'

const gold = (grams: number): SavingsAccount => ({
  id: 'g1',
  name: 'Gold',
  category: 'investment',
  type: 'other',
  currency: 'XAU',
  currentBalance: grams,
  createdAt: '2026-01-01',
})

describe('savingsAccountConversionAmounts — XAU', () => {
  // Regression: XAU balances are grams; must NOT convert via the rates map's
  // per-troy-ounce XAU rate (that was ~31x too small). Uses base-currency spot.
  it('values gold grams at the base-currency 24k spot, not per-ounce', () => {
    const goldPricePerGram = 5000 // EGP/g, base currency
    // A misleading per-ounce XAU rate that must be ignored for grams:
    const rates = { XAU_EGP: 155000, EGP_XAU: 1 / 155000 }
    const { primary } = savingsAccountConversionAmounts(
      gold(100),
      'EGP',
      null,
      false,
      rates,
      goldPricePerGram
    )
    expect(primary).toBe(500000) // 100g * 5000, not 100 * 155000 nor /31
  })

  it('converts the base value to a secondary currency via FX', () => {
    const rates = { EGP_USD: 0.02, USD_EGP: 50 }
    const { primary, secondary } = savingsAccountConversionAmounts(
      gold(10),
      'EGP',
      'USD',
      true,
      rates,
      5000
    )
    expect(primary).toBe(50000) // 10g * 5000 EGP
    expect(secondary).toBeCloseTo(1000, 5) // 50000 EGP * 0.02
  })
})
