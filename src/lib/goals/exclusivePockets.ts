import type { Goal, SavingsAccount } from '@/lib/store/types'

/** Pockets linked to this goal and to no other goal: the only ones a goal delete may move or touch. */
export function exclusivePockets(goal: Goal, goals: readonly Goal[], accounts: readonly SavingsAccount[]): SavingsAccount[] {
  const sharedElsewhere = new Set(goals.filter((g) => g.id !== goal.id).flatMap((g) => g.linkedSavingsAccountIds))
  return accounts.filter((a) => goal.linkedSavingsAccountIds.includes(a.id) && !sharedElsewhere.has(a.id))
}
