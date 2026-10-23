'use client'

import { countedDebtPayments, countedDebts } from '@/lib/spending/exclusion'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { computeMonthlyStats } from '@/lib/utils/monthlyStats'
import { isSupabaseConfigured } from '@/lib/supabase/env'

function supabaseAuthConfigured(): boolean {
  return Boolean(
    isSupabaseConfigured()
  )
}

export function useMonthlyStats() {
  const { session } = useAuth()
  const trustLocalFinance = !supabaseAuthConfigured() || session != null

  const {
    expenses,
    incomeSources,
    incomeEvents,
    budgetCategories,
    budgetPlans,
    budgetPlanActivations,
    activeBudgetPlanId,
    savingsHoldings,
    savingsAccounts,
    savingsTransactions,
    debts,
    debtPayments,
    settings,
    exchangeRates,
    goldPricePerGram,
    goldPriceAvailable,
  } = useFinanceStore(
    useShallow((s) => ({
      expenses: s.expenses,
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      budgetCategories: s.budgetCategories,
      budgetPlans: s.budgetPlans,
      budgetPlanActivations: s.budgetPlanActivations,
      activeBudgetPlanId: s.activeBudgetPlanId,
      savingsHoldings: s.savingsHoldings,
      savingsAccounts: s.savingsAccounts,
      savingsTransactions: s.savingsTransactions,
      debts: countedDebts(s.debts, s.paymentMethods),
      debtPayments: countedDebtPayments(s.debtPayments, s.debts, s.paymentMethods),
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
      goldPriceAvailable: s.goldPriceAvailable,
    }))
  )

  const { monthFilter } = useSettingsStore()

  return useMemo(
    () =>
      computeMonthlyStats({
        expenses,
        incomeSources,
        incomeEvents,
        budgetCategories,
        budgetPlans,
        budgetPlanActivations,
        activeBudgetPlanId,
        savingsHoldings,
        savingsAccounts,
        savingsTransactions,
        debts,
        debtPayments,
        settings,
        exchangeRates,
        goldPricePerGram,
        goldPriceAvailable,
        monthFilter,
        trustLocalFinance,
      }),
    [expenses, incomeSources, incomeEvents, budgetCategories, budgetPlans, budgetPlanActivations, activeBudgetPlanId, savingsHoldings, savingsAccounts, savingsTransactions, debts, debtPayments, settings, exchangeRates, goldPricePerGram, goldPriceAvailable, monthFilter, trustLocalFinance],
  )
}

export const INCOME_BLOCKED_HINT =
  'Add at least one income source under Income for these totals to update.'
