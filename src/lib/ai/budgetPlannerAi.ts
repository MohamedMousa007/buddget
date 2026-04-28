import type { BudgetPlan, Currency } from '@/lib/store/types'
import {
  effectivePlanCategoryAmount,
  effectivePlanCategoryAmountInBase,
  isSavingsPlanCategory,
  planCategoryCurrency,
} from '@/lib/budget/budgetPlans'

/** Serializable snapshot for prompts (ids preserved for AI apply actions). */
export function buildPlanRowsForPrompt(
  plan: BudgetPlan,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): string {
  const rows = plan.categories.map((c) => ({
    categoryId: c.id,
    name: c.name,
    icon: c.icon,
    isSavings: isSavingsPlanCategory(c),
    rowCurrency: planCategoryCurrency(c, baseCurrency),
    amountIfNoSubs: c.amount,
    subcategories: c.subcategories.map((s) => ({
      subcategoryId: s.id,
      name: s.name,
      amount: s.amount,
    })),
    effectiveTotalInRowCurrency: effectivePlanCategoryAmount(c),
    effectiveTotalInBase: effectivePlanCategoryAmountInBase(c, baseCurrency, exchangeRates),
  }))
  return JSON.stringify(rows, null, 2)
}
