/**
 * Category → chip colors for the redesigned expense list/filters.
 * Every `ExpenseCategory` member (and its common aliases) maps to a distinct
 * accent; only genuinely unknown categories fall back to the neutral chip.
 */
export interface CategoryChipColors {
  fg: string
  bg: string
}

const NEUTRAL: CategoryChipColors = { fg: '#9898B0', bg: 'rgba(152,152,176,.13)' }

const RED: CategoryChipColors = { fg: '#FF6B6B', bg: 'rgba(255,107,107,.13)' }
const ORANGE: CategoryChipColors = { fg: '#F5A623', bg: 'rgba(245,166,35,.13)' }
const BLUE: CategoryChipColors = { fg: '#4DA3FF', bg: 'rgba(77,163,255,.13)' }
const PURPLE: CategoryChipColors = { fg: '#A78BFA', bg: 'rgba(167,139,250,.13)' }
const CRIMSON: CategoryChipColors = { fg: '#FF5C5C', bg: 'rgba(255,92,92,.13)' }
const GOLD: CategoryChipColors = { fg: '#F5C842', bg: 'rgba(245,200,66,.13)' }
const TEAL: CategoryChipColors = { fg: '#2DD4BF', bg: 'rgba(45,212,191,.14)' }
const PINK: CategoryChipColors = { fg: '#F472B6', bg: 'rgba(244,114,182,.14)' }
const EMERALD: CategoryChipColors = { fg: '#34D399', bg: 'rgba(52,211,153,.14)' }
const INDIGO: CategoryChipColors = { fg: '#818CF8', bg: 'rgba(129,140,248,.14)' }
const VIOLET: CategoryChipColors = { fg: '#C084FC', bg: 'rgba(192,132,252,.14)' }
const CYAN: CategoryChipColors = { fg: '#22D3EE', bg: 'rgba(34,211,238,.14)' }
const SLATE: CategoryChipColors = { fg: '#8AA0C8', bg: 'rgba(138,160,200,.14)' }

/** Keyed by normalized category (lowercase, spaces/hyphens → underscore). */
const MAP: Record<string, CategoryChipColors> = {
  rent: RED, housing: RED, home: RED,
  food: ORANGE, groceries: ORANGE, dining: ORANGE, dining_out: ORANGE, restaurants: ORANGE,
  transport: BLUE, transportation: BLUE, commute: BLUE, fuel: BLUE, petrol: BLUE, gas: BLUE,
  entertainment: PURPLE, enjoy: PURPLE, enjoyment: PURPLE,
  debt: CRIMSON, loan: CRIMSON, credit: CRIMSON, cc_payoff: CRIMSON,
  savings: GOLD, saving: GOLD, investment: GOLD,
  utilities: TEAL,
  shopping: PINK,
  health: EMERALD,
  education: INDIGO,
  subscription: VIOLET,
  remittance: CYAN,
  transfer: SLATE, atm_cash_withdrawal: SLATE, currency_exchange: SLATE,
}

export function categoryChipColors(category: string): CategoryChipColors {
  const key = (category || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return MAP[key] ?? NEUTRAL
}
