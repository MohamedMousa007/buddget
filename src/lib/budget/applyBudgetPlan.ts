import type { FinanceStore, Currency } from '@/lib/store/types'
import type { BudgetCategoryRow } from '@/lib/budget/lifestyleMappings'
import { isSavingsCategoryRow } from '@/lib/budget/lifestyleMappings'

export interface ApplyBudgetPlanInput {
  planId: string
  /** Generated or seed categories — savings rows are filtered out here. */
  categories: BudgetCategoryRow[]
  /** Currency to stamp on the written BudgetPlanCategory rows. */
  currency: Currency
  /** Optional summary blob for AI / planner context. */
  financialGoalsNotes?: string | null
}

/**
 * Shared write-path used by onboarding completion, manual edits,
 * and the dashboard single-shot AI action (`useAutoBudgetBuild`). Keeps the
 * plan-category replacement + completion markers in one place so paths can't drift.
 *
 * Pure-ish — takes the store getter so it can be called from React hooks
 * without a re-render dependency on the store slice.
 */
export function applyBudgetPlan(
  getState: () => FinanceStore,
  input: ApplyBudgetPlanInput,
): void {
  const state = getState()
  const expenseOnly = input.categories.filter((c) => !isSavingsCategoryRow(c))

  state.replaceBudgetPlanCategories(
    input.planId,
    expenseOnly.map((c) => ({
      id: crypto.randomUUID(),
      name: c.name,
      icon: c.emoji,
      amount: c.amount,
      currency: input.currency,
      subcategories: [],
    })),
  )

  state.updateBudgetPlan(input.planId, {
    buddgyGuidedComplete: true,
    buddgyFlow: null,
  })

  // Pin this plan as active so the homepage's `useMonthlyStats` resolves
  // it as `activePlan` and "left to spend" / category bars reflect the
  // freshly-applied categories. Without this, a stale `activeBudgetPlanId`
  // hydrated from Supabase keeps homepage stuck on an old plan.
  if (state.activeBudgetPlanId !== input.planId) {
    state.setActiveBudgetPlanId(input.planId)
  }

  if (input.financialGoalsNotes && input.financialGoalsNotes.trim()) {
    state.setFinancialGoalsNotes(input.financialGoalsNotes.trim())
  }
}
