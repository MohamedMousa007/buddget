import { EXPENSE_CATEGORIES, FIAT_CURRENCIES } from '@/lib/constants/finance'
import { CATEGORY_BUDGET_ALIASES, isNonSpendCategory } from '@/lib/constants/categoryMeta'
import type { BudgetCategory, BudgetPlan, BudgetPlanCategory, Currency, ExpenseCategory } from '@/lib/store/types'
import { tryConvertCurrency } from '@/lib/utils/currency'

/**
 * Savings allocation rows are excluded from "planned expenses" totals.
 * Legacy plans: only the single top-level name "Savings" (case-insensitive) is treated as savings unless `isSavings` is false.
 */
export function isSavingsPlanCategory(c: BudgetPlanCategory): boolean {
  if (c.isSavings === true) return true
  // Safety-net and goal lines are savings movements by definition (not spend).
  if (c.block === 'safety' || c.block === 'goals') return true
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
 * A row with no rate path counts as 0 (see {@link isPlanCategoryUnconverted}), never its raw foreign amount.
 */
export function effectivePlanCategoryAmountInBase(
  cat: BudgetPlanCategory,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): number {
  const rowCur = planCategoryCurrency(cat, baseCurrency)
  const raw = effectivePlanCategoryAmount(cat)
  if (rowCur === baseCurrency) return raw
  return tryConvertCurrency(raw, rowCur, baseCurrency, exchangeRates) ?? 0
}

/** True when a plan row is in a currency with no rate path to base, so it counts as 0 in every total. */
export function isPlanCategoryUnconverted(
  cat: BudgetPlanCategory,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): boolean {
  const rowCur = planCategoryCurrency(cat, baseCurrency)
  return rowCur !== baseCurrency && tryConvertCurrency(1, rowCur, baseCurrency, exchangeRates) === null
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

/** Plan-row spellings (incl. the "Add category" preset labels) that name an expense category. */
const PLAN_NAME_SPELLINGS: Readonly<Record<string, ExpenseCategory>> = {
  subscriptions: 'Subscription',
}

function matchExpenseCategory(planName: string): ExpenseCategory | null {
  const t = planName.trim()
  if (!t) return null
  const hit = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === t.toLowerCase())
  return hit ?? PLAN_NAME_SPELLINGS[t.toLowerCase()] ?? null
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
    plan.categories.flatMap((c) => [c.name, matchExpenseCategory(c.name) ?? '']).map((n) => n.trim().toLowerCase()).filter(Boolean),
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

/** Names of the plan's spend rows (savings allocation rows excluded), as typed by the user. */
export function planRowNames(plan: BudgetPlan): string[] {
  return plan.categories.filter((c) => !isSavingsPlanCategory(c) && c.name.trim()).map((c) => c.name.trim())
}

/**
 * The plan row that budgets an expense category: a row with the same name (case-insensitive),
 * else the row whose legacy bucket folds it in (Groceries under Food, Fuel under Transport…).
 * `null` when no row covers it. Single resolver for chips, ring %, tap-filter and hero cap.
 */
export function resolveBudgetKey(category: string, rowNames: readonly string[]): string | null {
  const t = category.trim().toLowerCase()
  if (!t) return null
  const direct = rowNames.find((n) => n.trim().toLowerCase() === t)
  if (direct) return direct
  const spelled = rowNames.find((n) => matchExpenseCategory(n)?.toLowerCase() === t)
  if (spelled) return spelled
  for (const row of rowNames) {
    const aliases = CATEGORY_BUDGET_ALIASES[matchExpenseCategory(row) ?? row] ?? []
    if (aliases.some((a) => a.toLowerCase() === t)) return row
  }
  return null
}

/** Every expense category a plan row covers: its own name, its enum spelling, and its folded aliases. */
export function categoriesForBudgetKey(row: string, rowNames: readonly string[]): string[] {
  const enumCat = matchExpenseCategory(row)
  const own = new Set(rowNames.map((n) => n.trim().toLowerCase()))
  const aliases = (CATEGORY_BUDGET_ALIASES[enumCat ?? row] ?? []).filter((a) => !own.has(a.toLowerCase()))
  return [...new Set([row, ...(enumCat ? [enumCat] : []), ...aliases])]
}

/** Budget cap (base currency) that covers a category, or `undefined` when unassigned or the row is 0. */
export function capForCategory(category: string, caps: Readonly<Record<string, number>>): number | undefined {
  const key = resolveBudgetKey(category, Object.keys(caps))
  const cap = key == null ? 0 : caps[key] ?? 0
  return cap > 0 ? cap : undefined
}

/** The one plan row every given category resolves to, else `null` (mixed, uncovered or empty). */
export function sharedBudgetKey(categories: readonly string[], rowNames: readonly string[]): string | null {
  if (categories.length === 0) return null
  const keys = new Set(categories.map((c) => resolveBudgetKey(c, rowNames)))
  const [only] = keys
  return keys.size === 1 && only != null ? only : null
}

/** The plan's catch-all row, if it has one. */
export function otherRowName(rowNames: readonly string[]): string | null {
  return rowNames.find((n) => n.trim().toLowerCase() === 'other') ?? null
}

/** Spend (base currency) in spend categories that no plan row covers. Non-spend categories never count. */
export function unassignedSpend(
  spendingByCategory: Readonly<Record<string, number>>,
  rowNames: readonly string[]
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [cat, amount] of Object.entries(spendingByCategory)) {
    if (!(amount > 0) || isNonSpendCategory(cat) || resolveBudgetKey(cat, rowNames) != null) continue
    out[cat] = amount
  }
  return out
}
