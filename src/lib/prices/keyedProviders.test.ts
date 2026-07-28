import { describe, it, expect } from 'vitest'
import { parseGoldApiKarats, parseGoldApiOunce } from './goldApiIo'
import { parseFinnhubQuote } from './finnhub'
import { parseGoldpricezGram24k } from './goldpricez'

// Real GoldAPI.io response (user-provided, XAU/USD).
const GOLDAPI = {
  timestamp: 1784944182, metal: 'XAU', currency: 'USD', exchange: 'FOREXCOM',
  price: 4052.78, prev_close_price: 4049.725,
  price_gram_24k: 130.2999, price_gram_22k: 119.4416, price_gram_21k: 114.0124,
  price_gram_20k: 108.5833, price_gram_18k: 97.7249, price_gram_14k: 76.0083, price_gram_10k: 54.2916,
}

describe('GoldAPI.io parser', () => {
  it('extracts 24/22/21/18k per-gram prices', () => {
    const rows = parseGoldApiKarats(GOLDAPI)
    expect(rows).toContainEqual({ karat: 24, pricePerGram: 130.2999 })
    expect(rows).toContainEqual({ karat: 21, pricePerGram: 114.0124 })
    expect(rows).toContainEqual({ karat: 18, pricePerGram: 97.7249 })
    // ratios track purity: 21k / 24k ≈ 0.875
    const g24 = rows.find((r) => r.karat === 24)!.pricePerGram
    const g21 = rows.find((r) => r.karat === 21)!.pricePerGram
    expect(g21 / g24).toBeCloseTo(0.875, 2)
  })
  it('extracts the ounce price', () => {
    expect(parseGoldApiOunce(GOLDAPI)).toBe(4052.78)
  })
  it('tolerates junk', () => {
    expect(parseGoldApiKarats(null)).toEqual([])
    expect(parseGoldApiOunce({})).toBeNull()
  })
})

describe('Finnhub parser', () => {
  it('reads the current price', () => {
    expect(parseFinnhubQuote('AAPL', { c: 213.5, d: 1.2, dp: 0.5 })).toEqual({ symbol: 'AAPL', price: 213.5 })
  })
  it('treats c=0 (halted/unknown) as null — stays out of totals', () => {
    expect(parseFinnhubQuote('XXXX', { c: 0 })).toBeNull()
  })
})

describe('goldpricez parser', () => {
  it('reads a per-gram 24k number from varied shapes', () => {
    expect(parseGoldpricezGram24k({ gram_in_24k: '4321.5' })).toBe(4321.5)
    expect(parseGoldpricezGram24k({ price_gram_24k: 130.3 })).toBe(130.3)
    expect(parseGoldpricezGram24k('4200')).toBe(4200)
  })
  it('null on unusable', () => {
    expect(parseGoldpricezGram24k({ nope: 1 })).toBeNull()
    expect(parseGoldpricezGram24k('x')).toBeNull()
  })
})
