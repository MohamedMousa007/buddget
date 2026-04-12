import { getMonthRange } from '@/lib/utils/calculations'
import { differenceInDays } from 'date-fns'

export type PaceStatus = 'on_track' | 'warning' | 'over'

export interface OverspentCategory {
  category: string
  icon?: string
  spent: number
  cap: number
  overBy: number
}

/**
 * Days elapsed from the budget-month start to today (inclusive of today).
 * Returns at least 1 so division is always safe.
 */
export function daysElapsedInMonth(monthStr: string, monthStartDay = 1): number {
  const { start } = getMonthRange(monthStr, monthStartDay)
  const today = new Date()
  const diff = differenceInDays(today, start) + 1
  return Math.max(diff, 1)
}

/** Total calendar days in the budget month. */
export function totalDaysInMonth(monthStr: string, monthStartDay = 1): number {
  const { start, end } = getMonthRange(monthStr, monthStartDay)
  return differenceInDays(end, start) + 1
}

/** Average daily spending so far. */
export function dailySpendingRate(totalSpent: number, daysElapsed: number): number {
  if (daysElapsed <= 0) return 0
  return totalSpent / daysElapsed
}

/** Where spending is heading if the current daily rate continues. */
export function projectedMonthSpend(dailyRate: number, totalDays: number): number {
  return dailyRate * totalDays
}

/** Classify the projected spend vs budget. */
export function spendingPaceStatus(projectedSpend: number, budget: number): PaceStatus {
  if (budget <= 0) return 'on_track'
  if (projectedSpend > budget * 1.2) return 'over'
  if (projectedSpend > budget) return 'warning'
  return 'on_track'
}

/** How much the user should spend per remaining day to stay within budget. */
export function suggestedDailyBudget(remaining: number, daysLeft: number): number {
  if (daysLeft <= 0) return 0
  return Math.max(0, remaining / daysLeft)
}

/**
 * Categories where spending pace already exceeds the budget-proportional pace.
 * Compares (spent / daysElapsed) vs (cap / totalDays) per category.
 */
export function topOverspentCategories(
  categorySpending: Record<string, number>,
  categoryBudgetCaps: Record<string, number>,
  daysElapsed: number,
  totalDays: number,
  categoryIcons?: Record<string, string>,
  limit = 3,
): OverspentCategory[] {
  const results: OverspentCategory[] = []

  for (const [cat, spent] of Object.entries(categorySpending)) {
    const cap = categoryBudgetCaps[cat]
    if (!cap || cap <= 0 || spent <= 0) continue
    const dailyPace = spent / Math.max(daysElapsed, 1)
    const budgetDailyPace = cap / Math.max(totalDays, 1)
    if (dailyPace > budgetDailyPace) {
      results.push({
        category: cat,
        icon: categoryIcons?.[cat],
        spent,
        cap,
        overBy: dailyPace - budgetDailyPace,
      })
    }
  }

  return results.sort((a, b) => b.overBy - a.overBy).slice(0, limit)
}
