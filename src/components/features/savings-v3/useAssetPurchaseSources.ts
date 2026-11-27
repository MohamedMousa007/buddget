'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { MoneySource } from '@/components/features/savings-v3/MoneySourceField'
import type { PocketVM } from '@/components/features/savings-v3/types'
import { useAccounts } from '@/lib/accounts/useAccounts'
import { primaryTrackedAccount } from '@/lib/savings/accountLeg'
import { isEligibleCarryPocket } from '@/lib/savings/eligiblePocket'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/**
 * What an asset buy's "Paid from" needs: the store slices `planAssetPurchase` reads, the accounts and pockets to pick,
 * and the picked source with an unpicked account resolved to the primary tracked account.
 */
export function useAssetPurchaseSources(source: MoneySource) {
  const { accounts } = useAccounts()
  const store = useFinanceStore(useShallow((s) => ({
    paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debtPayments: s.debtPayments,
    debts: s.debts, savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts,
    accountAdjustments: s.accountAdjustments, exchangeRates: s.exchangeRates, settings: s.settings,
    goldPricePerGram: s.goldPricePerGram, goldPriceAvailable: s.goldPriceAvailable,
  })))
  const pockets = useMemo<PocketVM[]>(
    () => store.savingsAccounts.filter(isEligibleCarryPocket).map((account) => ({ account, coverAmount: 0, goalsAmount: 0, goalLabel: '' })),
    [store.savingsAccounts],
  )
  const effective: MoneySource = source.kind === 'account'
    ? { kind: 'account', id: source.id ?? primaryTrackedAccount(store.paymentMethods) ?? accounts[0]?.method.id }
    : source
  return { store, accounts, pockets, effective }
}
