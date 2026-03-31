'use client'

import { useT } from '@/lib/i18n'
import type { BudgetCategory } from '@/lib/store/types'
import { CategoryBarSpendingBlock } from '@/components/dashboard/CategoryBarSpendingBlock'

interface CategoryBarProps {
  budgetCategories: BudgetCategory[]
  categorySpending: Record<string, number>
  categoryBudgetCaps: Record<string, number>
  currency: string
  incomeBlockedNote?: string | null
}

/**
 * Home “Where Your Money Goes” card: flat list of category rows with spent vs budget bars.
 */
export function CategoryBar({
  budgetCategories,
  categorySpending,
  categoryBudgetCaps,
  currency,
  incomeBlockedNote,
}: CategoryBarProps) {
  const t = useT()

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      {incomeBlockedNote ? (
        <p className="text-[11px] text-amber-200/90 leading-snug">{incomeBlockedNote}</p>
      ) : null}
      <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
        {t.dashboard.categoryTitle}
      </h3>

      <CategoryBarSpendingBlock
        budgetCategories={budgetCategories}
        categorySpending={categorySpending}
        categoryBudgetCaps={categoryBudgetCaps}
        currency={currency}
      />
    </div>
  )
}
