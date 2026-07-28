/**
 * GoldAPI.io — keyed. `GET /api/XAU/{currency}` with header `x-access-token: <key>` returns the
 * ounce price AND per-gram karat prices IN THAT CURRENCY. For pegged AED/SAR this gives exact
 * Gulf karat prices with no crawling; it's also a second independent spot upstream for USD.
 * Docs response shape (verified live): { price, price_gram_24k, price_gram_22k, price_gram_21k,
 * price_gram_18k, ... }.
 */
import type { GoldKarat } from '@/lib/store/types'

export interface GoldApiKaratRow {
  karat: GoldKarat
  pricePerGram: number
}

const KARAT_FIELDS: Array<[GoldKarat, string]> = [
  [24, 'price_gram_24k'],
  [22, 'price_gram_22k'],
  [21, 'price_gram_21k'],
  [18, 'price_gram_18k'],
]

/** Per-gram karat prices from a GoldAPI.io response. Pure + testable. */
export function parseGoldApiKarats(json: unknown): GoldApiKaratRow[] {
  if (!json || typeof json !== 'object') return []
  const o = json as Record<string, unknown>
  const rows: GoldApiKaratRow[] = []
  for (const [karat, field] of KARAT_FIELDS) {
    const v = o[field]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) rows.push({ karat, pricePerGram: v })
  }
  return rows
}

/** Ounce price from a GoldAPI.io response (the requested currency). */
export function parseGoldApiOunce(json: unknown): number | null {
  if (!json || typeof json !== 'object') return null
  const p = (json as { price?: unknown }).price
  return typeof p === 'number' && Number.isFinite(p) && p > 0 ? p : null
}

export function goldApiUrl(currency: string): string {
  return `https://www.goldapi.io/api/XAU/${currency.toUpperCase()}`
}
