import { describe, expect, it } from 'vitest'
import { withinSpotBand } from '@/lib/prices/goldSanity'
import { parseGoldpricezGram24k } from '@/lib/prices/goldpricez'

describe('RPW-6: Gulf gold quotes are sanity checked against spot x peg', () => {
  const ounce = 4000 // 128.6 USD/g, 472.3 AED/g, 482.3 SAR/g
  it('accepts a quote near spot x peg and rejects a 31x or 0.03x one', () => {
    expect(withinSpotBand(475, 'AED', ounce)).toBe(true)
    expect(withinSpotBand(485, 'SAR', ounce)).toBe(true)
    expect(withinSpotBand(475 * 31.1035, 'AED', ounce)).toBe(false)
    expect(withinSpotBand(9_999_999, 'AED', ounce)).toBe(false)
    expect(withinSpotBand(0, 'AED', ounce)).toBe(false)
    expect(withinSpotBand(NaN, 'SAR', ounce)).toBe(false)
  })

  it('goldpricez: an ounce price is not read as a gram price', () => {
    expect(parseGoldpricezGram24k({ ounce_price_24k: '14700' })).toBeNull()
    expect(parseGoldpricezGram24k({ gram_in_24k: '472.5', ounce_price_24k: '14700' })).toBe(472.5)
  })
})
