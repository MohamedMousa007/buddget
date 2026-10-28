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

/** The plan-level inputs a copy must keep, or its free money and percentages drift from the original. */
export function duplicatePlanExtras(plan: BudgetPlan): Pick<BudgetPlan, 'incomeOverride' | 'household' | 'rationale'> {
  return { incomeOverride: plan.incomeOverride, household: plan.household, rationale: plan.rationale }
}
