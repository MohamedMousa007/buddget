import { reconcileGoalsForState, useFinanceStore } from '@/lib/store/useFinanceStore'

/** Original order with the pocket back in; links the user changed during the Undo window are kept as they are now. */
function mergeLinks(original: string[], current: string[], id: string): string[] {
  const kept = original.filter((x) => x === id || current.includes(x))
  return [...kept, ...current.filter((x) => !kept.includes(x))]
}

/** Deletes a pocket and returns an Undo that puts back everything the delete removed (pocket, ledger, recurring deposits, goal links, carry default). */
export function deletePocketWithUndo(id: string): () => void {
  const before = useFinanceStore.getState()
  const account = before.savingsAccounts.find((a) => a.id === id)
  if (!account) return () => {}
  const transactions = before.savingsTransactions.filter((t) => t.accountId === id)
  const recurring = before.recurringSavingsDeposits.filter((r) => r.accountId === id)
  const goalLinks = new Map(before.goals.filter((g) => g.linkedSavingsAccountIds.includes(id)).map((g) => [g.id, g.linkedSavingsAccountIds]))
  const wasCarryDefault = before.profile.defaultCarryPocketId === id

  before.deleteSavingsAccount(id)

  return () => {
    useFinanceStore.setState((s) => {
      const next = {
        ...s,
        savingsAccounts: [...s.savingsAccounts, account],
        savingsTransactions: [...s.savingsTransactions, ...transactions],
        recurringSavingsDeposits: [...s.recurringSavingsDeposits, ...recurring],
        goals: s.goals.map((g) =>
          goalLinks.has(g.id) && !g.linkedSavingsAccountIds.includes(id)
            ? { ...g, linkedSavingsAccountIds: mergeLinks(goalLinks.get(g.id)!, g.linkedSavingsAccountIds, id) }
            : g,
        ),
      }
      return {
        savingsAccounts: next.savingsAccounts,
        savingsTransactions: next.savingsTransactions,
        recurringSavingsDeposits: next.recurringSavingsDeposits,
        goals: reconcileGoalsForState(next),
        ...(wasCarryDefault ? { profile: { ...s.profile, defaultCarryPocketId: id } } : {}),
      }
    })
  }
}

export function deleteHoldingWithUndo(id: string): () => void {
  const before = useFinanceStore.getState()
  const holding = before.investmentHoldings.find((h) => h.id === id)
  if (!holding) return () => {}
  before.deleteInvestmentHolding(id)
  return () => useFinanceStore.setState((s) => ({ investmentHoldings: [...s.investmentHoldings, holding] }))
}
