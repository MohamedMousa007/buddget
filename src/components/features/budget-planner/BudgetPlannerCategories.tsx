'use client'

import type { AppSettings, BudgetPlanCategory, BudgetPlanSubcategory } from '@/lib/store/types'
import { Plus } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { useT } from '@/lib/i18n'
import { BudgetPlannerCategoryRow } from '@/components/features/budget-planner/BudgetPlannerCategoryRow'
import { BudgetPlannerAddCategoryMenu } from '@/components/features/budget-planner/BudgetPlannerAddCategoryMenu'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export interface BudgetPlannerCategoriesLabels {
  categoriesTitle: string
  addCategory: string
  chooseCategoryTitle: string
  customCategoryOption: string
  addCustomCategory: string
  editCategoryName: string
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
  savingsAllocationBadge: string
}

export interface BudgetPlannerCategoriesProps {
  planId: string
  categories: BudgetPlanCategory[]
  settings: AppSettings
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
  planId: _planId,
  categories,
  settings,
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
  const { user, openAuthModal } = useAuth()
  const supabaseConfigured = Boolean(
    isSupabaseConfigured()
  )

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
    chooseCategoryTitle: labels.chooseCategoryTitle,
    customCategoryOption: labels.customCategoryOption,
    editCategoryName: labels.editCategoryName,
    savingsAllocationBadge: labels.savingsAllocationBadge,
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

  const openAddMenu = () => {
    if (supabaseConfigured && !user) {
      openAuthModal('/budget-setup', t.modals.requireAuthBudgetSetup)
      return
    }
    const menu = document.querySelector<HTMLButtonElement>('[data-add-category-trigger]')
    menu?.click()
  }


  void _planId

  return (
    <div className="bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
            {labels.categoriesTitle}
          </h2>
        </div>
        <BudgetPlannerAddCategoryMenu
          categories={categories}
          onSelectPreset={(p) => onAddPresetCategory(p.icon, p.label)}
          onAddCustom={(name, icon) => onAddCustomCategory(name, icon)}
          labels={menuLabels}
        />
      </div>

      {categories.length === 0 ?
        <div className="rounded-xl border border-[var(--color-brand-border)] bg-gradient-to-br from-[var(--color-brand-elevated)] to-[var(--color-brand-card)] p-5 space-y-4 text-center">
          <p className="text-sm text-[var(--color-brand-text-secondary)]">
            Add categories to match your spending. Use presets or create your own.
          </p>
          <button
            type="button"
            onClick={openAddMenu}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add category
          </button>
        </div>
      : <div className="space-y-2">
          {categories.map((c) => (
            <BudgetPlannerCategoryRow
              key={c.id}
              category={c}
              planCategories={categories}
              settings={settings}
              labels={rowLabels}
              onUpdateCategory={(u) => onUpdateCategory(c.id, u)}
              onDeleteCategory={() => onDeleteCategory(c.id)}
              onAddSubcategory={() => onAddSubcategory(c.id)}
              onUpdateSubcategory={(subId, u) => onUpdateSubcategory(c.id, subId, u)}
              onDeleteSubcategory={(subId) => onDeleteSubcategory(c.id, subId)}
            />
          ))}
        </div>
      }
    </div>
  )
}
