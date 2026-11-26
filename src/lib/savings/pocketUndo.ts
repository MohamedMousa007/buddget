import { reconcileGoalsForState, useFinanceStore } from '@/lib/store/useFinanceStore'
import { assetFundingId } from '@/lib/savings/assetPurchase'
import { balanceEpsilon, settleBalance } from '@/lib/savings/balanceMath'

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
  // Balance-freezing adjustments the delete wrote for a held pocket; Undo brings the rows (and their legs) back, so they go.
  const known = new Set(before.accountAdjustments.map((a) => a.id))
  const frozen = new Set(useFinanceStore.getState().accountAdjustments.filter((a) => !known.has(a.id)).map((a) => a.id))

  return () => {
    useFinanceStore.setState((s) => {
      // A fresh edit time so the server revives the rows instead of keeping them deleted.
      const now = new Date().toISOString()
      const next = {
        ...s,
        savingsAccounts: [...s.savingsAccounts, { ...account, updatedAt: now }],
        savingsTransactions: [...s.savingsTransactions, ...transactions.map((t) => ({ ...t, updatedAt: now }))],
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
        ...(frozen.size ? { accountAdjustments: s.accountAdjustments.filter((a) => !frozen.has(a.id)) } : {}),
        goals: reconcileGoalsForState(next),
        ...(wasCarryDefault ? { profile: { ...s.profile, defaultCarryPocketId: id } } : {}),
      }
    })
  }
}

/**
 * Deletes a holding together with the money row that paid for it (see `assetFundingId`): the expense out of an account,
 * or the pocket withdrawal, whose money goes back. Undo puts both back; it does nothing when the pocket no longer holds
 * enough to take the money out again, so the asset is never restored without its cost.
 */
export function deleteHoldingWithUndo(id: string): () => void {
  const before = useFinanceStore.getState()
  const holding = before.investmentHoldings.find((h) => h.id === id)
  if (!holding) return () => {}
  const fundingId = assetFundingId(id)
  const expense = before.expenses.find((e) => e.id === fundingId)
  const tx = before.savingsTransactions.find((t) => t.id === fundingId)
  before.deleteInvestmentHolding(id)
  if (expense) before.deleteExpense(expense.id)
  // Removing a withdrawal only adds money back, so it is never refused for going negative.
  if (tx) useFinanceStore.getState().deleteSavingsTransaction(tx.id)
  return () => {
    const s = useFinanceStore.getState()
    const now = new Date().toISOString()
    if (tx && !s.savingsTransactions.some((t) => t.id === tx.id)) {
      const pocket = s.savingsAccounts.find((a) => a.id === tx.accountId)
      if (!pocket || pocket.currentBalance + balanceEpsilon(pocket.currency) < tx.amount) return
      useFinanceStore.setState((st) => {
        const next = {
          ...st,
          savingsTransactions: [...st.savingsTransactions, { ...tx, updatedAt: now }],
          savingsAccounts: st.savingsAccounts.map((a) => (a.id === tx.accountId ? { ...a, currentBalance: settleBalance(a.currentBalance - tx.amount) } : a)),
        }
        return { savingsTransactions: next.savingsTransactions, savingsAccounts: next.savingsAccounts, goals: reconcileGoalsForState(next) }
      })
    }
    if (expense) useFinanceStore.getState().restoreExpense(expense)
    useFinanceStore.setState((st) => (st.investmentHoldings.some((h) => h.id === id) ? {} : { investmentHoldings: [...st.investmentHoldings, { ...holding, updatedAt: now }] }))
  }
}
