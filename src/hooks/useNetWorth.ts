'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useRates } from '@/hooks/useRates'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { useAccounts } from '@/lib/accounts/useAccounts'

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
  const accounts = useAccounts()
  const { lookup } = useAssetPrices()
  const {
    savingsAccounts,
    investmentHoldings,
    debts,
    settings,
    exchangeRates,
    goldPricePerGram,
    goldPriceAvailable,
  } = useFinanceStore(
    useShallow((s) => ({
      savingsAccounts: s.savingsAccounts,
      investmentHoldings: s.investmentHoldings,
      debts: s.debts,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
      goldPriceAvailable: s.goldPriceAvailable,
    }))
  )

  const basis = useMemo(() => {
    const tracked = accounts.accounts.filter((a) => a.balance)
    if (tracked.length === 0) return {}
    const ids = new Set(tracked.map((a) => a.method.id))
    return {
      accountsBasis: accounts.totalInBase,
      heldInPocketIds: new Set(savingsAccounts.filter((p) => p.heldInPaymentMethodId && ids.has(p.heldInPaymentMethodId)).map((p) => p.id)),
    }
  }, [accounts, savingsAccounts])

  return useMemo(
    () =>
      computeNetWorth({
        ...basis,
        savingsAccounts,
        investmentHoldings,
        debts,
        settings,
        exchangeRates,
        goldPricePerGram,
        goldPriceAvailable,
        lookup,
        monthlyIncome: stats.totalIncome,
        cashOutflow: stats.cashOutflow,
        debtRemaining: stats.debtRemainingTotal,
      }),
    [
      savingsAccounts,
      investmentHoldings,
      lookup,
      debts,
      settings,
      exchangeRates,
      goldPricePerGram,
      goldPriceAvailable,
      stats.totalIncome,
      stats.cashOutflow,
      stats.debtRemainingTotal,
      basis,
    ],
  )
}
