import type { Currency } from '@/lib/store/types'
import { detectCatalogRegion, REGION_CURRENCY } from '@/lib/constants/subscriptionCatalog'

/**
 * Country → base-currency mapping. Free-text match (lowercased + trimmed + includes-check)
 * so minor spelling variations still resolve. Returns `undefined` when the country is
 * unrecognised — the caller should then keep the user's existing choice.
 */
const COUNTRY_MATCHERS: { match: (c: string) => boolean; currency: Currency }[] = [
  { match: (c) => c.includes('united arab emirates') || c === 'uae' || c.includes('emirat'), currency: 'AED' },
  { match: (c) => c.includes('egypt') || c.includes('مصر'), currency: 'EGP' },
  { match: (c) => c.includes('saudi') || c === 'ksa' || c.includes('السعودي'), currency: 'SAR' },
  { match: (c) => c.includes('jordan') || c.includes('الأردن'), currency: 'JOD' },
  { match: (c) => c.includes('united states') || c === 'usa' || c === 'us', currency: 'USD' },
  { match: (c) => c.includes('united kingdom') || c === 'uk' || c.includes('britain') || c.includes('england'), currency: 'GBP' },
  { match: (c) => c.includes('eurozone') || c.includes('germany') || c.includes('france') || c.includes('spain') || c.includes('italy') || c.includes('netherlands') || c.includes('portugal') || c.includes('greece') || c.includes('ireland'), currency: 'EUR' },
]

/**
 * Returns the recommended base currency for a country string, or `undefined`
 * if the country isn't in the static table. Falls back to the subscription-catalog
 * region detector (which already handles UAE + Egypt by city too).
 */
export function defaultCurrencyForCountry(country?: string, city?: string): Currency | undefined {
  const c = (country ?? '').toLowerCase().trim()
  if (c) {
    const hit = COUNTRY_MATCHERS.find((m) => m.match(c))
    if (hit) return hit.currency
  }
  const region = detectCatalogRegion({ country, city })
  if (region) return REGION_CURRENCY[region] as Currency
  return undefined
}
