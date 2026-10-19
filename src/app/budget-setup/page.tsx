'use client'

import {
  useHydrateBudget,
  useHydrateDebts,
  useHydrateExpenses,
  useHydrateGoals,
  useHydrateIncome,
  useHydrateSavings,
  useHydrateSubscriptions,
} from '@/hooks/remote'
import { BudgetPlanPage } from '@/components/features/budget/BudgetPlanPage'

/** Budget: the active plan as three chapters of seven blocks, with a This month overlay. */
export default function BudgetSetupPage() {
  useHydrateBudget()
  useHydrateIncome()
  useHydrateExpenses()
  useHydrateSubscriptions()
  useHydrateDebts()
  useHydrateGoals()
  useHydrateSavings()
  return <BudgetPlanPage ready />
}
