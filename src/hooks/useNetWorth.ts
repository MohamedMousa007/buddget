'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useRates } from '@/hooks/useRates'
import { useGoldPrice } from '@/hooks/useGoldPrice'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { convertCurrency } from '@/lib/utils/currency'

/**
 * Net worth snapshot: savings + investments (account balances) + this month’s cash flow − debt.
 * Cash flow uses income minus expenses excluding savings-tagged expense lines (see `useMonthlyStats`).
 */
export function useNetWorth() {
  useRates()
  useGoldPrice()
  const stats = useMonthlyStats()
  const { savingsAccounts, settings, exchangeRates, goldPricePerGram } = useFinanceStore(
    useShallow((s) => ({
      savingsAccounts: s.savingsAccounts,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
    }))
  )

  return useMemo(() => {
    const base = settings.baseCurrency
    let totalSavings = 0
    let totalInvestments = 0
    for (const a of savingsAccounts) {
      const v = savingsAccountBalanceInBase(a, base, exchangeRates, goldPricePerGram)
      if (a.category === 'investment') totalInvestments += v
      else totalSavings += v
    }

    const monthlyFlow = stats.totalIncome - stats.totalSpentExcludingSavings
    const netWorth = totalSavings + totalInvestments + monthlyFlow - stats.debtRemainingTotal

    const netWorthSecondary =
      settings.showSecondaryCurrency && settings.secondaryCurrency
        ? convertCurrency(netWorth, base, settings.secondaryCurrency, exchangeRates)
        : null

    return {
      netWorth,
      netWorthSecondary,
      totalSavings,
      totalInvestments,
      totalDebt: stats.debtRemainingTotal,
      monthlyIncome: stats.totalIncome,
      monthlyExpenses: stats.totalSpentExcludingSavings,
      monthlyFlow,
      baseCurrency: base,
    }
  }, [
    savingsAccounts,
    settings.baseCurrency,
    settings.secondaryCurrency,
    settings.showSecondaryCurrency,
    exchangeRates,
    goldPricePerGram,
    stats.totalIncome,
    stats.totalSpentExcludingSavings,
    stats.debtRemainingTotal,
  ])
}
