import type { FinanceStore } from '@/lib/store/types'

/**
 * Return the id of the plan the user is currently editing, or create a fresh
 * "Primary plan" if none exists. Shared between the onboarding Buddgy flow
 * (`useOnboardingPage`) and the dashboard Build-My-Budget action
 * (`useAutoBudgetBuild`) so both refer to the same plan.
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
