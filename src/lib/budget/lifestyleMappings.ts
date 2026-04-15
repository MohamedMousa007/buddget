/**
 * Deterministic lifestyle-to-budget mapping tables.
 * Base values are anchored at a couple in the UAE (AED). For other countries we scale
 * every category by `countryScalingFactor()` — derived from the groceries-for-couple
 * ratio in `costOfLivingAnchors.ts` — so amounts land in realistic local ranges instead
 * of silently producing AED-magnitude numbers in EGP/SAR/JOD.
 */
import { anchorsForCountry, COST_ANCHORS } from '@/lib/budget/costOfLivingAnchors'

export type FoodFrequency = 'everyday' | 'mostdays' | 'sometimes' | 'rarely'
export type TransportMode = 'public' | 'car' | 'taxi' | 'walk'
export type LifestyleTier = 'minimal' | 'balanced' | 'comfortable'
export type HouseholdType = 'solo' | 'couple' | 'family'

const HOUSEHOLD_MULTIPLIER: Record<HouseholdType, number> = {
  solo: 0.6,
  couple: 1.0,
  family: 1.5,
}

/**
 * Multiplier applied to UAE-couple baseline values to approximate amounts in the user's
 * country. Derived from the country's `groceries.couple` anchor vs the UAE couple anchor.
 * Returns 1.0 when the country has no anchor entry.
 */
function countryScalingFactor(country?: string | null): number {
  const anchors = anchorsForCountry(country)
  if (!anchors) return 1.0
  const uaeRef = COST_ANCHORS.UAE.groceries.couple
  if (uaeRef <= 0) return 1.0
  return anchors.groceries.couple / uaeRef
}

const FOOD_BASE: Record<FoodFrequency, { groceries: number; dining: number }> = {
  everyday: { groceries: 1200, dining: 300 },
  mostdays: { groceries: 1500, dining: 600 },
  sometimes: { groceries: 1000, dining: 1200 },
  rarely: { groceries: 500, dining: 2000 },
}

const TRANSPORT_BASE: Record<TransportMode, number> = {
  public: 300,
  car: 1500,
  taxi: 800,
  walk: 100,
}

interface LifestyleBreakdown {
  entertainment: number
  personalCare: number
  phone: number
  subscriptions: number
}

const LIFESTYLE_BASE: Record<LifestyleTier, LifestyleBreakdown> = {
  minimal: { entertainment: 200, personalCare: 200, phone: 150, subscriptions: 0 },
  balanced: { entertainment: 500, personalCare: 350, phone: 200, subscriptions: 100 },
  comfortable: { entertainment: 1000, personalCare: 500, phone: 300, subscriptions: 200 },
}

function scale(amount: number, household: HouseholdType, countryFactor = 1): number {
  return Math.round(amount * HOUSEHOLD_MULTIPLIER[household] * countryFactor)
}

export interface BudgetCategoryRow {
  name: string
  emoji: string
  amount: number
  currency: string
  /** True for the savings allocation row from Buddgy Builder (not an expense category). */
  isSavings?: boolean
}

/** Aligns with {@link isSavingsPlanCategory} for builder/editing rows before they are persisted. */
export function isSavingsCategoryRow(r: BudgetCategoryRow): boolean {
  if (r.isSavings === true) return true
  if (r.isSavings === false) return false
  return r.name.trim().toLowerCase() === 'savings'
}

export interface ComputedBudget {
  categories: BudgetCategoryRow[]
  totalExpenses: number
  remaining: number
}

/**
 * Build deterministic budget categories from lifestyle choices.
 * Does NOT include Savings — that comes from the slider in Step 3.
 */
export function computeBudgetFromChoices(params: {
  income: number
  currency: string
  country?: string | null
  household: HouseholdType
  rent: number
  rentIncludesUtilities: boolean
  food: FoodFrequency
  transport: TransportMode
  lifestyle: LifestyleTier
}): ComputedBudget {
  const { income, currency, country, household, rent, rentIncludesUtilities, food, transport, lifestyle } = params
  const factor = countryScalingFactor(country)
  const cats: BudgetCategoryRow[] = []

  cats.push({ name: 'Rent', emoji: '🏠', amount: rent, currency })

  if (!rentIncludesUtilities) {
    const utilBase = household === 'family' ? 600 : household === 'couple' ? 400 : 250
    cats.push({ name: 'Utilities', emoji: '💡', amount: Math.round(utilBase * factor), currency })
  }

  const foodData = FOOD_BASE[food]
  cats.push({ name: 'Groceries', emoji: '🛒', amount: scale(foodData.groceries, household, factor), currency })
  cats.push({ name: 'Dining Out', emoji: '🍔', amount: scale(foodData.dining, household, factor), currency })

  cats.push({ name: 'Transport', emoji: transport === 'public' ? '🚇' : transport === 'car' ? '🚗' : transport === 'taxi' ? '🚕' : '🚶', amount: scale(TRANSPORT_BASE[transport], household, factor), currency })

  const ls = LIFESTYLE_BASE[lifestyle]
  if (ls.entertainment > 0) cats.push({ name: 'Entertainment', emoji: '🎬', amount: scale(ls.entertainment, household, factor), currency })
  if (ls.personalCare > 0) cats.push({ name: 'Personal Care', emoji: '🧴', amount: scale(ls.personalCare, household, factor), currency })
  cats.push({ name: 'Phone & Internet', emoji: '📱', amount: scale(ls.phone, household, factor), currency })
  if (ls.subscriptions > 0) cats.push({ name: 'Subscriptions', emoji: '📱', amount: scale(ls.subscriptions, household, factor), currency })

  const totalExpenses = cats.reduce((sum, c) => sum + c.amount, 0)
  return { categories: cats, totalExpenses, remaining: Math.max(0, income - totalExpenses) }
}
