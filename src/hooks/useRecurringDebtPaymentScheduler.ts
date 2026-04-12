'use client'

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { pushRecurringDebtReminders } from '@/lib/debts/recurringDebtPush'

/**
 * Keeps recurring debt state consistent; surfaces local push reminders (due / tomorrow).
 * Payments post only after user confirms in-app (see `confirmRecurringDebtPayment`).
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
    pushRecurringDebtReminders()
  }, [snap])
}
