import type { Goal } from '@/lib/store/types'

/**
 * I-12 across copies of the same goals: a goal achieved in any of `others` stays achieved in `goals`, whatever the
 * edit times (an import, a merge with the server). The rest of each row is kept as given.
 */
export function withAchievedKept(goals: Goal[], ...others: readonly (readonly Goal[])[]): Goal[] {
  const achieved = new Map<string, Goal>()
  for (const list of others) for (const g of list) if (g.status === 'achieved' && !achieved.has(g.id)) achieved.set(g.id, g)
  if (achieved.size === 0) return goals
  return goals.map((g) => {
    const a = achieved.get(g.id)
    return a && g.status !== 'achieved' ? { ...g, status: 'achieved' as const, achievedAt: a.achievedAt } : g
  })
}
