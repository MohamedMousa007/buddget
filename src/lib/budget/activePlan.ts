import type { BudgetPlan } from '@/lib/store/types'

/** A plan that can drive stats: not a half-built draft and not archived. */
export function isLivePlan(p: BudgetPlan): boolean {
  return p.status !== 'draft' && p.status !== 'archived'
}

/**
 * The plan every budget surface reads. The stored active id wins; otherwise the first live plan.
 * Null when the user has no live plan (the legacy flat `budgetCategories` then apply).
 */
export function selectActivePlan(plans: readonly BudgetPlan[], activeId: string | null): BudgetPlan | null {
  return plans.find((p) => p.id === activeId) ?? plans.find(isLivePlan) ?? null
}
