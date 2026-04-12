'use client'

import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import type { AppSettings, BudgetPlanCategory, Currency } from '@/lib/store/types'
import { BudgetPlannerCategoryNameBlock } from '@/components/features/budget-planner/BudgetPlannerCategoryNameBlock'
import { BudgetPlannerCategoryCurrencyAmountField } from '@/components/features/budget-planner/BudgetPlannerCategoryCurrencyAmountField'
import type { BudgetPlannerCategoryRowLabels } from '@/components/features/budget-planner/budgetPlannerCategoryLabels'

export interface BudgetPlannerCategoryRowHeaderProps {
  category: BudgetPlanCategory
  planCategories: BudgetPlanCategory[]
  settings: AppSettings
  labels: BudgetPlannerCategoryRowLabels
  open: boolean
  onToggleOpen: () => void
  hasSubs: boolean
  categoryAmountInputValue: string
  onAmountChange: (value: string) => void
  onAmountFocus: () => void
  onAmountBlur: () => void
  onUpdateCategory: (updates: {
    name?: string
    icon?: string
    amount?: number
    currency?: Currency
  }) => void
  onDeleteCategory: () => void
}

/**
 * Collapse toggle, icon/name controls, currency + amount, and delete for one budget category.
 */
export function BudgetPlannerCategoryRowHeader({
  category,
  planCategories,
  settings,
  labels,
  open,
  onToggleOpen,
  hasSubs,
  categoryAmountInputValue,
  onAmountChange,
  onAmountFocus,
  onAmountBlur,
  onUpdateCategory,
  onDeleteCategory,
}: BudgetPlannerCategoryRowHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3">
      <button
        type="button"
        onClick={onToggleOpen}
        className="cursor-pointer p-1 rounded-lg text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)]"
        aria-expanded={open}
        aria-label={labels.expandCategory}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      <BudgetPlannerCategoryNameBlock
        category={category}
        planCategories={planCategories}
        labels={labels}
        onUpdateCategory={onUpdateCategory}
      />
      <BudgetPlannerCategoryCurrencyAmountField
        category={category}
        settings={settings}
        hasSubs={hasSubs}
        amountLabel={labels.amount}
        amountPlaceholder={labels.amountPlaceholder}
        categoryAmountInputValue={categoryAmountInputValue}
        onAmountChange={onAmountChange}
        onAmountFocus={onAmountFocus}
        onAmountBlur={onAmountBlur}
        onCurrencyChange={(currency) => onUpdateCategory({ currency })}
      />
      <button
        type="button"
        onClick={onDeleteCategory}
        className="cursor-pointer p-2 rounded-lg text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)]"
        aria-label={labels.delete}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
