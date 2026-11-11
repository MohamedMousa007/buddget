import type { Currency } from '@/lib/store/types'

export const GOLD_CURRENCY = 'XAU'

/** Gold spot in the user's base currency, per gram of 24k. `available` is false when no live price exists. */
export interface GoldQuote {
  pricePerGram: number
  available: boolean
}

const DEFAULT_RATES: Record<string, number> = {
  USD_AED: 3.6725,
  EGP_AED: 0.0731,
  EUR_AED: 4.02,
  GBP_AED: 4.65,
  SAR_AED: 0.98,
}

/**
 * Convert between currencies using known direct/reverse pairs and AED/USD bridges.
 * Returns null when no conversion path exists (strict / fail-closed).
 */
export function tryConvertCurrency(
  amount: number,
  fromCurrency: Currency | string,
  toCurrency: Currency | string,
  rates: Record<string, number>
): number | null {
  if (fromCurrency === toCurrency) return amount
  if (amount === 0) return 0
  if (!Number.isFinite(amount)) return null

  const from = String(fromCurrency)
  const to = String(toCurrency)
  // XAU balances are grams; any rates-map XAU key is per troy ounce. The unit is defined once,
  // in tryConvertWithGold (gram price), so the rates table can never price gold here.
  if (from === GOLD_CURRENCY || to === GOLD_CURRENCY) return null
  /** Treat stables as USD for FX bridges (no on-chain spread modeled). */
  if (from === 'USDT' || from === 'USDC') {
    return tryConvertCurrency(amount, 'USD', toCurrency, rates)
  }
  if (to === 'USDT' || to === 'USDC') {
    return tryConvertCurrency(amount, fromCurrency, 'USD', rates)
  }

  // Live rates get the first full attempt: a stale built-in pair must never outrank them on a bridge.
  return finiteOrNull(convertVia(amount, from, to, rates)) ?? finiteOrNull(convertVia(amount, from, to, { ...DEFAULT_RATES, ...rates }))
}

/** A product of usable rates can still overflow or underflow; that is no conversion at all. */
const finiteOrNull = (n: number | null): number | null => (n !== null && Number.isFinite(n) ? n : null)

/** A rate that can price money: finite and above zero. Anything else is treated as absent. */
const usableRate = (r: number | undefined): r is number => typeof r === 'number' && Number.isFinite(r) && r > 0

function convertVia(amount: number, from: string, to: string, table: Record<string, number>): number | null {
  const direct = table[`${from}_${to}`]
  if (usableRate(direct)) return amount * direct

  const reverse = table[`${to}_${from}`]
  if (usableRate(reverse)) return amount / reverse

  const fromToAed = findRate(from, 'AED', table)
  const aedToTarget = findRate('AED', to, table)
  if (fromToAed !== null && aedToTarget !== null) {
    return amount * fromToAed * aedToTarget
  }

  const fromToUsd = findRate(from, 'USD', table)
  const usdToTarget = findRate('USD', to, table)
  if (fromToUsd !== null && usdToTarget !== null) {
    return amount * fromToUsd * usdToTarget
  }

  return null
}

/**
 * Like tryConvertCurrency but understands gold: XAU amounts are grams, priced through the base-currency
 * gram price (never the per-ounce rates entry). Null when gold is unpriced or no FX path exists.
 */
export function tryConvertWithGold(
  amount: number,
  fromCurrency: Currency | string,
  toCurrency: Currency | string,
  rates: Record<string, number>,
  baseCurrency: Currency | string,
  gold: GoldQuote
): number | null {
  if (fromCurrency === toCurrency) return amount
  const fromGold = fromCurrency === GOLD_CURRENCY
  const toGold = toCurrency === GOLD_CURRENCY
  if (!fromGold && !toGold) return tryConvertCurrency(amount, fromCurrency, toCurrency, rates)
  if (!gold.available || !(gold.pricePerGram > 0)) return null
  if (fromGold) return tryConvertCurrency(amount * gold.pricePerGram, baseCurrency, toCurrency, rates)
  const inBase = tryConvertCurrency(amount, fromCurrency, baseCurrency, rates)
  return inBase === null ? null : inBase / gold.pricePerGram
}

/** A sum that skipped rows it could not convert; `incomplete` tells the UI the total is a lower bound. */
export interface PartialSum {
  total: number
  incomplete: boolean
}

/** Sums `convert(item)` over items, leaving out (and flagging) every item with no conversion path. */
export function sumConverted<T>(items: readonly T[], convert: (item: T) => number | null): PartialSum {
  let total = 0
  let incomplete = false
  for (const item of items) {
    const v = convert(item)
    if (v === null) incomplete = true
    else total += v
  }
  return { total, incomplete }
}

/** Drops XAU entries from a rates map: they were per troy ounce and must never price gold grams. */
export function withoutGoldRates(rates: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(rates).filter(([k]) => !k.split('_').includes(GOLD_CURRENCY)))
}

/**
 * Same as tryConvertCurrency but falls back to returning the original amount for display-only UIs.
 * Prefer tryConvertCurrency when persisting amounts.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: Currency | string,
  toCurrency: Currency | string,
  rates: Record<string, number>
): number {
  const converted = tryConvertCurrency(amount, fromCurrency, toCurrency, rates)
  // Grams are never money: an unpriced gold amount contributes nothing rather than its gram count.
  if (converted === null && (fromCurrency === GOLD_CURRENCY || toCurrency === GOLD_CURRENCY)) return 0
  if (converted === null) {
    console.error(
      `[Currency] No conversion path: ${fromCurrency} → ${toCurrency}. Returning original amount.`
    )
    return amount
  }
  return converted
}

function findRate(
  from: string,
  to: string,
  rates: Record<string, number>
): number | null {
  if (from === to) return 1

  const direct = rates[`${from}_${to}`]
  if (usableRate(direct)) return direct

  const reverse = rates[`${to}_${from}`]
  if (usableRate(reverse)) return 1 / reverse

  return null
}

export function getConversionRate(
  fromCurrency: Currency | string,
  toCurrency: Currency | string,
  rates: Record<string, number>
): number {
  const r = tryConvertCurrency(1, fromCurrency, toCurrency, rates)
  if (r === null) return 1
  return r
}

