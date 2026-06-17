/**
 * Category → chip colors for the redesigned expense list/filters.
 * Mirrors the handoff's `cat()` palette (fg = solid accent, bg = matching tint).
 * Unknown categories fall back to a neutral muted chip.
 */
export interface CategoryChipColors {
  fg: string
  bg: string
}

const NEUTRAL: CategoryChipColors = { fg: '#9898B0', bg: 'rgba(152,152,176,.13)' }

export function categoryChipColors(category: string): CategoryChipColors {
  const key = (category || '').trim().toLowerCase().replace(/[\s-]+/g, '_')

  if (key === 'rent' || key === 'housing' || key === 'home') return { fg: '#FF6B6B', bg: 'rgba(255,107,107,.13)' }
  if (
    key === 'food' || key === 'groceries' || key === 'dining' || key === 'dining_out' || key === 'restaurants'
  ) return { fg: '#F5A623', bg: 'rgba(245,166,35,.13)' }
  if (
    key === 'transport' || key === 'transportation' || key === 'commute' || key === 'fuel' || key === 'petrol' || key === 'gas'
  ) return { fg: '#4DA3FF', bg: 'rgba(77,163,255,.13)' }
  if (key === 'entertainment' || key === 'enjoy' || key === 'enjoyment') return { fg: '#A78BFA', bg: 'rgba(167,139,250,.13)' }
  if (key === 'debt' || key === 'loan' || key === 'credit' || key === 'cc_payoff') return { fg: '#FF5C5C', bg: 'rgba(255,92,92,.13)' }
  if (key === 'savings' || key === 'saving' || key === 'investment') return { fg: '#F5C842', bg: 'rgba(245,200,66,.13)' }
  return NEUTRAL
}
