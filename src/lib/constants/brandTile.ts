import { findBrandByKey } from '@/lib/constants/subscriptionCatalog'
import { inkFor } from '@/lib/ui/contrast'

/**
 * Two-letter marks for brands whose logo we do not show (see `logoPolicy.ts`). Chosen by hand
 * so each one reads as its service and none repeats: the first letters of the two words that
 * identify it (YouTube Music → YM, Apple TV → AT), or a distinctive pair for a single word
 * (Strava → SR, so it does not collide with stc → SC). Always capitals, the convention for
 * monograms. `brandTile.test.ts` fails if two brands share a mark.
 */
export const BRAND_INITIALS: Record<string, string> = {
  golds_gym: 'GG',
  stc: 'SC', stc_tv: 'TV',
  stc_home: 'SH', mobily: 'MO', mobily_home: 'MH', zain_ksa: 'ZK', zain_home: 'ZH',
  fitness_time: 'FT', anytime_fitness: 'AY', fitness_first: 'FF',
  gymnation: 'GN', classpass: 'CL',
  jahez: 'JA', hungerstation: 'HG', deliveroo_plus: 'DR', salam_ksa: 'SA', virgin_ksa: 'VK',
  virgin_uae: 'VU', lebara_ksa: 'LB',
}

/** Monogram for any service: the curated mark, else the first letters of its first two words (or first two letters), in capitals. */
export function brandInitials(brandKey: string | null | undefined, name: string): string {
  const curated = brandKey ? BRAND_INITIALS[brandKey] : undefined
  if (curated) return curated
  const words = name.trim().split(/\s+/).filter(Boolean)
  const mark = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)
  return mark.toLocaleUpperCase()
}

/** The brand's own colour as the tile fill, with whichever ink token reads better on it. Null for a custom service. */
export function brandTileColors(brandKey: string | null | undefined): { bg: string; fg: string } | null {
  const color = findBrandByKey(brandKey ?? null)?.color
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return null
  return { bg: color, fg: inkFor(color) }
}
