import { usdPerGram } from '@/lib/prices/egyptGold'

/** Fixed dirham / riyal pegs to the dollar: a Gulf gram price must sit near spot x peg. */
const PEG_PER_USD: Record<'AED' | 'SAR', number> = { AED: 3.6725, SAR: 3.75 }

/** Retail premium and provider spread allowed around spot x peg before a quote is called garbage. */
const BAND = 0.05

/** True when a 24k per-gram price in a pegged currency is within +-5% of the global spot converted at the peg. */
export function withinSpotBand(gram24k: number, currency: 'AED' | 'SAR', ounceUsd: number): boolean {
  const expected = usdPerGram(ounceUsd) * PEG_PER_USD[currency]
  return Number.isFinite(gram24k) && Math.abs(gram24k - expected) / expected <= BAND
}
