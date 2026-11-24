'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { budgetMonthKeyFor } from '@/lib/utils/calculations'
import { useNetWorthPath } from '@/hooks/useNetWorthHistory'
import { useNetWorth } from '@/hooks/useNetWorth'
import { buildInsightInput } from './buildInput'
import { heroAnswer } from './detectors'
import { computeInsights } from './rank'

/** The slice of the store the insights read, shallow-compared so unrelated edits do not recompute them. */
export function useInsightSource() {
  return useFinanceStore(
    useShallow((s) => ({
      expenses: s.expenses,
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      paymentMethods: s.paymentMethods,
      subscriptions: s.subscriptions,
      debts: s.debts,
      debtPayments: s.debtPayments,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
      goldPriceAvailable: s.goldPriceAvailable,
    })),
  )
}

/** The running cycle's hero answer and ranked findings. Pure maths on the device, no network and no AI cost. */
export function useInsights() {
  const src = useInsightSource()
  const stats = useMonthlyStats(budgetMonthKeyFor(new Date(), src.settings.monthStartDay))
  const nw = useNetWorth()
  const netWorthPath = useNetWorthPath(nw.baseCurrency, nw.accountsTotal != null ? 'accounts' : 'legacy', !nw.netWorthIncomplete)
  return useMemo(() => {
    const input = { ...buildInsightInput(src, stats.leftToSpend, new Date(), !stats.incomeBlocked), netWorthPath }
    return { input, hero: heroAnswer(input), insights: computeInsights(input), stats }
  }, [src, stats, netWorthPath])
}
