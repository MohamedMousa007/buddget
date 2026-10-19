import type { BudgetPlan, BudgetPlanCategory } from '@/lib/store/types'

/** Deep copy of a plan's lines with fresh ids (and fresh subcategory ids), so the copy never shares identity. */
export function duplicatePlanCategories(plan: BudgetPlan, newId: () => string): BudgetPlanCategory[] {
  return plan.categories.map((c) => ({
    ...c,
    id: newId(),
    linkIds: c.linkIds ? [...c.linkIds] : c.linkIds,
    expenseCategories: c.expenseCategories ? [...c.expenseCategories] : c.expenseCategories,
    subcategories: c.subcategories.map((s) => ({ ...s, id: newId() })),
  }))
}
