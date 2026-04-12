'use client'

import type { BudgetPlanCategory, BudgetPlanSubcategory } from '@/lib/store/types'
import type { BudgetPlannerCategoryRowLabels } from '@/components/features/budget-planner/budgetPlannerCategoryLabels'
import { BudgetPlannerSubcategoryRow } from '@/components/features/budget-planner/BudgetPlannerSubcategoryRow'

export interface BudgetPlannerCategorySubcategoriesPanelProps {
  category: BudgetPlanCategory
  labels: BudgetPlannerCategoryRowLabels
  onAddSubcategory: () => void
  onUpdateSubcategory: (subId: string, updates: Partial<Pick<BudgetPlanSubcategory, 'name' | 'amount' | 'icon'>>) => void
  onDeleteSubcategory: (subId: string) => void
}

/**
 * Subcategory list + add control (wrap with `motion.div` + `AnimatePresence` in the parent).
 */
export function BudgetPlannerCategorySubcategoriesPanel({
  category,
  labels,
  onAddSubcategory,
  onUpdateSubcategory,
  onDeleteSubcategory,
}: BudgetPlannerCategorySubcategoriesPanelProps) {
  return (
    <div className="p-3 pl-11 space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-muted)]">
        {labels.subcategories}
      </p>
      {category.subcategories.map((sub) => (
        <BudgetPlannerSubcategoryRow
          key={sub.id}
          sub={sub}
          labels={labels}
          onUpdate={(u) => onUpdateSubcategory(sub.id, u)}
          onDelete={() => onDeleteSubcategory(sub.id)}
        />
      ))}
      <button
        type="button"
        onClick={onAddSubcategory}
        className="text-xs text-[var(--color-brand-red)] hover:underline"
      >
        + {labels.addSubcategory}
      </button>
    </div>
  )
}
