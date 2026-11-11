import { describe, expect, it } from 'vitest'
import { plausibleRates } from '@/lib/utils/rateBands'

describe('RPW-7: provider rates must be plausible', () => {
  it('drops a rate far outside its band and keeps real ones', () => {
    const out = plausibleRates({ EGP: 1e-6, AED: 3.6725, EUR: 0.92, KWD: 3, SAR: 3.75, XYZ: 5, GBP: 1e9, XAU: 0.00025 })
    expect(Object.keys(out).sort()).toEqual(['AED', 'EUR', 'SAR', 'XAU', 'XYZ'])
  })
  it('drops non-finite and non-positive values', () => {
    expect(plausibleRates({ EGP: NaN, EUR: -1, GBP: 0, AED: 3.67 })).toEqual({ AED: 3.67 })
  })
})
