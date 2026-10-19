import { describe, it, expect } from 'vitest'
import { hasCurrencySign } from './CurrencyMark'

describe('hasCurrencySign', () => {
  it('draws a sign for currencies that have one', () => {
    for (const c of ['AED', 'SAR', 'USD', 'EUR', 'GBP', 'EGP', 'KWD', 'QAR', 'BHD', 'OMR', 'MAD', 'TND', 'JOD']) expect(hasCurrencySign(c)).toBe(true)
  })
  it('falls back to the three letters, shown once, for a currency we have no sign for', () => {
    for (const c of ['XYZ', 'CHF']) expect(hasCurrencySign(c)).toBe(false)
  })
})
