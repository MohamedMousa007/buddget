'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { DependencyStatus } from '@/lib/features/dependencies'

const DEFAULT_CASH_ID = 'pm_default_cash'

/**
 * Reads the finance store and returns the current dependency status for
 * feature locking. Cash payment method (default id) does NOT satisfy
 * `payment_method` — user must add their own.
 */
export function useDependencyStatus(): DependencyStatus {
  const snap = useFinanceStore(
    useShallow((s) => ({
      incomeCount: s.incomeSources.length + s.incomeEvents.length,
      activePlan: s.settings.baseCurrency, // truthy proxy; actual plan check via budgetCategories
      paymentCount: s.paymentMethods.filter((m) => m.id !== DEFAULT_CASH_ID).length,
      debtCount: s.debts.length,
      savingsCount: s.savingsAccounts.length,
      goalCount: s.goals.length,
      budgetTotal: s.budgetCategories.reduce((sum, c) => sum + c.budgetedAmount, 0),
    })),
  )

  return useMemo<DependencyStatus>(
    () => ({
      income: snap.incomeCount > 0,
      budget_plan: snap.budgetTotal > 0,
      payment_method: snap.paymentCount > 0,
      debt: snap.debtCount > 0,
      savings: snap.savingsCount > 0,
      goal: snap.goalCount > 0,
    }),
    [snap],
  )
}
