import type { BudgetPlan, BudgetPlanCategory, Currency, IncomeSource } from '@/lib/store/types'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { totalPlannedExpensesForPlan } from '@/lib/budget/budgetPlans'

export function findCategoryByName(plan: BudgetPlan, name: string): BudgetPlanCategory | undefined {
  const n = name.trim().toLowerCase()
  return plan.categories.find((c) => c.name.trim().toLowerCase() === n)
}

export function hasPositiveIncome(
  incomeSources: IncomeSource[],
  baseCurrency: Currency,
  exchangeRates: Record<string, number>,
  noIncomeDeclared: boolean
): boolean {
  if (noIncomeDeclared && incomeSources.length === 0) return false
  return calculateMonthlyIncome(incomeSources, baseCurrency, exchangeRates) > 0.0001
}

/** Planned expense total (savings allocation rows excluded). */
export function plannedExcludingSavings(
  plan: BudgetPlan,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): number {
  return totalPlannedExpensesForPlan(plan, baseCurrency, exchangeRates)
}

export function remainingForAiSlice(
  monthlyIncome: number,
  plan: BudgetPlan,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>,
  savingsAmount: number
): number {
  const planned = plannedExcludingSavings(plan, baseCurrency, exchangeRates)
  return Math.max(0, monthlyIncome - planned - savingsAmount)
}

export function formatMoneyAmount(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
  return `${formatted} ${currency}`
}

export function cityCountryFromProfile(profile: { city?: string; country?: string }): {
  city: string | null
  country: string | null
} {
  return {
    city: profile.city?.trim() || null,
    country: profile.country?.trim() || null,
  }
}

/** True when the profile has enough location info for Buddgy to produce a targeted plan. */
export function hasLocationForBuddgy(profile: { city?: string; country?: string }): boolean {
  const { country } = cityCountryFromProfile(profile)
  return !!country
}
