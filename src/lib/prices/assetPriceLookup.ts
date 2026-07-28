import { isPriceFresh } from '@/lib/prices/freshness'

/**
 * Client-side read model over the asset_prices cache. Fail-closed: a missing OR stale price returns
 * null, and every caller must render "unavailable / not counted" and exclude it from totals — never
 * fabricate or show a stale number as live.
 */
export interface AssetPriceEntry {
  symbol: string
  currency: string
  price: number
  asOf: string
  assetClass: string
  confidence: string | null
}

export type AssetPriceMap = Record<string, AssetPriceEntry>

export function priceKey(symbol: string, currency: string): string {
  return `${symbol.toUpperCase()}:${currency.toUpperCase()}`
}

export function buildAssetPriceMap(rows: AssetPriceEntry[]): AssetPriceMap {
  const m: AssetPriceMap = {}
  for (const r of rows) m[priceKey(r.symbol, r.currency)] = r
  return m
}

export interface LivePrice {
  price: number
  asOf: string
  confidence: string | null
}

/** Fresh price for (symbol, currency), or null when missing/stale. */
export function lookupAssetPrice(
  map: AssetPriceMap,
  symbol: string,
  currency: string,
  now: Date = new Date(),
): LivePrice | null {
  const e = map[priceKey(symbol, currency)]
  if (!e) return null
  if (!isPriceFresh(e.asOf, e.assetClass, now)) return null
  return { price: e.price, asOf: e.asOf, confidence: e.confidence }
}
