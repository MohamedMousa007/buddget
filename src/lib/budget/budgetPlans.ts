import { EXPENSE_CATEGORIES, FIAT_CURRENCIES } from '@/lib/constants/finance'
import type { BudgetCategory, BudgetPlan, BudgetPlanCategory, Currency, ExpenseCategory } from '@/lib/store/types'
import { tryConvertCurrency } from '@/lib/utils/currency'

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

/** Sum of all effective category amounts in a plan, in base currency. */
export function totalPlannedExpensesForPlan(
  plan: BudgetPlan,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): number {
  return plan.categories.reduce(
    (sum, c) => sum + effectivePlanCategoryAmountInBase(c, baseCurrency, exchangeRates),
    0
  )
}

/** Expense budget total for KPIs: all plan rows except a top-level "Savings" row (case-insensitive), matching legacy behavior. */
export function totalExpenseBudgetFromPlan(
  plan: BudgetPlan,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): number {
  return plan.categories.reduce((sum, c) => {
    if (c.name.trim().toLowerCase() === 'savings') return sum
    return sum + effectivePlanCategoryAmountInBase(c, baseCurrency, exchangeRates)
  }, 0)
}

/**
 * Map custom plan categories to legacy `BudgetCategory` rows for dashboard caps (category string = display name).
 */
export function budgetCategoriesFromPlan(
  plan: BudgetPlan,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): BudgetCategory[] {
  return plan.categories.map((c) => ({
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
