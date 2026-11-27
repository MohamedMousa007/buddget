import { reconcileGoalsForState, useFinanceStore } from '@/lib/store/useFinanceStore'

/**
 * Deletes a goal and returns an Undo that puts back what the delete did (T41/T42): the goal, the parts it released
 * from their accounts (with their rows and recurring deposits, the balance-freezing adjustments dropped again), and
 * the goal link on the outside parts it kept as pockets.
 */
export function deleteGoalWithUndo(id: string): () => void {
  const before = useFinanceStore.getState()
  const goal = before.goals.find((g) => g.id === id)
  if (!goal) return () => {}
  const partsBefore = new Map(before.savingsAccounts.map((a) => [a.id, a]))
  const knownAdj = new Set(before.accountAdjustments.map((a) => a.id))

  before.deleteGoal(id)
  const after = useFinanceStore.getState()
  const kept = new Set(after.savingsAccounts.map((a) => a.id))
  const gone = new Set([...partsBefore.keys()].filter((pid) => !kept.has(pid)))
  const unlinked = new Set(after.savingsAccounts.filter((a) => partsBefore.get(a.id)?.goalId === id && a.goalId !== id).map((a) => a.id))
  const frozen = new Set(after.accountAdjustments.filter((a) => !knownAdj.has(a.id)).map((a) => a.id))
  const rows = before.savingsTransactions.filter((t) => gone.has(t.accountId))
  const recurring = before.recurringSavingsDeposits.filter((r) => gone.has(r.accountId))

  return () => {
    useFinanceStore.setState((s) => {
      // A fresh edit time so the server revives the rows instead of keeping them deleted.
      const now = new Date().toISOString()
      const next = {
        ...s,
        goals: s.goals.some((g) => g.id === id) ? s.goals : [...s.goals, { ...goal, updatedAt: now }],
        savingsAccounts: [
          ...s.savingsAccounts.map((a) => (unlinked.has(a.id) ? { ...a, goalId: id, updatedAt: now } : a)),
          ...[...gone].map((pid) => ({ ...partsBefore.get(pid)!, updatedAt: now })),
        ],
        savingsTransactions: [...s.savingsTransactions, ...rows.map((t) => ({ ...t, updatedAt: now }))],
        recurringSavingsDeposits: [...s.recurringSavingsDeposits, ...recurring],
        accountAdjustments: frozen.size ? s.accountAdjustments.filter((a) => !frozen.has(a.id)) : s.accountAdjustments,
      }
      return {
        goals: reconcileGoalsForState(next),
        savingsAccounts: next.savingsAccounts,
        savingsTransactions: next.savingsTransactions,
        recurringSavingsDeposits: next.recurringSavingsDeposits,
        accountAdjustments: next.accountAdjustments,
      }
    })
  }
}
