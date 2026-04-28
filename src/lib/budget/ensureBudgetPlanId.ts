import type { FinanceStore } from '@/lib/store/types'

/**
 * Return the id of the plan the user is currently editing, or create a fresh
 * "Primary plan" if none exists. Shared with onboarding completion, the budget
 * editor, and the dashboard auto-build action (`useAutoBudgetBuild`).
 *
 * Caller passes the store getter + mutators so the helper stays pure and
 * testable without React hooks.
 */
export function ensureBudgetPlanId(
  getState: () => FinanceStore,
  defaultName = 'Primary plan',
): string {
  const state = getState()
  if (state.activeBudgetPlanId) return state.activeBudgetPlanId
  if (state.budgetPlans.length > 0) return state.budgetPlans[0].id
  return state.addBudgetPlan(defaultName)
}
