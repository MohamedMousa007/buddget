'use client'

import type { BudgetPlanCategory, BudgetPlanSubcategory } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import { EmptyState } from '@/components/ui/EmptyState'
import { BudgetPlannerCategoryRow } from '@/components/features/budget-planner/BudgetPlannerCategoryRow'
import { BudgetPlannerAddCategoryMenu } from '@/components/features/budget-planner/BudgetPlannerAddCategoryMenu'

export interface BudgetPlannerCategoriesLabels {
  categoriesTitle: string
  addCategory: string
  chooseCategoryTitle: string
  customCategoryOption: string
  addCustomCategory: string
  subcategories: string
  addSubcategory: string
  amount: string
  delete: string
  expandCategory: string
  categoryNamePlaceholder: string
  categoryNameExample: string
  subcategoryNamePlaceholder: string
  amountPlaceholder: string
  emojiPickerLabel: string
}

export interface BudgetPlannerCategoriesProps {
  categories: BudgetPlanCategory[]
  labels: BudgetPlannerCategoriesLabels
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
    updates: Partial<Pick<BudgetPlanSubcategory, 'name' | 'amount' | 'icon'>>
  ) => void
  onDeleteSubcategory: (categoryId: string, subId: string) => void
  onAddPresetCategory: (icon: string, name: string) => void
  onAddCustomCategory: (name: string, icon: string) => void
}

/** List of plan categories + add menu (predefined or custom). */
export function BudgetPlannerCategories({
  categories,
  labels,
  onUpdateCategory,
  onDeleteCategory,
  onAddSubcategory,
  onUpdateSubcategory,
  onDeleteSubcategory,
  onAddPresetCategory,
  onAddCustomCategory,
}: BudgetPlannerCategoriesProps) {
  const t = useT()
  const rowLabels = {
    subcategories: labels.subcategories,
    addSubcategory: labels.addSubcategory,
    amount: labels.amount,
    delete: labels.delete,
    expandCategory: labels.expandCategory,
    categoryNamePlaceholder: labels.categoryNamePlaceholder,
    categoryNameExample: labels.categoryNameExample,
    subcategoryNamePlaceholder: labels.subcategoryNamePlaceholder,
    amountPlaceholder: labels.amountPlaceholder,
    emojiPickerLabel: labels.emojiPickerLabel,
  }

  const menuLabels = {
    addCategory: labels.addCategory,
    chooseCategoryTitle: labels.chooseCategoryTitle,
    customCategoryOption: labels.customCategoryOption,
    addCustomCategory: labels.addCustomCategory,
    categoryNamePlaceholder: labels.categoryNamePlaceholder,
    categoryNameExample: labels.categoryNameExample,
    emojiPickerLabel: labels.emojiPickerLabel,
  }

  return (
    <div className="bg-[#111118] border border-[#2A2A38] rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {labels.categoriesTitle}
        </h2>
        <BudgetPlannerAddCategoryMenu
          categories={categories}
          onSelectPreset={(p) => onAddPresetCategory(p.icon, p.label)}
          onAddCustom={(name, icon) => onAddCustomCategory(name, icon)}
          labels={menuLabels}
        />
      </div>
      {categories.length === 0 ? (
        <EmptyState
          icon="📊"
          title={t.budgetPlanner.categoriesEmptyTitle}
          description={t.budgetPlanner.categoriesEmptyDesc}
          className="py-10"
        />
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <BudgetPlannerCategoryRow
              key={c.id}
              category={c}
              labels={rowLabels}
              onUpdateCategory={(u) => onUpdateCategory(c.id, u)}
              onDeleteCategory={() => onDeleteCategory(c.id)}
              onAddSubcategory={() => onAddSubcategory(c.id)}
              onUpdateSubcategory={(subId, u) => onUpdateSubcategory(c.id, subId, u)}
              onDeleteSubcategory={(subId) => onDeleteSubcategory(c.id, subId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
