'use client'

import type { BudgetCategory } from '@/lib/store/types'
import { CategoryBarExpenseRows } from '@/components/dashboard/CategoryBarExpenseRows'

export interface CategoryBarSpendingBlockProps {
  budgetCategories: BudgetCategory[]
  categorySpending: Record<string, number>
  categoryBudgetCaps: Record<string, number>
  currency: string
}

/** Category breakdown list for the home dashboard card (no tabs). */
export function CategoryBarSpendingBlock({
  budgetCategories,
  categorySpending,
  categoryBudgetCaps,
  currency,
}: CategoryBarSpendingBlockProps) {
  return (
    <CategoryBarExpenseRows
      budgetCategories={budgetCategories}
      categorySpending={categorySpending}
      categoryBudgetCaps={categoryBudgetCaps}
      currency={currency}
    />
  )
}
