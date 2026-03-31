import { EXPENSE_CATEGORIES } from '@/lib/constants/finance'
import type { BudgetCategory, BudgetPlan, BudgetPlanCategory, Currency, ExpenseCategory } from '@/lib/store/types'

/**
 * Effective budget for a plan category: sum of subcategories when any exist, else parent `amount`.
 */
export function effectivePlanCategoryAmount(cat: BudgetPlanCategory): number {
  if (cat.subcategories.length > 0) {
    return cat.subcategories.reduce((s, sc) => s + (Number.isFinite(sc.amount) ? sc.amount : 0), 0)
  }
  return Number.isFinite(cat.amount) ? cat.amount : 0
}

/** Sum of all effective category amounts in a plan (base currency). */
export function totalPlannedExpensesForPlan(plan: BudgetPlan): number {
  return plan.categories.reduce((sum, c) => sum + effectivePlanCategoryAmount(c), 0)
}

/** Expense budget total for KPIs: all plan rows except a top-level "Savings" row (case-insensitive), matching legacy behavior. */
export function totalExpenseBudgetFromPlan(plan: BudgetPlan): number {
  return plan.categories.reduce((sum, c) => {
    if (c.name.trim().toLowerCase() === 'savings') return sum
    return sum + effectivePlanCategoryAmount(c)
  }, 0)
}

/**
 * Map custom plan categories to legacy `BudgetCategory` rows for dashboard caps (category string = display name).
 */
export function budgetCategoriesFromPlan(plan: BudgetPlan, baseCurrency: Currency): BudgetCategory[] {
  return plan.categories.map((c) => ({
    category: c.name as BudgetCategory['category'],
    budgetedAmount: effectivePlanCategoryAmount(c),
    currency: baseCurrency,
    percentOfIncome: null,
    icon: c.icon,
  }))
}

function matchExpenseCategory(planName: string): ExpenseCategory | null {
  const t = planName.trim()
  if (!t) return null
  const hit = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === t.toLowerCase())
  return hit ?? null
}

/**
 * Spending per plan row: uses `categorySpendingByEnum` when the row name matches a standard expense category (case-insensitive).
 */
export function categorySpendingForPlanRows(
  categorySpendingByEnum: Record<string, number>,
  plan: BudgetPlan
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const cat of plan.categories) {
    const name = cat.name.trim()
    if (!name) continue
    const enumCat = matchExpenseCategory(name)
    out[name] = enumCat != null ? categorySpendingByEnum[enumCat] ?? 0 : 0
  }
  return out
}
