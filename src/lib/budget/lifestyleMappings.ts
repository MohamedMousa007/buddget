/**
 * Deterministic lifestyle-to-budget mapping tables.
 * Base values are for a couple in Dubai (AED). Scale by household multiplier.
 */

export type FoodFrequency = 'everyday' | 'mostdays' | 'sometimes' | 'rarely'
export type TransportMode = 'public' | 'car' | 'taxi' | 'walk'
export type LifestyleTier = 'minimal' | 'balanced' | 'comfortable'
export type HouseholdType = 'solo' | 'couple' | 'family'

const HOUSEHOLD_MULTIPLIER: Record<HouseholdType, number> = {
  solo: 0.6,
  couple: 1.0,
  family: 1.5,
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

function scale(amount: number, household: HouseholdType): number {
  return Math.round(amount * HOUSEHOLD_MULTIPLIER[household])
}

export interface BudgetCategoryRow {
  name: string
  emoji: string
  amount: number
  currency: string
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
  household: HouseholdType
  rent: number
  rentIncludesUtilities: boolean
  food: FoodFrequency
  transport: TransportMode
  lifestyle: LifestyleTier
}): ComputedBudget {
  const { income, currency, household, rent, rentIncludesUtilities, food, transport, lifestyle } = params
  const cats: BudgetCategoryRow[] = []

  cats.push({ name: 'Rent', emoji: '🏠', amount: rent, currency })

  if (!rentIncludesUtilities) {
    const utilBase = household === 'family' ? 600 : household === 'couple' ? 400 : 250
    cats.push({ name: 'Utilities', emoji: '💡', amount: utilBase, currency })
  }

  const foodData = FOOD_BASE[food]
  cats.push({ name: 'Groceries', emoji: '🛒', amount: scale(foodData.groceries, household), currency })
  cats.push({ name: 'Dining Out', emoji: '🍔', amount: scale(foodData.dining, household), currency })

  cats.push({ name: 'Transport', emoji: transport === 'public' ? '🚇' : transport === 'car' ? '🚗' : transport === 'taxi' ? '🚕' : '🚶', amount: scale(TRANSPORT_BASE[transport], household), currency })

  const ls = LIFESTYLE_BASE[lifestyle]
  if (ls.entertainment > 0) cats.push({ name: 'Entertainment', emoji: '🎬', amount: scale(ls.entertainment, household), currency })
  if (ls.personalCare > 0) cats.push({ name: 'Personal Care', emoji: '🧴', amount: scale(ls.personalCare, household), currency })
  cats.push({ name: 'Phone & Internet', emoji: '📱', amount: scale(ls.phone, household), currency })
  if (ls.subscriptions > 0) cats.push({ name: 'Subscriptions', emoji: '📱', amount: scale(ls.subscriptions, household), currency })

  const totalExpenses = cats.reduce((sum, c) => sum + c.amount, 0)
  return { categories: cats, totalExpenses, remaining: Math.max(0, income - totalExpenses) }
}
