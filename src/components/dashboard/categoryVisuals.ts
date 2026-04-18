/**
 * Palette + number-format helpers shared by the dashboard's category-bars
 * card, latest-transactions card, and goals strip so every surface shows
 * the same colour family for "Food" etc. The icon glyph itself lives in
 * `CategoryIcon.tsx` (static-render friendly); this file stays lint-safe as
 * a pure .ts helper.
 */

export interface CategoryPalette {
  bg: string
  text: string
}

const DEFAULT_PALETTE: CategoryPalette = { bg: '#F1EFE8', text: '#5A5A52' }

/** Case-insensitive category-name → palette mapping. First match wins. */
const PALETTE_RULES: ReadonlyArray<{
  match: (k: string) => boolean
  palette: CategoryPalette
}> = [
  { match: (k) => k === 'rent' || k === 'housing' || k === 'home', palette: { bg: '#FCEBEB', text: '#9B1C1C' } },
  { match: (k) => k === 'food' || k === 'groceries' || k === 'dining', palette: { bg: '#FAEEDA', text: '#B8710A' } },
  { match: (k) => k === 'transport' || k === 'transportation' || k === 'commute', palette: { bg: '#E6F1FB', text: '#1E5A9E' } },
  { match: (k) => k === 'enjoy' || k === 'enjoyment' || k === 'entertainment' || k === 'subscription' || k === 'subscriptions', palette: { bg: '#EEEDFE', text: '#5240A8' } },
  { match: (k) => k === 'shopping' || k === 'shop', palette: { bg: '#FEE6F1', text: '#A3165D' } },
  { match: (k) => k === 'health' || k === 'healthcare' || k === 'medical', palette: { bg: '#E1F5EE', text: '#0F6B4C' } },
  { match: (k) => k === 'education' || k === 'school', palette: { bg: '#FEF4D7', text: '#8A5A0F' } },
  { match: (k) => k === 'savings' || k === 'saving' || k === 'investment', palette: { bg: '#E1F5EE', text: '#0F6B4C' } },
  { match: (k) => k === 'debt' || k === 'loan' || k === 'credit', palette: { bg: '#FCE7E7', text: '#9B1C1C' } },
  { match: (k) => k === 'remittance' || k === 'transfer', palette: { bg: '#E6F1FB', text: '#1E5A9E' } },
]

export function getCategoryPalette(category: string): CategoryPalette {
  const key = (category || '').trim().toLowerCase()
  if (!key) return DEFAULT_PALETTE
  const match = PALETTE_RULES.find((v) => v.match(key))
  return match?.palette ?? DEFAULT_PALETTE
}

/**
 * Compact localized-number formatter. `1700 → "1.7k"`, `12_400 → "12.4k"`,
 * `980 → "980"`. Uses Intl compact notation so locale-aware suffixes follow.
 */
export function formatCompact(n: number, locale = 'en-US'): string {
  if (!Number.isFinite(n)) return '0'
  const abs = Math.abs(n)
  return new Intl.NumberFormat(locale, {
    notation: abs >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: abs >= 1000 ? 1 : 0,
  }).format(n)
}

/**
 * Hash a stable string into one of the pastel palettes so goals (which have
 * no inherent category) still get consistent colors per-goal across renders.
 */
const PALETTE_CYCLE: CategoryPalette[] = [
  { bg: '#FAEEDA', text: '#B8710A' },
  { bg: '#E6F1FB', text: '#1E5A9E' },
  { bg: '#EEEDFE', text: '#5240A8' },
  { bg: '#FCEBEB', text: '#9B1C1C' },
  { bg: '#E1F5EE', text: '#0F6B4C' },
  { bg: '#FEF4D7', text: '#8A5A0F' },
  { bg: '#FEE6F1', text: '#A3165D' },
]

export function paletteFromString(key: string): CategoryPalette {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % PALETTE_CYCLE.length
  return PALETTE_CYCLE[idx]
}
