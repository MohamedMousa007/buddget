import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { backfillDueDates, recurringTxId } from '@/lib/savings/recurringDue'

/**
 * Posts every recurring savings deposit due up to `today` (ledger only). Each missed month is its own deposit,
 * dated on its due date so it lands in the right cycle; the deterministic id stops two devices double-posting.
 */
export function postDueRecurringSavings(today: string): void {
  const state = useFinanceStore.getState()
  for (const r of state.recurringSavingsDeposits) {
    if (!r.isActive || r.nextDueDate > today) continue

    if (!state.savingsAccounts.some((a) => a.id === r.accountId)) {
      state.updateRecurringSavingsDeposit(r.id, { isActive: false })
      continue
    }
    const amount = Math.max(0, Number(r.amount) || 0)
    if (amount <= 0) continue

    const { dues, next } = backfillDueDates(r.nextDueDate, today, r.dayOfMonth)
    for (const due of dues) {
      const deposited = state.depositToSavings(r.accountId, amount, r.currency, r.notes?.trim() || 'Recurring savings', {
        source: 'recurring_savings',
        txId: recurringTxId(r.id, due),
        date: due,
      })
      // A refused deposit (unpriced gold, no FX path) keeps its due date so the month is retried, not lost.
      if (!deposited) {
        state.updateRecurringSavingsDeposit(r.id, { nextDueDate: due })
        break
      }
      if (due === dues[dues.length - 1]) state.updateRecurringSavingsDeposit(r.id, { nextDueDate: next })
    }
  }
}
