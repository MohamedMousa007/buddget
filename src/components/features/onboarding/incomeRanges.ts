import { tryConvertCurrency } from '@/lib/utils/currency'
import type { Currency } from '@/lib/store/types'
import type { IncomeRangeKey } from '@/hooks/useOnboarding'

/** USD bucket thresholds — converted to the user's currency for display. */
const USD_THRESHOLDS = [1000, 3000, 7000, 15000] as const

/** Round to a clean bucket boundary so adjacent ranges share the same number. */
function niceRound(n: number): number {
  const step = n < 10000 ? 500 : 1000
  return Math.round(n / step) * step
}

interface IncomeRangeCopy {
  incomeRangeUnder: (max: string) => string
  incomeRangeBetween: (min: string, max: string) => string
  incomeRangePlus: (min: string) => string
}

/**
 * Build the localized, FX-converted income-range labels keyed by bucket.
 * Each USD threshold is converted once and rounded so adjacent buckets share
 * identical boundaries; falls back to the raw USD value when no rate exists.
 */
export function buildIncomeRangeLabels(
  currency: Currency,
  rates: Record<string, number>,
  copy: IncomeRangeCopy,
): Record<IncomeRangeKey, string> {
  const fmt = (usd: number) => {
    const converted = tryConvertCurrency(usd, 'USD', currency, rates) ?? usd
    return `${currency} ${niceRound(converted).toLocaleString()}`
  }
  const [a, b, c, d] = USD_THRESHOLDS.map(fmt)
  return {
    under_1k: copy.incomeRangeUnder(a),
    '1k_3k': copy.incomeRangeBetween(a, b),
    '3k_7k': copy.incomeRangeBetween(b, c),
    '7k_15k': copy.incomeRangeBetween(c, d),
    '15k_plus': copy.incomeRangePlus(d),
  }
}
