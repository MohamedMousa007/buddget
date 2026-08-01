import { describe, it, expect } from 'vitest'
import { buildAssetPriceMap, lookupAssetPrice, lookupAssetPriceDisplay } from '@/lib/prices/assetPriceLookup'

const now = new Date('2026-08-01T12:00:00Z')
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString()

const map = buildAssetPriceMap([
  { symbol: 'XAU_24K', currency: 'EGP', price: 6646, asOf: hoursAgo(2), assetClass: 'gold', confidence: 'high' }, // fresh (<6h)
  { symbol: 'SAGHA_USD', currency: 'EGP', price: 51.6, asOf: hoursAgo(80), assetClass: 'fx', confidence: 'high' }, // stale (>12h)
])

describe('price display tiering', () => {
  it('valuation lookup is fail-closed — fresh returns, stale returns null', () => {
    expect(lookupAssetPrice(map, 'XAU_24K', 'EGP', now)?.price).toBe(6646)
    expect(lookupAssetPrice(map, 'SAGHA_USD', 'EGP', now)).toBeNull()
    expect(lookupAssetPrice(map, 'BTC', 'USD', now)).toBeNull() // missing
  })

  it('display lookup shows stale prices flagged, null only when missing', () => {
    const fresh = lookupAssetPriceDisplay(map, 'XAU_24K', 'EGP', now)
    expect(fresh).toMatchObject({ price: 6646, fresh: true })

    const stale = lookupAssetPriceDisplay(map, 'SAGHA_USD', 'EGP', now)
    expect(stale).toMatchObject({ price: 51.6, fresh: false }) // shown, but flagged stale

    expect(lookupAssetPriceDisplay(map, 'BTC', 'USD', now)).toBeNull() // truly absent
  })
})
