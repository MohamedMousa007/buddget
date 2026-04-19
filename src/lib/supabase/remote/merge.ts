import type { Snapshot } from './snapshot'

/** One array slice keyed by id, plus an optional `updatedAt`/`createdAt` tiebreaker. */
type WithId = { id: string; updatedAt?: string; createdAt?: string }

/**
 * Merge two lists of id'd items:
 *  - Union by id
 *  - If the same id appears in both lists, keep the one with the newer `updatedAt`
 *    (falling back to `createdAt`, then to `server` as the safer default).
 */
function mergeList<T extends WithId>(local: T[], server: T[]): T[] {
  const byId = new Map<string, T>()
  for (const r of server) byId.set(r.id, r)
  for (const l of local) {
    const s = byId.get(l.id)
    if (!s) {
      byId.set(l.id, l)
      continue
    }
    const lt = l.updatedAt || l.createdAt || ''
    const st = s.updatedAt || s.createdAt || ''
    if (lt > st) byId.set(l.id, l)
    // else keep server
  }
  return Array.from(byId.values())
}

/**
 * Merge a local Zustand snapshot with the server snapshot. Singleton slices
 * (profile/settings/onboardingState) prefer the server — signing in expresses
 * a clear intent to use the server's identity. Used on first sign-in of a
 * returning user or when merging offline edits made while signed out.
 */
export function mergeSnapshots(local: Snapshot, server: Snapshot): Snapshot {
  return {
    profile: server.profile,
    settings: server.settings,
    onboardingState: server.onboardingState,
    // Singletons-ish:
    financialGoalsNotes: server.financialGoalsNotes || local.financialGoalsNotes,
    activeBudgetPlanId: server.activeBudgetPlanId ?? local.activeBudgetPlanId,
    // Array domains: union by id, newer `updatedAt`/`createdAt` wins.
    paymentMethods: mergeList(local.paymentMethods as WithId[], server.paymentMethods as WithId[]) as Snapshot['paymentMethods'],
    incomeSources: mergeList(local.incomeSources, server.incomeSources),
    expenses: mergeList(local.expenses, server.expenses),
    recurringExpenses: mergeList(local.recurringExpenses as WithId[], server.recurringExpenses as WithId[]) as Snapshot['recurringExpenses'],
    subscriptions: mergeList(local.subscriptions as WithId[], server.subscriptions as WithId[]) as Snapshot['subscriptions'],
    debts: mergeList(local.debts, server.debts),
    debtPayments: mergeList(local.debtPayments, server.debtPayments),
    recurringDebtPayments: mergeList(local.recurringDebtPayments, server.recurringDebtPayments),
    savingsAccounts: mergeList(local.savingsAccounts, server.savingsAccounts),
    savingsHoldings: mergeList(local.savingsHoldings, server.savingsHoldings),
    savingsTransactions: mergeList(local.savingsTransactions as WithId[], server.savingsTransactions as WithId[]) as Snapshot['savingsTransactions'],
    recurringSavingsDeposits: mergeList(local.recurringSavingsDeposits, server.recurringSavingsDeposits),
    goals: mergeList(local.goals, server.goals),
    budgetPlans: mergeList(local.budgetPlans as WithId[], server.budgetPlans as WithId[]) as Snapshot['budgetPlans'],
  }
}

/** True if the local Zustand state has any user-entered data. */
export function hasMeaningfulLocalState(s: Snapshot): boolean {
  return (
    s.paymentMethods.length > 0 ||
    s.incomeSources.length > 0 ||
    s.expenses.length > 0 ||
    s.subscriptions.length > 0 ||
    s.debts.length > 0 ||
    s.goals.length > 0 ||
    s.savingsAccounts.length > 0 ||
    s.budgetPlans.length > 0
  )
}
