import type { GoldKarat, InvestmentHolding } from '@/lib/store/types'
import type { LivePrice } from '@/lib/prices/assetPriceLookup'

/**
 * Value an investment holding in base currency (EGP) from the live-price cache. Fail-closed:
 * any unpriceable holding returns `{ value: null, priced: false }` and MUST be shown as
 * "— / Not counted" and excluded from every total (asset value, net worth, zakat).
 *
 * Unit maths: 1 gold pound = 8 g, 1 oz = 31.1035 g. Gold is valued at the local SELL price (the
 * per-karat market price we cache). Crypto and stocks convert to EGP at the parallel/Sagha rate,
 * never the official one. Property is the value the user typed — an area estimate never overrides it.
 */

export type HoldingAssetType = 'gold' | 'crypto' | 'stock' | 'property'
export type GoldUnit = 'grams' | 'pounds' | 'ounces'

export const GRAMS_PER_POUND = 8
export const GRAMS_PER_OUNCE = 31.1035

export type PriceLookup = (symbol: string, currency: string) => LivePrice | null

export interface HoldingValue {
  value: number | null
  priced: boolean
  asOf?: string
  confidence?: string | null
}

const unpriced: HoldingValue = { value: null, priced: false }

export function goldToGrams(quantity: number, unit: GoldUnit): number {
  if (unit === 'pounds') return quantity * GRAMS_PER_POUND
  if (unit === 'ounces') return quantity * GRAMS_PER_OUNCE
  return quantity
}

export function valueGold(
  grams: number,
  karat: GoldKarat,
  lookup: PriceLookup,
  currency = 'EGP',
): HoldingValue {
  const p = lookup(`XAU_${karat}K`, currency)
  if (!p) return unpriced
  return { value: grams * p.price, priced: true, asOf: p.asOf, confidence: p.confidence }
}

export function valueCrypto(
  quantity: number,
  symbol: string,
  lookup: PriceLookup,
  saghaUsdEgp: number | null,
): HoldingValue {
  const egp = lookup(symbol, 'EGP')
  if (egp) return { value: quantity * egp.price, priced: true, asOf: egp.asOf, confidence: egp.confidence }
  const usd = lookup(symbol, 'USD')
  if (usd && saghaUsdEgp && saghaUsdEgp > 0) {
    return { value: quantity * usd.price * saghaUsdEgp, priced: true, asOf: usd.asOf, confidence: usd.confidence }
  }
  return unpriced
}

export function valueStock(
  shares: number,
  ticker: string,
  lookup: PriceLookup,
  saghaUsdEgp: number | null,
): HoldingValue {
  const usd = lookup(ticker, 'USD')
  if (!usd || !saghaUsdEgp || saghaUsdEgp <= 0) return unpriced // halted/unknown/no rate → not counted
  return { value: shares * usd.price * saghaUsdEgp, priced: true, asOf: usd.asOf, confidence: usd.confidence }
}

/** Property is only ever the user's typed value; the area estimate is shown separately and never overrides it. */
export function valueProperty(typedValue: number | null | undefined): HoldingValue {
  if (typedValue == null || !Number.isFinite(typedValue) || typedValue <= 0) return unpriced
  return { value: typedValue, priced: true }
}

/** Sagha USD→EGP rate from the cache, for crypto/stock conversion. */
export function saghaRate(lookup: PriceLookup): number | null {
  return lookup('SAGHA_USD', 'EGP')?.price ?? null
}

/** Value one v3 holding in EGP, dispatching by asset type. Fail-closed. */
export function valueInvestmentHolding(h: InvestmentHolding, lookup: PriceLookup): HoldingValue {
  const sagha = saghaRate(lookup)
  switch (h.assetType) {
    case 'gold':
      return valueGold(h.quantity, h.karat ?? 24, lookup, 'EGP')
    case 'crypto':
      return valueCrypto(h.quantity, h.symbol ?? '', lookup, sagha)
    case 'stock':
      return valueStock(h.quantity, h.symbol ?? '', lookup, sagha)
    case 'property':
      return valueProperty(h.propertyValue)
  }
}

export interface InvestmentTotal {
  total: number
  /** True when at least one holding could not be priced — surface "net worth incomplete". */
  anyUnpriced: boolean
}

/** Sum of all priceable holdings in EGP; unpriceable ones are excluded and flagged. */
export function totalInvestmentValue(holdings: InvestmentHolding[], lookup: PriceLookup): InvestmentTotal {
  let total = 0
  let anyUnpriced = false
  for (const h of holdings) {
    const v = valueInvestmentHolding(h, lookup)
    if (v.priced && v.value != null) total += v.value
    else anyUnpriced = true
  }
  return { total, anyUnpriced }
}
