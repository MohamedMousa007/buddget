/**
 * Category → chip colors for the redesigned expense list/filters.
 * Every `ExpenseCategory` member (and its common aliases) maps to a distinct
 * accent; only genuinely unknown categories fall back to the neutral chip.
 * Colors are CSS custom properties (defined per-theme in globals.css) so each
 * accent can be tuned separately for light-mode (3:1+ on a white card) vs.
 * dark-mode (the original pastel palette) without any JS theme detection.
 */
export interface CategoryChipColors {
  fg: string
  bg: string
}

function cat(name: string): CategoryChipColors {
  return { fg: `var(--cat-${name}-fg)`, bg: `var(--cat-${name}-bg)` }
}

const NEUTRAL = cat('neutral')
const RENT = cat('rent')
const FOOD = cat('food')
const TRANSPORT = cat('transport')
const ENJOY = cat('enjoy')
const DEBT = cat('debt')
const SAVINGS = cat('savings')
const UTILITIES = cat('utilities')
const SHOPPING = cat('shopping')
const HEALTH = cat('health')
const EDUCATION = cat('education')
const SUBSCRIPTION = cat('subscription')
const REMITTANCE = cat('remittance')
const TRANSFER = cat('transfer')

/** Keyed by normalized category (lowercase, spaces/hyphens → underscore). */
const MAP: Record<string, CategoryChipColors> = {
  rent: RENT, housing: RENT, home: RENT,
  food: FOOD, groceries: FOOD, dining: FOOD, dining_out: FOOD, restaurants: FOOD,
  transport: TRANSPORT, transportation: TRANSPORT, commute: TRANSPORT, fuel: TRANSPORT, petrol: TRANSPORT, gas: TRANSPORT,
  entertainment: ENJOY, enjoy: ENJOY, enjoyment: ENJOY,
  debt: DEBT, loan: DEBT, credit: DEBT, cc_payoff: DEBT,
  savings: SAVINGS, saving: SAVINGS, investment: SAVINGS,
  utilities: UTILITIES,
  shopping: SHOPPING,
  health: HEALTH,
  education: EDUCATION,
  subscription: SUBSCRIPTION,
  remittance: REMITTANCE,
  transfer: TRANSFER, atm_cash_withdrawal: TRANSFER, currency_exchange: TRANSFER, top_up: TRANSFER,
}

export function categoryChipColors(category: string): CategoryChipColors {
  const key = (category || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return MAP[key] ?? NEUTRAL
}
