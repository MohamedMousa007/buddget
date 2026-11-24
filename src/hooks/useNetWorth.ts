'use client'

import { countedDebtPayments, countedDebts } from '@/lib/spending/exclusion'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useRates } from '@/hooks/useRates'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { useLedgerInput } from '@/lib/accounts/useAccounts'
import { accountsBasisFor } from '@/lib/accounts/netWorthBasis'
import { cycleKeyFor } from '@/lib/settings/payCycle'

/** Net worth: pockets + investments + tracked account balances − debt (see {@link computeNetWorth}). */
export function useNetWorth() {
  useRates()
  // Net worth is a statement about now: browsing an earlier month on Flow must not change it.
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)
  const stats = useMonthlyStats(cycleKeyFor(new Date(), monthStartDay))
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
      debts: countedDebts(s.debts, s.paymentMethods),
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
      goldPriceAvailable: s.goldPriceAvailable,
    }))
  )

  const ledger = useLedgerInput()
  const basis = useMemo(() => accountsBasisFor(ledger, settings.baseCurrency), [ledger, settings.baseCurrency])

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
      stats.debtRemainingTotal,
      basis,
    ],
  )
}
