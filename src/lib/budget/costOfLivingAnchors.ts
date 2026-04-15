import type { Currency } from '@/lib/store/types'

/**
 * Rough, locally-weighted **monthly** cost anchors — not precise, not city-specific.
 * Purpose: prime the AI with a numerical reference in the user's actual currency so it
 * doesn't silently default to Dubai-AED figures when the user lives elsewhere.
 *
 * Values are mid-market typical ranges for a working-age adult / couple / family of four
 * as of the `lastUpdated` date. Update periodically; the AI is told to treat them as
 * approximate and to apply common sense for the current month.
 */
export interface CostAnchors {
  currency: Currency
  rent: { studio: number; oneBedroom: number; twoBedroom: number; family: number }
  groceries: { single: number; couple: number; family4: number }
  utilities: { electricityWater: number; internet: number }
  transport: { publicTransit: number; rideHail: number; ownCarMonthly: number }
  dining: { lowFreq: number; midFreq: number; highFreq: number }
  lastUpdated: string
}

export type AnchorCountryKey = 'UAE' | 'Egypt' | 'SaudiArabia' | 'Jordan'

const LAST_UPDATED = '2026-04'

export const COST_ANCHORS: Record<AnchorCountryKey, CostAnchors> = {
  UAE: {
    currency: 'AED',
    rent: { studio: 3500, oneBedroom: 5500, twoBedroom: 8500, family: 12000 },
    groceries: { single: 1000, couple: 1800, family4: 3200 },
    utilities: { electricityWater: 500, internet: 400 },
    transport: { publicTransit: 300, rideHail: 900, ownCarMonthly: 1800 },
    dining: { lowFreq: 400, midFreq: 1000, highFreq: 2200 },
    lastUpdated: LAST_UPDATED,
  },
  Egypt: {
    currency: 'EGP',
    rent: { studio: 4500, oneBedroom: 7500, twoBedroom: 12000, family: 18000 },
    groceries: { single: 3000, couple: 5500, family4: 9500 },
    utilities: { electricityWater: 700, internet: 500 },
    transport: { publicTransit: 400, rideHail: 1500, ownCarMonthly: 3500 },
    dining: { lowFreq: 800, midFreq: 2500, highFreq: 5000 },
    lastUpdated: LAST_UPDATED,
  },
  SaudiArabia: {
    currency: 'SAR',
    rent: { studio: 2200, oneBedroom: 3500, twoBedroom: 5500, family: 8000 },
    groceries: { single: 900, couple: 1700, family4: 3000 },
    utilities: { electricityWater: 400, internet: 350 },
    transport: { publicTransit: 200, rideHail: 700, ownCarMonthly: 1400 },
    dining: { lowFreq: 350, midFreq: 900, highFreq: 2000 },
    lastUpdated: LAST_UPDATED,
  },
  Jordan: {
    currency: 'JOD',
    rent: { studio: 280, oneBedroom: 400, twoBedroom: 600, family: 850 },
    groceries: { single: 180, couple: 320, family4: 520 },
    utilities: { electricityWater: 60, internet: 30 },
    transport: { publicTransit: 30, rideHail: 120, ownCarMonthly: 180 },
    dining: { lowFreq: 50, midFreq: 150, highFreq: 320 },
    lastUpdated: LAST_UPDATED,
  },
}

const COUNTRY_ALIASES: { match: (c: string) => boolean; key: AnchorCountryKey }[] = [
  { match: (c) => c.includes('united arab emirates') || c === 'uae' || c.includes('emirat'), key: 'UAE' },
  { match: (c) => c.includes('egypt') || c.includes('مصر'), key: 'Egypt' },
  { match: (c) => c.includes('saudi') || c === 'ksa' || c.includes('السعودي'), key: 'SaudiArabia' },
  { match: (c) => c.includes('jordan') || c.includes('الأردن'), key: 'Jordan' },
]

export function anchorsForCountry(country?: string | null): CostAnchors | null {
  const c = (country ?? '').toLowerCase().trim()
  if (!c) return null
  const hit = COUNTRY_ALIASES.find((a) => a.match(c))
  return hit ? COST_ANCHORS[hit.key] : null
}

/**
 * Render an anchors block suitable for dropping into an AI system prompt.
 * Returns an empty string when no anchors exist — caller should still pass country/date
 * so the model uses its training data for the right locale.
 */
export function renderAnchorsForPrompt(country: string | null | undefined): string {
  const anchors = anchorsForCountry(country)
  if (!anchors) return ''
  const { currency, rent, groceries, utilities, transport, dining, lastUpdated } = anchors
  return [
    `LOCAL REFERENCE PRICES for ${country} (approximate, mid-market, ${lastUpdated}, all monthly, in ${currency}):`,
    `- Rent: studio ${rent.studio}, 1BR ${rent.oneBedroom}, 2BR ${rent.twoBedroom}, family ${rent.family}`,
    `- Groceries: single ${groceries.single}, couple ${groceries.couple}, family-of-4 ${groceries.family4}`,
    `- Utilities: electricity+water ${utilities.electricityWater}, internet ${utilities.internet}`,
    `- Transport: public ${transport.publicTransit}, ride-hail ${transport.rideHail}, own car ${transport.ownCarMonthly}`,
    `- Dining out: low-freq ${dining.lowFreq}, mid-freq ${dining.midFreq}, high-freq ${dining.highFreq}`,
    `Use these as anchors, then adjust for the user's stated situation. Never mix currencies.`,
  ].join('\n')
}
