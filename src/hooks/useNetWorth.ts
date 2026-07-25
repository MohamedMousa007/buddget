'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useRates } from '@/hooks/useRates'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { convertCurrency } from '@/lib/utils/currency'

/**
 * Net worth snapshot: savings + investments (account balances) + this month's cash flow − debt.
 *
 * The flow term is CASH movement (`stats.cashOutflow`), not accrual spend. It used
 * `totalSpentExcludingSavings`, which double-counted anything already carried by the
 * balance sheet: a 240 credit-card charge hit flow AND outstanding (−480), a BNPL
 * purchase hit flow AND its installment debt (−600), and a savings deposit raised the
 * balance while its income never left flow (+300 from nothing). Each event now moves net
 * worth exactly once — see {@link calculateCashOutflow}.
 */
export function useNetWorth() {
  useRates()
  const stats = useMonthlyStats()
  const {
    savingsAccounts,
    debts,
    settings,
    exchangeRates,
    goldPricePerGram,
    goldPriceAvailable,
  } = useFinanceStore(
    useShallow((s) => ({
      savingsAccounts: s.savingsAccounts,
      debts: s.debts,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
      goldPriceAvailable: s.goldPriceAvailable,
    }))
  )

  return useMemo(() => {
    const base = settings.baseCurrency
    const goldOk = goldPriceAvailable !== false
    let totalSavings = 0
    let totalInvestments = 0
    // A null valuation means the asset can't be priced (no FX path, e.g. BTC before live
    // crypto pricing). Exclude it and flag incomplete — never count it at its raw unit value.
    let valuationIncomplete = false
    for (const a of savingsAccounts) {
      const v = savingsAccountBalanceInBase(a, base, exchangeRates, goldPricePerGram, goldOk)
      if (v === null) {
        valuationIncomplete = true
        continue
      }
      if (a.category === 'investment') totalInvestments += v
      else totalSavings += v
    }

    const monthlyFlow = stats.totalIncome - stats.cashOutflow
    const netWorth = totalSavings + totalInvestments + monthlyFlow - stats.debtRemainingTotal

    const netWorthSecondary =
      settings.showSecondaryCurrency && settings.secondaryCurrency
        ? convertCurrency(netWorth, base, settings.secondaryCurrency, exchangeRates)
        : null

    const hasGoldSavings = savingsAccounts.some((a) => a.currency === 'XAU')
    const hasGoldDebt = debts.some((d) => d.isGold)
    const netWorthGoldIncomplete = !goldOk && (hasGoldSavings || hasGoldDebt)
    // Generalised: gold OR any other unpriceable holding (e.g. crypto pre-live-pricing).
    const netWorthIncomplete = netWorthGoldIncomplete || valuationIncomplete

    return {
      netWorth,
      netWorthSecondary,
      totalSavings,
      totalInvestments,
      totalDebt: stats.debtRemainingTotal,
      monthlyIncome: stats.totalIncome,
      monthlyFlow,
      baseCurrency: base,
      netWorthGoldIncomplete,
      netWorthIncomplete,
    }
  }, [
    savingsAccounts,
    debts,
    settings.baseCurrency,
    settings.secondaryCurrency,
    settings.showSecondaryCurrency,
    exchangeRates,
    goldPricePerGram,
    goldPriceAvailable,
    stats.totalIncome,
    stats.cashOutflow,
    stats.debtRemainingTotal,
  ])
}
