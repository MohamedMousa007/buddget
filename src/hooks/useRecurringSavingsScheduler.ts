'use client'

import { useEffect } from 'react'
import { format } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { dueDatesThrough, recurringTxId } from '@/lib/savings/recurringDue'

/** Posts due recurring savings deposits (ledger only) once data has loaded; missed months collapse into one catch-up deposit; the newest due date's deterministic id stops devices double-posting. */
export function useRecurringSavingsScheduler() {
  const dataReady = useFinanceStore((s) => s.dataReady)
  useEffect(() => {
    if (!dataReady) return
    const tick = () => {
      const state = useFinanceStore.getState()
      const todayStr = format(new Date(), 'yyyy-MM-dd')

      for (const r of state.recurringSavingsDeposits) {
        if (!r.isActive || r.nextDueDate > todayStr) continue

        const acc = state.savingsAccounts.find((a) => a.id === r.accountId)
        if (!acc) {
          state.updateRecurringSavingsDeposit(r.id, { isActive: false })
          continue
        }
        const amount = Math.max(0, Number(r.amount) || 0)
        if (amount <= 0) continue

        const { due, next } = dueDatesThrough(r.nextDueDate, todayStr)
        state.depositToSavings(r.accountId, amount, r.currency, r.notes?.trim() || 'Recurring savings', {
          source: 'recurring_savings',
          txId: recurringTxId(r.id, due),
        })
        state.updateRecurringSavingsDeposit(r.id, { nextDueDate: next })
      }
    }

    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [dataReady])
}
