import type { Goal } from '@/lib/store/types'
import { computeGoalProgress, type GoalProgressContext } from '@/lib/goals/computeGoalProgress'

const EPS = 0.01

/**
 * Marks active goals as achieved when computed progress meets target. Returns updated goals and ids that newly achieved.
 */
export function reconcileAchievedGoals(
  goals: Goal[],
  ctx: GoalProgressContext
): { goals: Goal[]; newlyAchievedIds: string[] } {
  const newlyAchievedIds: string[] = []
  const iso = new Date().toISOString()
  const next = goals.map((g) => {
    if (g.status !== 'active') return g
    if (g.targetAmount === null || g.targetAmount <= 0) return g
    if (g.category === 'spending_control') return g
    const progress = computeGoalProgress(g, ctx)
    if (progress + EPS < g.targetAmount) return g
    newlyAchievedIds.push(g.id)
    return { ...g, status: 'achieved' as const, achievedAt: g.achievedAt ?? iso }
  })
  return { goals: next, newlyAchievedIds }
}
