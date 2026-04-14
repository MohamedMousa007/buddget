import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { convertCurrency } from '@/lib/utils/currency'
import { subscriptionToMonthlyPlannerAmount } from '@/lib/subscriptions/subscriptionRecurring'

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
  return useMemo(() => {
    const base = settings.baseCurrency
    let sum = 0
    for (const sub of subscriptions) {
      if (sub.status !== 'active' && sub.status !== 'trial') continue
      const monthlyEq = subscriptionToMonthlyPlannerAmount(sub.amount, sub.billingCycle)
      sum += convertCurrency(monthlyEq, sub.currency, base, exchangeRates)
    }
    return sum
  }, [subscriptions, settings.baseCurrency, exchangeRates])
}
