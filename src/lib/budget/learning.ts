import type { BudgetPlan, BudgetPlanActivation } from '@/lib/store/types'

/** A plan whose amounts are mostly estimates counts as learning for the cycle it first took over. */
const ESTIMATED_SHARE = 0.3

/**
 * True while a freshly activated plan is still mostly guesses: it first took over this cycle and a real share of
 * its money sits on estimated lines. Over-budget alarms stay quiet then, because the benchmark may simply be wrong.
 */
export function isLearning(plan: BudgetPlan, activations: BudgetPlanActivation[], cycleKey: string): boolean {
  const first = activations
    .filter((a) => a.planId === plan.id)
    .map((a) => a.effectiveFrom.slice(0, 7))
    .sort()[0]
  if (first !== cycleKey) return false
  const total = plan.categories.reduce((sum, c) => sum + c.amount, 0)
  if (total <= 0) return false
  const estimated = plan.categories.filter((c) => c.confidence === 'estimated').reduce((sum, c) => sum + c.amount, 0)
  return estimated / total >= ESTIMATED_SHARE
}
