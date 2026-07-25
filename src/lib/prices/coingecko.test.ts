import { describe, it, expect } from 'vitest'
import { parseCoinGeckoSimplePrice } from './coingecko'
import { isPriceFresh, stalenessWindowMs } from './freshness'

describe('parseCoinGeckoSimplePrice', () => {
  it('flattens the nested response, upcasing currencies, dropping unknown coins', () => {
    const rows = parseCoinGeckoSimplePrice({
      bitcoin: { aed: 234951, usd: 63976 },
      ethereum: { usd: 1858.03 },
      dogecoin: { usd: 0.1 }, // not in COINGECKO_IDS → ignored
    })
    expect(rows).toContainEqual({ symbol: 'BTC', currency: 'AED', price: 234951 })
    expect(rows).toContainEqual({ symbol: 'BTC', currency: 'USD', price: 63976 })
    expect(rows).toContainEqual({ symbol: 'ETH', currency: 'USD', price: 1858.03 })
    expect(rows.some((r) => r.symbol === undefined)).toBe(false)
  })

  it('drops non-positive / non-finite prices', () => {
    const rows = parseCoinGeckoSimplePrice({ bitcoin: { usd: 0, aed: -1, egp: 'x' } })
    expect(rows).toHaveLength(0)
  })

  it('tolerates junk', () => {
    expect(parseCoinGeckoSimplePrice(null)).toEqual([])
    expect(parseCoinGeckoSimplePrice('nope')).toEqual([])
  })
})

describe('freshness', () => {
  const now = new Date('2026-07-25T12:00:00Z')
  it('crypto fresh within 6h, stale after', () => {
    expect(isPriceFresh('2026-07-25T09:00:00Z', 'crypto', now)).toBe(true)
    expect(isPriceFresh('2026-07-25T05:00:00Z', 'crypto', now)).toBe(false)
  })
  it('fx (Sagha) tolerates 12h', () => {
    expect(isPriceFresh('2026-07-25T01:00:00Z', 'fx', now)).toBe(true)
  })
  it('a future timestamp is not fresh', () => {
    expect(isPriceFresh('2026-07-25T13:00:00Z', 'crypto', now)).toBe(false)
  })
  it('unknown class falls back to a default window', () => {
    expect(stalenessWindowMs('mystery')).toBeGreaterThan(0)
  })
})
