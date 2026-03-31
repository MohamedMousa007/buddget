'use client'

import type { BudgetPlanCategory, BudgetPlanSubcategory } from '@/lib/store/types'
import { BudgetPlannerCategoryRow } from '@/components/features/budget-planner/BudgetPlannerCategoryRow'

export interface BudgetPlannerCategoriesProps {
  categories: BudgetPlanCategory[]
  labels: {
    categoriesTitle: string
    addCategory: string
    subcategories: string
    addSubcategory: string
    amount: string
    delete: string
    expandCategory: string
    newCategoryName: string
    iconPlaceholder: string
  }
  onUpdateCategory: (
    categoryId: string,
    updates: Partial<Omit<BudgetPlanCategory, 'id' | 'subcategories'>> & {
      subcategories?: BudgetPlanSubcategory[]
    }
  ) => void
  onDeleteCategory: (categoryId: string) => void
  onAddSubcategory: (categoryId: string) => void
  onUpdateSubcategory: (
    categoryId: string,
    subId: string,
    updates: Partial<Pick<BudgetPlanSubcategory, 'name' | 'amount'>>
  ) => void
  onDeleteSubcategory: (categoryId: string, subId: string) => void
  onAddCategory: () => void
}

/** List of plan categories + add button. */
export function BudgetPlannerCategories({
  categories,
  labels,
  onUpdateCategory,
  onDeleteCategory,
  onAddSubcategory,
  onUpdateSubcategory,
  onDeleteSubcategory,
  onAddCategory,
}: BudgetPlannerCategoriesProps) {
  return (
    <div className="bg-[#111118] border border-[#2A2A38] rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {labels.categoriesTitle}
        </h2>
        <button
          type="button"
          onClick={onAddCategory}
          className="text-xs font-medium text-[var(--color-brand-red)] hover:underline"
        >
          + {labels.addCategory}
        </button>
      </div>
      <div className="space-y-2">
        {categories.map((c) => (
          <BudgetPlannerCategoryRow
            key={c.id}
            category={c}
            labels={labels}
            onUpdateCategory={(u) => onUpdateCategory(c.id, u)}
            onDeleteCategory={() => onDeleteCategory(c.id)}
            onAddSubcategory={() => onAddSubcategory(c.id)}
            onUpdateSubcategory={(subId, u) => onUpdateSubcategory(c.id, subId, u)}
            onDeleteSubcategory={(subId) => onDeleteSubcategory(c.id, subId)}
          />
        ))}
      </div>
    </div>
  )
}
