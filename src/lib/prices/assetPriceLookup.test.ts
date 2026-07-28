import { describe, it, expect } from 'vitest'
import { buildAssetPriceMap, lookupAssetPrice, priceKey, type AssetPriceEntry } from './assetPriceLookup'

const now = new Date('2026-07-29T12:00:00Z')
const entry = (over: Partial<AssetPriceEntry>): AssetPriceEntry => ({
  symbol: 'XAU_21K', currency: 'EGP', price: 5990, asOf: '2026-07-29T10:00:00Z',
  assetClass: 'gold', confidence: 'high', ...over,
})

describe('assetPriceLookup', () => {
  it('keys case-insensitively', () => {
    expect(priceKey('btc', 'usd')).toBe('BTC:USD')
  })

  it('returns a fresh price', () => {
    const map = buildAssetPriceMap([entry({})])
    expect(lookupAssetPrice(map, 'XAU_21K', 'EGP', now)?.price).toBe(5990)
  })

  it('fail-closed on a missing symbol', () => {
    expect(lookupAssetPrice(buildAssetPriceMap([]), 'BTC', 'USD', now)).toBeNull()
  })

  it('fail-closed on a stale price (gold > 6h old)', () => {
    const map = buildAssetPriceMap([entry({ asOf: '2026-07-29T04:00:00Z' })]) // 8h old
    expect(lookupAssetPrice(map, 'XAU_21K', 'EGP', now)).toBeNull()
  })

  it('crypto tolerates up to 6h, stock up to 48h', () => {
    const crypto = buildAssetPriceMap([entry({ symbol: 'BTC', currency: 'USD', assetClass: 'crypto', asOf: '2026-07-29T07:00:00Z' })])
    expect(lookupAssetPrice(crypto, 'BTC', 'USD', now)).not.toBeNull()
    const stock = buildAssetPriceMap([entry({ symbol: 'AAPL', currency: 'USD', assetClass: 'stock', asOf: '2026-07-28T12:00:00Z' })])
    expect(lookupAssetPrice(stock, 'AAPL', 'USD', now)).not.toBeNull()
  })
})
