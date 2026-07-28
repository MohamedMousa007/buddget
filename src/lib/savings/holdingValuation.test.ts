import { describe, it, expect } from 'vitest'
import {
  goldToGrams, valueGold, valueCrypto, valueStock, valueProperty, saghaRate,
  type PriceLookup,
} from './holdingValuation'
import type { LivePrice } from '@/lib/prices/assetPriceLookup'

const P = (price: number): LivePrice => ({ price, asOf: '2026-07-29T10:00:00Z', confidence: 'high' })

const lookupFrom = (m: Record<string, number>): PriceLookup => (s, c) =>
  m[`${s}:${c}`] != null ? P(m[`${s}:${c}`]) : null

describe('goldToGrams', () => {
  it('converts pounds and ounces', () => {
    expect(goldToGrams(2, 'pounds')).toBe(16)
    expect(goldToGrams(1, 'ounces')).toBeCloseTo(31.1035, 4)
    expect(goldToGrams(50, 'grams')).toBe(50)
  })
})

describe('valueGold', () => {
  const lookup = lookupFrom({ 'XAU_21K:EGP': 5990, 'XAU_24K:EGP': 6846 })
  it('values grams at the local karat sell price', () => {
    expect(valueGold(10, 21, lookup).value).toBe(59900)
  })
  it('fail-closed when the karat is not priced', () => {
    expect(valueGold(10, 18, lookup)).toEqual({ value: null, priced: false })
  })
})

describe('valueCrypto', () => {
  it('uses a direct EGP price when present', () => {
    const lookup = lookupFrom({ 'BTC:EGP': 3_000_000 })
    expect(valueCrypto(0.5, 'BTC', lookup, 52).value).toBe(1_500_000)
  })
  it('falls back to USD × Sagha rate', () => {
    const lookup = lookupFrom({ 'BTC:USD': 64000 })
    expect(valueCrypto(0.5, 'BTC', lookup, 52).value).toBe(0.5 * 64000 * 52)
  })
  it('fail-closed with no price and no rate', () => {
    expect(valueCrypto(1, 'BTC', lookupFrom({}), null)).toEqual({ value: null, priced: false })
  })
})

describe('valueStock', () => {
  const lookup = lookupFrom({ 'AAPL:USD': 210 })
  it('shares × USD × Sagha rate', () => {
    expect(valueStock(10, 'AAPL', lookup, 52).value).toBe(10 * 210 * 52)
  })
  it('halted/unknown (no USD price) → not counted', () => {
    expect(valueStock(10, 'XXXX', lookup, 52)).toEqual({ value: null, priced: false })
  })
})

describe('valueProperty', () => {
  it('is the typed value only', () => {
    expect(valueProperty(2_000_000).value).toBe(2_000_000)
    expect(valueProperty(null)).toEqual({ value: null, priced: false })
    expect(valueProperty(0)).toEqual({ value: null, priced: false })
  })
})

describe('saghaRate', () => {
  it('reads SAGHA_USD:EGP from the cache', () => {
    expect(saghaRate(lookupFrom({ 'SAGHA_USD:EGP': 52.4 }))).toBe(52.4)
    expect(saghaRate(lookupFrom({}))).toBeNull()
  })
})
