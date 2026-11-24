import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { backfillDueDates, recurringTxId } from '@/lib/savings/recurringDue'
import { depositRefusal, ledgerOf } from '@/lib/savings/pocketHome'
import { useSkippedInstalments } from '@/lib/savings/skippedInstalments'

/**
 * Posts every recurring savings deposit due up to `today` (ledger only). Each missed month is its own deposit,
 * dated on its due date so it lands in the right cycle; the deterministic id stops two devices double-posting.
 * No account can fund it: posted as new money. Its account has too little free money: that month is skipped and
 * the user is told (inbox), never retried silently.
 */
export function postDueRecurringSavings(today: string): void {
  const state = useFinanceStore.getState()
  for (const r of state.recurringSavingsDeposits) {
    if (!r.isActive || r.nextDueDate > today) continue

    const pocket = state.savingsAccounts.find((a) => a.id === r.accountId)
    if (!pocket) {
      state.updateRecurringSavingsDeposit(r.id, { isActive: false })
      continue
    }
    const amount = Math.max(0, Number(r.amount) || 0)
    if (amount <= 0) continue

    const { dues, next } = backfillDueDates(r.nextDueDate, today, r.dayOfMonth)
    for (const due of dues) {
      const now = useFinanceStore.getState()
      const ledger = ledgerOf(now)
      const landed = r.currency === pocket.currency ? amount : ledger.convert(amount, r.currency, pocket.currency) ?? amount
      const refusal = depositRefusal(ledger, pocket, { amount: landed })
      const last = due === dues[dues.length - 1]
      if (refusal === 'over_available') {
        useSkippedInstalments.getState().record({ ruleId: r.id, due, pocketName: pocket.name, amount, currency: r.currency, at: new Date().toISOString() })
        if (last) state.updateRecurringSavingsDeposit(r.id, { nextDueDate: next })
        continue
      }
      const deposited = state.depositToSavings(r.accountId, amount, r.currency, r.notes?.trim() || 'Recurring savings', {
        source: 'recurring_savings',
        txId: recurringTxId(r.id, due),
        date: due,
        ...(refusal === 'no_account_leg' ? { mode: 'declare' as const } : {}),
      })
      // A refused deposit (unpriced gold, no FX path) keeps its due date so the month is retried, not lost.
      if (!deposited) {
        state.updateRecurringSavingsDeposit(r.id, { nextDueDate: due })
        break
      }
      if (last) state.updateRecurringSavingsDeposit(r.id, { nextDueDate: next })
    }
  }
}
