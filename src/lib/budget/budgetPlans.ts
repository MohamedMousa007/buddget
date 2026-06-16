import { EXPENSE_CATEGORIES, FIAT_CURRENCIES } from '@/lib/constants/finance'
import { CATEGORY_BUDGET_ALIASES } from '@/lib/constants/categoryMeta'
import type { BudgetCategory, BudgetPlan, BudgetPlanCategory, Currency, ExpenseCategory } from '@/lib/store/types'
import { tryConvertCurrency } from '@/lib/utils/currency'

/**
 * Savings allocation rows are excluded from "planned expenses" totals.
 * Legacy plans: only the single top-level name "Savings" (case-insensitive) is treated as savings unless `isSavings` is false.
 */
export function isSavingsPlanCategory(c: BudgetPlanCategory): boolean {
  if (c.isSavings === true) return true
  if (c.isSavings === false) return false
  return c.name.trim().toLowerCase() === 'savings'
}

/**
 * Effective budget for a plan category: sum of subcategories when any exist, else parent `amount`.
 * Values are in the row's fiat (`planCategoryCurrency`), not necessarily base.
 */
export function effectivePlanCategoryAmount(cat: BudgetPlanCategory): number {
  if (cat.subcategories.length > 0) {
    return cat.subcategories.reduce((s, sc) => s + (Number.isFinite(sc.amount) ? sc.amount : 0), 0)
  }
  return Number.isFinite(cat.amount) ? cat.amount : 0
}

/** Fiat for plan row amounts; invalid or missing uses `base`. */
export function planCategoryCurrency(cat: BudgetPlanCategory, base: Currency): Currency {
  const c = cat.currency
  if (c && FIAT_CURRENCIES.includes(c)) return c
  return base
}

/**
 * Effective category total converted to base currency for summaries and AI context.
 */
export function effectivePlanCategoryAmountInBase(
  cat: BudgetPlanCategory,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): number {
  const rowCur = planCategoryCurrency(cat, baseCurrency)
  const raw = effectivePlanCategoryAmount(cat)
  if (rowCur === baseCurrency) return raw
  const converted = tryConvertCurrency(raw, rowCur, baseCurrency, exchangeRates)
  return converted ?? raw
}

/** Sum of planned expense categories only (excludes savings allocation rows), in base currency. */
export function totalPlannedExpensesForPlan(
  plan: BudgetPlan,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): number {
  return plan.categories.reduce((sum, c) => {
    if (isSavingsPlanCategory(c)) return sum
    return sum + effectivePlanCategoryAmountInBase(c, baseCurrency, exchangeRates)
  }, 0)
}

/** Sum of savings allocation rows in the plan, in base currency. */
export function totalPlannedSavingsAllocationForPlan(
  plan: BudgetPlan,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): number {
  return plan.categories.reduce((sum, c) => {
    if (!isSavingsPlanCategory(c)) return sum
    return sum + effectivePlanCategoryAmountInBase(c, baseCurrency, exchangeRates)
  }, 0)
}

/** Same as {@link totalPlannedExpensesForPlan} — expense caps only, no savings row. */
export function totalExpenseBudgetFromPlan(
  plan: BudgetPlan,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): number {
  return totalPlannedExpensesForPlan(plan, baseCurrency, exchangeRates)
}

/**
 * Map plan categories to legacy `BudgetCategory` rows for dashboard expense caps (excludes savings rows).
 */
export function budgetCategoriesFromPlan(
  plan: BudgetPlan,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): BudgetCategory[] {
  return plan.categories
    .filter((c) => !isSavingsPlanCategory(c))
    .map((c) => ({
      category: c.name as BudgetCategory['category'],
      budgetedAmount: effectivePlanCategoryAmountInBase(c, baseCurrency, exchangeRates),
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
 * Spending per plan row: matches expenses by exact plan category name first,
 * then falls back to legacy enum matching for old expenses.
 */
export function categorySpendingForPlanRows(
  spendingByCategory: Record<string, number>,
  plan: BudgetPlan
): Record<string, number> {
  const out: Record<string, number> = {}
  // Plan row names (lowercased) so an alias is only folded in when the plan has
  // no dedicated row for that newer category.
  const planNames = new Set(
    plan.categories.map((c) => c.name.trim().toLowerCase()).filter(Boolean),
  )
  for (const cat of plan.categories) {
    if (isSavingsPlanCategory(cat)) continue
    const name = cat.name.trim()
    if (!name) continue
    const direct = spendingByCategory[name] ?? 0
    const enumCat = matchExpenseCategory(name)
    const legacy = enumCat != null && enumCat !== name ? spendingByCategory[enumCat] ?? 0 : 0
    // Fold newer spend categories (Groceries/Fuel/…) into their legacy bucket
    // unless the plan already has a dedicated row for them.
    const bucket = enumCat ?? name
    const aliases = CATEGORY_BUDGET_ALIASES[bucket] ?? []
    let aliasSum = 0
    for (const alias of aliases) {
      if (planNames.has(alias.toLowerCase())) continue
      aliasSum += spendingByCategory[alias] ?? 0
    }
    out[name] = direct + legacy + aliasSum
  }
  return out
}
