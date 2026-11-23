'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { budgetMonthKeyFor } from '@/lib/utils/calculations'
import { buildInsightInput } from './buildInput'
import { heroAnswer } from './detectors'
import { computeInsights } from './rank'

/** The running cycle's hero answer and ranked findings. Pure maths on the device, no network and no AI cost. */
export function useInsights() {
  const src = useFinanceStore(
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
  const stats = useMonthlyStats(budgetMonthKeyFor(new Date(), src.settings.monthStartDay))
  return useMemo(() => {
    const input = buildInsightInput(src, stats.leftToSpend, new Date())
    return { input, hero: heroAnswer(input), insights: computeInsights(input), stats }
  }, [src, stats])
}
