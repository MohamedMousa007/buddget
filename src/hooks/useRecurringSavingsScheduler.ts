'use client'

import { useEffect } from 'react'
import { addMonths, format, parseISO } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/**
 * Posts due recurring savings deposits (ledger only — not expenses) and advances `nextDueDate`.
 */
export function useRecurringSavingsScheduler() {
  useEffect(() => {
    const tick = () => {
      const state = useFinanceStore.getState()
      const todayStr = format(new Date(), 'yyyy-MM-dd')

      for (const r of state.recurringSavingsDeposits) {
        if (!r.isActive) continue
        if (r.nextDueDate > todayStr) continue

        const acc = state.savingsAccounts.find((a) => a.id === r.accountId)
        if (!acc) {
          state.updateRecurringSavingsDeposit(r.id, { isActive: false })
          continue
        }

        const amount = Math.max(0, Number(r.amount) || 0)
        if (amount <= 0) continue

        state.depositToSavings(r.accountId, amount, r.currency, r.notes?.trim() || 'Recurring savings', {
          source: 'recurring_savings',
        })

        const iso = r.nextDueDate.includes('T') ? r.nextDueDate : `${r.nextDueDate}T12:00:00`
        let next = addMonths(parseISO(iso), 1)
        let nextStr = format(next, 'yyyy-MM-dd')
        let guard = 0
        while (nextStr <= todayStr && guard < 36) {
          next = addMonths(next, 1)
          nextStr = format(next, 'yyyy-MM-dd')
          guard += 1
        }
        state.updateRecurringSavingsDeposit(r.id, { nextDueDate: nextStr })
      }
    }

    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])
}
