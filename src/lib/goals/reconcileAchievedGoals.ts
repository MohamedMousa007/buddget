import type { Goal } from '@/lib/store/types'
import { computeGoalProgressDetail, type GoalProgressContext } from '@/lib/goals/computeGoalProgress'
import { withDebtDerived } from '@/lib/goals/debtGoal'

const EPS = 0.01

/**
 * Marks active goals as achieved when computed progress meets target (§4.5). One-way: it never moves an achieved goal
 * back (I-12). Returns updated goals and ids that newly achieved.
 */
export function reconcileAchievedGoals(
  goals: Goal[],
  ctx: GoalProgressContext
): { goals: Goal[]; newlyAchievedIds: string[] } {
  const newlyAchievedIds: string[] = []
  const iso = new Date().toISOString()
  const next = goals.map((g) => {
    if (g.status !== 'active') return g
    if (g.category === 'spending_control') return g
    // A gold debt that cannot be priced is missing from the target but still owed: progress would read as done.
    if (g.category === 'debt_freedom' && !ctx.goldPriceAvailable && ctx.debts.some((d) => d.isGold && g.linkedDebtIds.includes(d.id))) return g
    const target = withDebtDerived(g, ctx).targetAmount
    if (target === null || target <= 0) return g
    const progress = computeGoalProgressDetail(g, ctx)
    // Achieved is final, so a last (stale) gold price never completes a goal; the live price will.
    if (progress.stalePrice) return g
    if (progress.amount + EPS < target) return g
    newlyAchievedIds.push(g.id)
    // A new edit time: without it a pull that still carries the active server copy ties and wins.
    return { ...g, status: 'achieved' as const, achievedAt: g.achievedAt ?? iso, updatedAt: iso }
  })
  return { goals: next, newlyAchievedIds }
}

/**
 * The client half of the 0357 trigger (I-12): a write to an achieved goal keeps its status and achieved time; the rest
 * of the write lands. Every goal status writer goes through this (the store's `updateGoal`).
 */
export function keepAchieved(prev: Pick<Goal, 'status'>, updates: Partial<Goal>): Partial<Goal> {
  if (prev.status !== 'achieved' || updates.status === undefined || updates.status === 'achieved') return updates
  const rest = { ...updates }
  delete rest.status
  delete rest.achievedAt
  return rest
}

/**
 * The one way back from achieved (§0): Undo of the month-end that completed these goals reverts that completion.
 * Seam for P6: not wired yet. The month-end undo calls it for the proposal's `achieved_by_proposal` ids, in the same
 * write as `undo_month_end` (which sets `buddget.month_end_undo` so the trigger lets it through). Nothing else may.
 */
export function revertAchievedForMonthEndUndo(goals: Goal[], achievedByProposal: readonly string[]): Goal[] {
  const ids = new Set(achievedByProposal)
  const iso = new Date().toISOString()
  return goals.map((g) => (ids.has(g.id) && g.status === 'achieved' ? { ...g, status: 'active' as const, achievedAt: null, updatedAt: iso } : g))
}
