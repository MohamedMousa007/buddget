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

/**
 * The plan the Budget page shows when no plan is live: the first draft or archived one, so the plan chrome
 * (switcher, add) stays reachable. Undefined when a live plan exists (it is used) or the user has no plans at all.
 */
export function fallbackPlanId(plans: readonly BudgetPlan[], activeId: string | null): string | undefined {
  return selectActivePlan(plans, activeId) ? undefined : plans[0]?.id
}
