import { describe, it, expect } from 'vitest'
import { tryConvertCurrency, convertCurrency, getConversionRate } from './currency'

const rates = {
  USD_AED: 3.67,
  EGP_AED: 0.073,
}

describe('tryConvertCurrency', () => {
  it('returns same amount when currencies match', () => {
    expect(tryConvertCurrency(100, 'AED', 'AED', rates)).toBe(100)
  })

  it('converts via direct pair', () => {
    expect(tryConvertCurrency(1, 'USD', 'AED', rates)).toBeCloseTo(3.67, 5)
  })

  it('converts via reverse pair', () => {
    const r = tryConvertCurrency(3.67, 'AED', 'USD', rates)
    expect(r).toBeCloseTo(1, 5)
  })

  it('returns 0 for zero amount', () => {
    expect(tryConvertCurrency(0, 'USD', 'EGP', rates)).toBe(0)
  })

  it('returns null when no path exists', () => {
    expect(tryConvertCurrency(10, 'XYZ' as 'AED', 'AED', {})).toBeNull()
  })
})

describe('convertCurrency', () => {
  it('falls back to original amount when path missing (logs in real app)', () => {
    expect(convertCurrency(50, 'AED', 'AED', {})).toBe(50)
  })
})

describe('getConversionRate', () => {
  it('returns 1 when conversion fails', () => {
    expect(getConversionRate('AED', 'UNKNOWN' as 'AED', {})).toBe(1)
  })
})

describe('unusable rates are ignored, never used to price money', () => {
  it.each([-50, 0, Number.NaN, Number.POSITIVE_INFINITY])('a %s pair falls back to the built-in rate', (bad) => {
    const good = tryConvertCurrency(100, 'USD', 'EGP', {})
    const out = tryConvertCurrency(100, 'USD', 'EGP', { USD_EGP: bad })
    expect(out).toBe(good)
    expect(out).toBeGreaterThan(0)
  })
})
