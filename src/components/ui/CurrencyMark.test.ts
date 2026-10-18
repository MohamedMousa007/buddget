import { describe, it, expect } from 'vitest'
import { hasCurrencySign } from './CurrencyMark'

describe('hasCurrencySign', () => {
  it('draws a sign for currencies that have one', () => {
    for (const c of ['AED', 'SAR', 'USD', 'EUR', 'GBP', 'EGP']) expect(hasCurrencySign(c)).toBe(true)
  })
  it('falls back to the three letters, shown once, when there is no sign', () => {
    for (const c of ['KWD', 'QAR', 'BHD', 'OMR', 'MAD', 'TND', 'JOD', 'XYZ']) expect(hasCurrencySign(c)).toBe(false)
  })
})
