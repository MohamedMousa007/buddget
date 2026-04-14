'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { calculateDebtRemaining, calculateDebtRemainingInBaseCurrency } from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import type { Goal } from '@/lib/store/types'

/** For debt_freedom goals: total remaining linked debt converted to the goal currency. */
export function useDebtRemainingForGoal(goal: Goal): number | null {
  const { debts, debtPayments, expenses, exchangeRates, goldPricePerGram, goldPriceAvailable, settings } =
    useFinanceStore(
      useShallow((s) => ({
        debts: s.debts,
        debtPayments: s.debtPayments,
        expenses: s.expenses,
        exchangeRates: s.exchangeRates,
        goldPricePerGram: s.goldPricePerGram,
        goldPriceAvailable: s.goldPriceAvailable,
        settings: s.settings,
      }))
    )

  return useMemo(() => {
    if (goal.category !== 'debt_freedom') return null
    const linked = debts.filter((d) => goal.linkedDebtIds.includes(d.id))
    if (linked.length === 0) return null
    const balanceCtx = { expenses, exchangeRates, allDebts: debts }
    let sumBase = 0
    for (const d of linked) {
      const rem = calculateDebtRemaining(d, debtPayments, balanceCtx)
      sumBase += calculateDebtRemainingInBaseCurrency(
        rem,
        d,
        settings.baseCurrency,
        exchangeRates,
        goldPricePerGram,
        goldPriceAvailable
      )
    }
    return convertCurrency(sumBase, settings.baseCurrency, goal.currency, exchangeRates)
  }, [
    goal.category,
    goal.currency,
    goal.linkedDebtIds,
    debts,
    debtPayments,
    expenses,
    exchangeRates,
    goldPricePerGram,
    goldPriceAvailable,
    settings.baseCurrency,
  ])
}
