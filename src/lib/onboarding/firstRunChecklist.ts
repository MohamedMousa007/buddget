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
  /**
   * How many entries back this item. Used by the dashboard card to show
   * "N added · tap to add more" under a done row so users know the data
   * landed and they can still extend it. 0 before any add; budget is 0|1.
   */
  count: number
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
 *   - payments  → user added their own payment method (anything whose id isn't
 *                 the bundled default `pm_default_cash`). Cash-only users can
 *                 still tick it by renaming or re-adding the default with a
 *                 custom name; we don't force anyone to invent a card.
 */

const DEFAULT_CASH_ID = 'pm_default_cash'
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
    const userPayments = paymentMethods.filter((pm) => pm.id !== DEFAULT_CASH_ID)

    const items: FirstRunChecklistItem[] = [
      { id: 'income', done: hasIncome, enabled: true, hasOptOut: false, count: incomeSources.length },
      {
        id: 'budget',
        done: hasAnyPlan,
        enabled: hasIncome,
        hasOptOut: false,
        count: hasAnyPlan ? 1 : 0,
      },
      {
        id: 'debts',
        done: hasDebtsHandled,
        enabled: true,
        hasOptOut: true,
        count: debts.length,
      },
      {
        id: 'payments',
        done: userPayments.length > 0,
        enabled: true,
        hasOptOut: false,
        count: userPayments.length,
      },
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
