import type { GoldKarat } from '@/lib/store/types'
import { goldPurityFactor } from '@/lib/utils/calculations'

/**
 * Egyptian local gold: the whole market derives from ONE scalar — دولار الصاغة (the Sagha
 * dollar), the USD/EGP rate gold traders actually price against (the parallel rate, not the
 * official one). Verified against a live eDahab screenshot (ounce $4,063.5, Sagha 52.40 →
 * 24k 6,846 / 21k 5,990 / 18k 5,135 / gold pound 47,920), every figure matching to under 1 EGP.
 *
 * So we crawl each karat a site publishes, back-calculate the implied Sagha dollar, cluster
 * across sources, then recompute every karat from the agreed scalar for internal consistency.
 */

export const TROY_OUNCE_GRAMS = 31.1035

/** USD price of one gram of pure gold from the global spot ounce price. */
export function usdPerGram(ounceUsd: number): number {
  return ounceUsd / TROY_OUNCE_GRAMS
}

/** Local 24k EGP per gram from the spot ounce and the Sagha dollar (optional per-karat tuning). */
export function egyptGram24(ounceUsd: number, saghaUsdEgp: number, adjustment = 1): number {
  return usdPerGram(ounceUsd) * saghaUsdEgp * adjustment
}

/** Local EGP per gram for a karat. */
export function egyptKaratPrice(
  ounceUsd: number,
  saghaUsdEgp: number,
  karat: GoldKarat,
  adjustment = 1,
): number {
  return egyptGram24(ounceUsd, saghaUsdEgp, adjustment) * goldPurityFactor(karat)
}

/** The جنيه ذهب (gold pound): 8 grams of 21k. */
export function egyptGoldPound(ounceUsd: number, saghaUsdEgp: number): number {
  return egyptKaratPrice(ounceUsd, saghaUsdEgp, 21) * 8
}

/**
 * Back-calculate the implied Sagha dollar from any site's published karat price. Normalises
 * sources that publish different karats/layouts into one comparable scalar for the consensus.
 */
export function impliedSaghaFromKarat(
  localKaratPrice: number,
  karat: GoldKarat,
  ounceUsd: number,
  adjustment = 1,
): number {
  const perGram = usdPerGram(ounceUsd)
  if (perGram <= 0 || adjustment <= 0) return 0
  return localKaratPrice / (perGram * goldPurityFactor(karat) * adjustment)
}

/**
 * Reject an implied Sagha dollar outside a plausible band around the official rate. A broken
 * scraper almost always lands outside this, so it removes itself instead of poisoning consensus.
 * Observed today: 52.40 / 51.35 = 1.020.
 */
export function saghaWithinSanity(
  saghaUsdEgp: number,
  officialUsdEgp: number,
  lo = 0.95,
  hi = 1.3,
): boolean {
  if (!(officialUsdEgp > 0) || !(saghaUsdEgp > 0)) return false
  const ratio = saghaUsdEgp / officialUsdEgp
  return ratio >= lo && ratio <= hi
}

/** The local-vs-global gap per gram (24k): what the parallel rate adds over the official one. */
export function localVsGlobalGapPerGram(
  ounceUsd: number,
  saghaUsdEgp: number,
  officialUsdEgp: number,
): number {
  return (saghaUsdEgp - officialUsdEgp) * usdPerGram(ounceUsd)
}
