'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

export type FirstRunChecklistItemId =
  | 'income'
  | 'payments'
  | 'debts'
  | 'goals'
  | 'lifestyle'
  | 'household'

export interface FirstRunChecklistItem {
  id: FirstRunChecklistItemId
  /** True when the user has satisfied the item (or explicitly opted out). */
  done: boolean
  /** False when a prerequisite is missing. Not currently used — all six items
   *  are independent — but kept for forward compatibility. */
  enabled: boolean
  /** Present only for items that support "I have none" / explicit opt-out. */
  hasOptOut: boolean
  /**
   * How many entries back this item (incomeSources.length etc.). Drives the
   * "N added · tap to add more" subtext and lets callers decide when to gate
   * downstream actions like Build My Budget.
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
 * global banner. Six items — three data-collection (income, payments, debts)
 * and three context-collection (goals, lifestyle, household). Completing all
 * six unlocks the "Build My Budget" CTA that fires the AI pipeline once.
 *
 * Done rules:
 *   - income     → ≥1 IncomeSource
 *   - payments   → user added their own method (id ≠ pm_default_cash)
 *   - debts      → debts.length > 0 OR profile.noDebtsDeclared
 *   - goals      → goals.length > 0 OR profile.noGoalsDeclared
 *   - lifestyle  → all three signals filled (food + transport + tier)
 *   - household  → household set AND monthlyRent !== null
 */

const DEFAULT_CASH_ID = 'pm_default_cash'

export function useFirstRunChecklist(): FirstRunChecklistSnapshot {
  const snap = useFinanceStore(
    useShallow((s) => ({
      incomeCount: s.incomeSources.length,
      paymentCount: s.paymentMethods.filter((pm) => pm.id !== DEFAULT_CASH_ID).length,
      debtCount: s.debts.length,
      noDebtsDeclared: s.profile.noDebtsDeclared === true,
      goalCount: s.goals.length,
      noGoalsDeclared: s.profile.noGoalsDeclared === true,
      food: s.profile.foodFrequency,
      transport: s.profile.transportMode,
      tier: s.profile.lifestyleTier,
      household: s.profile.household,
      monthlyRent: s.profile.monthlyRent,
      hidden: s.settings.onboardingChecklistHidden,
    })),
  )

  return useMemo<FirstRunChecklistSnapshot>(() => {
    const lifestyleDone = !!(snap.food && snap.transport && snap.tier)
    const householdDone = !!(snap.household && snap.monthlyRent !== null && snap.monthlyRent !== undefined)

    const items: FirstRunChecklistItem[] = [
      { id: 'income', done: snap.incomeCount > 0, enabled: true, hasOptOut: false, count: snap.incomeCount },
      { id: 'payments', done: snap.paymentCount > 0, enabled: true, hasOptOut: false, count: snap.paymentCount },
      {
        id: 'debts',
        done: snap.debtCount > 0 || snap.noDebtsDeclared,
        enabled: true,
        hasOptOut: true,
        count: snap.debtCount,
      },
      {
        id: 'goals',
        done: snap.goalCount > 0 || snap.noGoalsDeclared,
        enabled: true,
        hasOptOut: true,
        count: snap.goalCount,
      },
      { id: 'lifestyle', done: lifestyleDone, enabled: true, hasOptOut: false, count: lifestyleDone ? 1 : 0 },
      { id: 'household', done: householdDone, enabled: true, hasOptOut: false, count: householdDone ? 1 : 0 },
    ]
    const doneCount = items.filter((i) => i.done).length
    return {
      items,
      doneCount,
      totalCount: items.length,
      allDone: doneCount === items.length,
      hidden: snap.hidden,
    }
  }, [snap])
}
