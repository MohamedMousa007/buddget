'use client'

import { useMemo } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import type { BudgetPlanCategory } from '@/lib/store/types'

export interface CategoryChipOption {
  id: string
  label: string
  icon?: string
  subcategories: { id: string; name: string; icon?: string }[]
}

/**
 * Returns the active budget plan's categories (if any) plus a
 * fallback chip list derived from the legacy `EXPENSE_ENTRY_CATEGORIES` enum.
 */
export function usePlanCategories() {
  const activePlanId = useFinanceStore((s) => s.activeBudgetPlanId)
  const plans = useFinanceStore((s) => s.budgetPlans)

  const activePlan = useMemo(
    () => (activePlanId ? plans.find((p) => p.id === activePlanId) : plans[0]) ?? null,
    [activePlanId, plans],
  )

  const planCategories: BudgetPlanCategory[] = useMemo(
    () => (activePlan !== null && activePlan.categories.length > 0 ? activePlan.categories : []),
    [activePlan],
  )

  const hasPlan = planCategories.length > 0

  const categoryChipOptions: CategoryChipOption[] = useMemo(() => {
    if (planCategories.length > 0) {
      return planCategories.map((c) => ({
        id: c.name,
        label: c.name,
        icon: c.icon,
        subcategories: c.subcategories.map((s) => ({ id: s.name, name: s.name, icon: s.icon })),
      }))
    }
    return EXPENSE_ENTRY_CATEGORIES.map((c) => ({
      id: c,
      label: c,
      subcategories: [],
    }))
  }, [planCategories])

  const defaultCategory = categoryChipOptions[0]?.id ?? 'Food'

  return { hasPlan, planCategories, categoryChipOptions, defaultCategory }
}
