import type { Currency } from '@/lib/store/types'

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

  const from = String(fromCurrency)
  const to = String(toCurrency)
  /** Treat stables as USD for FX bridges (no on-chain spread modeled). */
  if (from === 'USDT' || from === 'USDC') {
    return tryConvertCurrency(amount, 'USD', toCurrency, rates)
  }
  if (to === 'USDT' || to === 'USDC') {
    return tryConvertCurrency(amount, fromCurrency, 'USD', rates)
  }

  const mergedRates = { ...DEFAULT_RATES, ...rates }

  const direct = mergedRates[`${fromCurrency}_${toCurrency}`]
  if (direct) return amount * direct

  const reverse = mergedRates[`${toCurrency}_${fromCurrency}`]
  if (reverse) return amount / reverse

  const fromToAed = findRate(fromCurrency, 'AED', mergedRates)
  const aedToTarget = findRate('AED', toCurrency, mergedRates)
  if (fromToAed !== null && aedToTarget !== null) {
    return amount * fromToAed * aedToTarget
  }

  const fromToUsd = findRate(fromCurrency, 'USD', mergedRates)
  const usdToTarget = findRate('USD', toCurrency, mergedRates)
  if (fromToUsd !== null && usdToTarget !== null) {
    return amount * fromToUsd * usdToTarget
  }

  return null
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
  if (direct) return direct

  const reverse = rates[`${to}_${from}`]
  if (reverse) return 1 / reverse

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
