import { describe, it, expect } from 'vitest'
import { tryConvertCurrency, tryConvertWithGold } from './currency'
import { cashSavingsDepositsInBaseForMonth, netSavingsLedgerInBaseForMonth } from './calculations'
import type { SavingsTransaction } from '@/lib/store/types'

// Ounce-based cross-rates as the old /api/rates produced them (ounces per unit).
const STALE_OUNCE_RATES = { USD_XAU: 1 / 2400, EGP_XAU: 1 / (2400 * 50), XAU_EGP: 2400 * 50, EGP_USD: 0.02, USD_EGP: 50 }
const GOLD = { pricePerGram: 6430, available: true }

describe('XAU conversion (W1)', () => {
  it('tryConvertCurrency refuses any XAU endpoint, even with stale ounce keys cached', () => {
    expect(tryConvertCurrency(100_000, 'EGP', 'XAU', STALE_OUNCE_RATES)).toBeNull()
    expect(tryConvertCurrency(10, 'XAU', 'EGP', STALE_OUNCE_RATES)).toBeNull()
    expect(tryConvertCurrency(10, 'XAU', 'XAU', STALE_OUNCE_RATES)).toBe(10)
  })

  it('converts EGP into grams through the gram price (100,000 EGP is ~15.55 g, not 0.5)', () => {
    const grams = tryConvertWithGold(100_000, 'EGP', 'XAU', STALE_OUNCE_RATES, 'EGP', GOLD)
    expect(grams).toBeCloseTo(100_000 / 6430, 6)
  })

  it('converts grams to base and to a third currency', () => {
    expect(tryConvertWithGold(2, 'XAU', 'EGP', STALE_OUNCE_RATES, 'EGP', GOLD)).toBe(12_860)
    expect(tryConvertWithGold(2, 'XAU', 'USD', STALE_OUNCE_RATES, 'EGP', GOLD)).toBeCloseTo(12_860 * 0.02, 6)
  })

  it('returns null when gold has no price', () => {
    expect(tryConvertWithGold(2, 'XAU', 'EGP', {}, 'EGP', { pricePerGram: 0, available: false })).toBeNull()
    expect(tryConvertWithGold(2, 'EGP', 'XAU', {}, 'EGP', { pricePerGram: 6430, available: false })).toBeNull()
  })

  it('does not count grams as base money in savings sums', () => {
    const tx = (over: Partial<SavingsTransaction>): SavingsTransaction => ({
      id: 'x', accountId: 'g', type: 'deposit', amount: 10, currency: 'XAU', date: '2026-10-05', ...over,
    }) as SavingsTransaction
    const rows = [tx({})]
    expect(cashSavingsDepositsInBaseForMonth(rows, '2026-10', 1, 'EGP', {}, GOLD)).toBe(64_300)
    expect(cashSavingsDepositsInBaseForMonth(rows, '2026-10', 1, 'EGP', {}, { pricePerGram: 0, available: false })).toBe(0)
    expect(netSavingsLedgerInBaseForMonth([tx({ type: 'withdrawal', amount: 2 })], '2026-10', 1, 'EGP', {}, GOLD)).toBe(-12_860)
  })
})
