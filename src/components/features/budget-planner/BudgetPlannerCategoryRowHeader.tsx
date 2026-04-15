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
  savingsAllocationBadge: string
  showSavingsBadge: boolean
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
  savingsAllocationBadge,
  showSavingsBadge,
}: BudgetPlannerCategoryRowHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3">
      <button
        type="button"
        onClick={onToggleOpen}
        className="cursor-pointer inline-flex shrink-0 items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)]"
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
      {showSavingsBadge ? (
        <span className="shrink-0 rounded-md bg-[var(--color-brand-green)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand-green)]">
          {savingsAllocationBadge}
        </span>
      ) : null}
      <div className="order-last flex basis-full items-center justify-end gap-1 sm:order-none sm:ms-auto sm:basis-auto">
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
      </div>
      <button
        type="button"
        onClick={onDeleteCategory}
        className="cursor-pointer inline-flex shrink-0 items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)]"
        aria-label={labels.delete}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
