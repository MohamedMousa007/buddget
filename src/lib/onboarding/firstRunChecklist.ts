'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

export type FirstRunChecklistItemId = 'income' | 'budget' | 'debts' | 'payments'

export interface FirstRunChecklistItem {
  id: FirstRunChecklistItemId
  /** True when the user has satisfied the item (or explicitly opted out). */
  done: boolean
  /** False when a prerequisite is missing (e.g. budget before income). */
  enabled: boolean
  /** Present only for items that support "I have none" / explicit opt-out. */
  hasOptOut: boolean
}

export interface FirstRunChecklistSnapshot {
  items: FirstRunChecklistItem[]
  doneCount: number
  totalCount: number
  allDone: boolean
  /** Mirror of `settings.onboardingChecklistHidden`. */
  hidden: boolean
}

/**
 * Single source of truth for the dashboard first-run checklist + the slim
 * global banner. Both render the same items against the same "done" logic so
 * completion can't drift between surfaces.
 *
 * Done rules:
 *   - income    → at least one `IncomeSource`
 *   - budget    → active plan (or any plan) has ≥1 category. Requires income.
 *   - debts     → `debts.length > 0` OR `profile.noDebtsDeclared`. Always enabled.
 *   - payments  → user has a non-Cash payment method. The default Cash row
 *                 doesn't count — otherwise every fresh install would start
 *                 pre-ticked.
 */
export function useFirstRunChecklist(): FirstRunChecklistSnapshot {
  const {
    incomeSources,
    budgetPlans,
    debts,
    noDebtsDeclared,
    paymentMethods,
    hidden,
  } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      budgetPlans: s.budgetPlans,
      debts: s.debts,
      noDebtsDeclared: s.profile.noDebtsDeclared === true,
      paymentMethods: s.paymentMethods,
      hidden: s.settings.onboardingChecklistHidden,
    })),
  )

  return useMemo<FirstRunChecklistSnapshot>(() => {
    const hasIncome = incomeSources.length > 0
    const hasAnyPlan = budgetPlans.some((p) => p.categories.length > 0)
    const hasDebtsHandled = debts.length > 0 || noDebtsDeclared
    const hasRealPayment = paymentMethods.some((pm) => pm.type !== 'cash')

    const items: FirstRunChecklistItem[] = [
      { id: 'income', done: hasIncome, enabled: true, hasOptOut: false },
      { id: 'budget', done: hasAnyPlan, enabled: hasIncome, hasOptOut: false },
      { id: 'debts', done: hasDebtsHandled, enabled: true, hasOptOut: true },
      { id: 'payments', done: hasRealPayment, enabled: true, hasOptOut: false },
    ]
    const doneCount = items.filter((i) => i.done).length
    return {
      items,
      doneCount,
      totalCount: items.length,
      allDone: doneCount === items.length,
      hidden,
    }
  }, [incomeSources, budgetPlans, debts, noDebtsDeclared, paymentMethods, hidden])
}
