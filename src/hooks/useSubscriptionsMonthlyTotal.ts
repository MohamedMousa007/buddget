import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { subscriptionsMonthlyBaseTotal } from '@/lib/subscriptions/subscriptionRecurring'

/**
 * Sum of active + trial subscriptions as monthly-equivalent amounts in the user's base currency.
 */
export function useSubscriptionsMonthlyBaseTotal() {
  const { subscriptions, settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({
      subscriptions: s.subscriptions,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
    }))
  )
  return useMemo(
    () => subscriptionsMonthlyBaseTotal(subscriptions, settings.baseCurrency, exchangeRates),
    [subscriptions, settings.baseCurrency, exchangeRates]
  )
}
