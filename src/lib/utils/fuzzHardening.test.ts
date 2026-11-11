import { describe, expect, it } from 'vitest'
import {
  formatCompact, formatCurrency, formatFixed2, formatFlex, formatMoneyHero, formatPercent, formatQuantity, formatSigned, formatWhole,
} from '@/lib/utils/formatters'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { DEFAULT_MARKET_RATES } from '@/lib/store/defaultFinanceData'

describe('FUZ-3: formatters never print -0, NaN, Infinity or an exponent', () => {
  it('formatCompact has no negative zero', () => {
    for (const n of [-0.04, -0.005, -1e-7, -0]) expect(formatCompact(n)).toBe('0')
    expect(formatCompact(-0.4)).toBe('-0.4')
    expect(formatCompact(1250)).toBe('1.3K')
  })

  it('formatPercent stays plain digits', () => {
    expect(formatPercent(1e21)).toMatch(/^\d+%$/)
    expect(formatPercent(Infinity)).toBe('0%')
    expect(formatPercent(NaN)).toBe('0%')
    expect(formatPercent(-0.4)).toBe('0%')
    expect(formatPercent(42.6)).toBe('43%')
  })

  it('every shared formatter renders non-finite input as zero', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const out = [
        formatCompact(bad), formatPercent(bad), formatWhole(bad), formatFixed2(bad), formatFlex(bad), formatSigned(bad), formatSigned(bad, 2),
        formatQuantity(bad, 'crypto'), formatCurrency(bad, 'USD'), formatCurrency(bad, 'XAU'), formatMoneyHero(bad, 'USD'), formatMoneyHero(bad, 'USD', { compact: 'on' }),
      ]
      for (const s of out) expect(s).not.toMatch(/NaN|Infinity|∞|e\+/)
    }
  })
})

describe('FUZ-7: tryConvertCurrency never returns Infinity or NaN', () => {
  it('a tiny garbage rate fails closed', () => {
    const hostile = { AED_QAR: 1e-300, AED_BHD: 1e-300, USD_QAR: 1e-300, USD_BHD: 1e-300 }
    const out = tryConvertCurrency(1e12, 'QAR', 'BHD', hostile)
    expect(out === null || Number.isFinite(out)).toBe(true)
    const huge = tryConvertCurrency(1e300, 'USD', 'EGP', { USD_EGP: 1e300 })
    expect(huge === null || Number.isFinite(huge)).toBe(true)
  })

  it('a non-finite amount is refused rather than passed through', () => {
    expect(tryConvertCurrency(Infinity, 'USD', 'EGP', { USD_EGP: 50 })).toBeNull()
    expect(tryConvertCurrency(NaN, 'USD', 'EGP', { USD_EGP: 50 })).toBeNull()
  })
})

describe('FUZ-8: the built-in rate table round-trips', () => {
  const codes = ['USD', 'AED', 'EGP', 'EUR', 'GBP', 'SAR']
  it.each(codes.flatMap((a) => codes.filter((b) => b !== a).map((b) => [a, b] as const)))('%s -> %s -> %s within 1e-9', (a, b) => {
    const there = tryConvertCurrency(100_000, a, b, DEFAULT_MARKET_RATES)!
    const back = tryConvertCurrency(there, b, a, DEFAULT_MARKET_RATES)!
    expect(Math.abs(back - 100_000) / 100_000).toBeLessThan(1e-9)
  })
})
