import type { Currency } from '@/lib/store/types'
import { detectCatalogRegion, REGION_CURRENCY } from '@/lib/constants/subscriptionCatalog'

/**
 * Country → base-currency mapping. Free-text match (lowercased + trimmed +
 * includes-check) so minor spelling variations still resolve. Returns
 * `undefined` when the country is unrecognised — the caller should keep
 * the user's existing choice rather than overriding it.
 *
 * Order matters: the first matcher whose predicate returns true wins, so
 * disambiguating prefixes (e.g. "saudi arabia" before "arabia") sit
 * higher.
 */
const COUNTRY_MATCHERS: { match: (c: string) => boolean; currency: Currency }[] = [
  // ── Eurozone (matched before more general "europe") ──
  {
    match: (c) =>
      c.includes('eurozone') ||
      c.includes('germany') ||
      c.includes('france') ||
      c.includes('spain') ||
      c.includes('italy') ||
      c.includes('netherlands') ||
      c.includes('portugal') ||
      c.includes('greece') ||
      c.includes('ireland') ||
      c.includes('austria') ||
      c.includes('belgium') ||
      c.includes('finland') ||
      c.includes('estonia') ||
      c.includes('latvia') ||
      c.includes('lithuania') ||
      c.includes('luxembourg') ||
      c.includes('malta') ||
      c.includes('slovakia') ||
      c.includes('slovenia') ||
      c.includes('cyprus') ||
      c.includes('croatia'),
    currency: 'EUR',
  },

  // ── Major anglophone ──
  { match: (c) => c.includes('united states') || c === 'usa' || c === 'us' || c.includes('america'), currency: 'USD' },
  { match: (c) => c.includes('united kingdom') || c === 'uk' || c.includes('britain') || c.includes('england') || c.includes('scotland') || c.includes('wales'), currency: 'GBP' },
  { match: (c) => c.includes('canada'), currency: 'USD' },
  { match: (c) => c.includes('australia'), currency: 'USD' },
  { match: (c) => c.includes('new zealand'), currency: 'USD' },

  // ── MENA ──
  { match: (c) => c.includes('united arab emirates') || c === 'uae' || c.includes('emirat'), currency: 'AED' },
  { match: (c) => c.includes('saudi') || c === 'ksa' || c.includes('السعودي'), currency: 'SAR' },
  { match: (c) => c.includes('egypt') || c.includes('مصر'), currency: 'EGP' },
  { match: (c) => c.includes('jordan') || c.includes('الأردن'), currency: 'JOD' },
  { match: (c) => c.includes('kuwait'), currency: 'USD' },
  { match: (c) => c.includes('qatar'), currency: 'USD' },
  { match: (c) => c.includes('bahrain'), currency: 'USD' },
  { match: (c) => c.includes('oman'), currency: 'USD' },
  { match: (c) => c.includes('lebanon'), currency: 'USD' },
  { match: (c) => c.includes('morocco'), currency: 'EUR' },
  { match: (c) => c.includes('tunisia'), currency: 'EUR' },

  // ── Asia-Pacific ──
  { match: (c) => c.includes('india'), currency: 'USD' },
  { match: (c) => c.includes('pakistan'), currency: 'USD' },
  { match: (c) => c.includes('bangladesh'), currency: 'USD' },
  { match: (c) => c.includes('singapore'), currency: 'USD' },
  { match: (c) => c.includes('malaysia'), currency: 'USD' },
  { match: (c) => c.includes('indonesia'), currency: 'USD' },
  { match: (c) => c.includes('thailand'), currency: 'USD' },
  { match: (c) => c.includes('vietnam'), currency: 'USD' },
  { match: (c) => c.includes('philippines'), currency: 'USD' },
  { match: (c) => c.includes('japan'), currency: 'USD' },
  { match: (c) => c.includes('korea'), currency: 'USD' },
  { match: (c) => c.includes('china'), currency: 'USD' },
  { match: (c) => c.includes('hong kong'), currency: 'USD' },
  { match: (c) => c.includes('taiwan'), currency: 'USD' },

  // ── Americas ──
  { match: (c) => c.includes('mexico'), currency: 'USD' },
  { match: (c) => c.includes('brazil'), currency: 'USD' },
  { match: (c) => c.includes('argentina'), currency: 'USD' },
  { match: (c) => c.includes('chile'), currency: 'USD' },
  { match: (c) => c.includes('colombia'), currency: 'USD' },
  { match: (c) => c.includes('peru'), currency: 'USD' },

  // ── Other ──
  { match: (c) => c.includes('switzerland'), currency: 'EUR' },
  { match: (c) => c.includes('sweden') || c.includes('norway') || c.includes('denmark'), currency: 'EUR' },
  { match: (c) => c.includes('poland'), currency: 'EUR' },
  { match: (c) => c.includes('czech') || c.includes('hungary') || c.includes('romania') || c.includes('bulgaria'), currency: 'EUR' },
  { match: (c) => c.includes('turkey'), currency: 'USD' },
  { match: (c) => c.includes('israel'), currency: 'USD' },
  { match: (c) => c.includes('south africa'), currency: 'USD' },
  { match: (c) => c.includes('nigeria') || c.includes('kenya') || c.includes('ghana'), currency: 'USD' },
  { match: (c) => c.includes('russia') || c.includes('ukraine'), currency: 'USD' },
]

/**
 * Returns the recommended base currency for a country string, or `undefined`
 * if the country isn't in the static table. Callers should fall back to the
 * user's existing choice (or the global default `USD`) rather than guessing.
 *
 * Note: countries without a directly listed currency map to USD (the most
 * widely-used international reserve), not AED — the previous behaviour
 * silently routed every unrecognised country through the MENA-biased
 * subscription-region detector.
 */
export function defaultCurrencyForCountry(country?: string, city?: string): Currency | undefined {
  const c = (country ?? '').toLowerCase().trim()
  if (c) {
    const hit = COUNTRY_MATCHERS.find((m) => m.match(c))
    if (hit) return hit.currency
  }
  // Subscription-region detector understands a few Gulf cities by name; only
  // consult it when we have a city hint and no country match. Never call it
  // with an empty country *and* empty city — that path returned the catalog
  // default (AED) and was the source of the "everyone is AED" bug.
  const cityStr = (city ?? '').trim()
  if (cityStr) {
    const region = detectCatalogRegion({ country, city })
    if (region) return REGION_CURRENCY[region] as Currency
  }
  return undefined
}
