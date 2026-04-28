import type { BudgetCategoryRow } from '@/lib/budget/lifestyleMappings'
import { isSavingsCategoryRow } from '@/lib/budget/lifestyleMappings'

function sumExpenseBudgetAmounts(categories: BudgetCategoryRow[]): number {
  return categories.filter((c) => !isSavingsCategoryRow(c)).reduce((s, c) => s + c.amount, 0)
}

/** Income minus fixed costs minus non-savings budget rows (rounded). */
export function computeBudgetPreviewSurplus(
  monthlyIncome: number,
  fixedCostsTotal: number,
  categories: BudgetCategoryRow[],
): number {
  return Math.round(monthlyIncome - fixedCostsTotal - sumExpenseBudgetAmounts(categories))
}
