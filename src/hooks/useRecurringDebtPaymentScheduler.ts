'use client'

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { applyDueRecurringDebtPayments } from '@/lib/utils/recurringDebtPayments'

/**
 * Runs when finance data changes so due recurring debt payments post automatically (same session).
 */
export function useRecurringDebtPaymentScheduler() {
  const snap = useFinanceStore(
    useShallow((s) => ({
      recurringDebtPayments: s.recurringDebtPayments,
      debts: s.debts,
      debtPayments: s.debtPayments,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
      baseCurrency: s.settings.baseCurrency,
    }))
  )

  useEffect(() => {
    applyDueRecurringDebtPayments()
  }, [snap])
}
