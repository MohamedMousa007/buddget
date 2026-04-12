'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AppSettings, BudgetPlanCategory, BudgetPlanSubcategory, Currency } from '@/lib/store/types'
import { effectivePlanCategoryAmount, isSavingsPlanCategory } from '@/lib/budget/budgetPlans'
import type { BudgetPlannerCategoryRowLabels } from '@/components/features/budget-planner/budgetPlannerCategoryLabels'
import { BudgetPlannerCategoryRowHeader } from '@/components/features/budget-planner/BudgetPlannerCategoryRowHeader'
import { BudgetPlannerCategorySubcategoriesPanel } from '@/components/features/budget-planner/BudgetPlannerCategorySubcategoriesPanel'

export type { BudgetPlannerCategoryRowLabels } from '@/components/features/budget-planner/budgetPlannerCategoryLabels'

export interface BudgetPlannerCategoryRowProps {
  category: BudgetPlanCategory
  planCategories: BudgetPlanCategory[]
  settings: AppSettings
  labels: BudgetPlannerCategoryRowLabels
  onUpdateCategory: (updates: {
    name?: string
    icon?: string
    amount?: number
    currency?: Currency
    subcategories?: BudgetPlanSubcategory[]
  }) => void
  onDeleteCategory: () => void
  onAddSubcategory: () => void
  onUpdateSubcategory: (subId: string, updates: Partial<Pick<BudgetPlanSubcategory, 'name' | 'amount' | 'icon'>>) => void
  onDeleteSubcategory: (subId: string) => void
}

/** One expandable category row with subcategory editors. */
export function BudgetPlannerCategoryRow({
  category,
  planCategories,
  settings,
  labels,
  onUpdateCategory,
  onDeleteCategory,
  onAddSubcategory,
  onUpdateSubcategory,
  onDeleteSubcategory,
}: BudgetPlannerCategoryRowProps) {
  const [open, setOpen] = useState(false)
  const hasSubs = category.subcategories.length > 0
  const effective = effectivePlanCategoryAmount(category)

  const [amountFocused, setAmountFocused] = useState(false)
  const [amountStr, setAmountStr] = useState('')

  const displayAmountParent = hasSubs
    ? effective === 0
      ? ''
      : String(effective)
    : category.amount === 0
      ? ''
      : String(category.amount)

  const categoryAmountInputValue = !hasSubs && amountFocused ? amountStr : displayAmountParent

  const focusCategoryAmount = () => {
    if (hasSubs) return
    setAmountFocused(true)
    setAmountStr(category.amount === 0 ? '' : String(category.amount))
  }

  const blurCategoryAmount = () => {
    if (hasSubs) return
    const raw = amountStr.trim()
    const n = raw === '' ? 0 : Math.max(0, parseFloat(raw) || 0)
    onUpdateCategory({ amount: n })
    setAmountFocused(false)
    setAmountStr('')
  }

  const savingsRow = isSavingsPlanCategory(category)

  return (
    <div
      className={`rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 overflow-hidden ${
        savingsRow ? 'border-l-[3px] border-l-[var(--color-brand-green)]' : ''
      }`}
    >
      <BudgetPlannerCategoryRowHeader
        category={category}
        planCategories={planCategories}
        settings={settings}
        labels={labels}
        open={open}
        onToggleOpen={() => setOpen((o) => !o)}
        hasSubs={hasSubs}
        categoryAmountInputValue={categoryAmountInputValue}
        onAmountChange={setAmountStr}
        onAmountFocus={focusCategoryAmount}
        onAmountBlur={blurCategoryAmount}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
        savingsAllocationBadge={labels.savingsAllocationBadge}
        showSavingsBadge={savingsRow}
      />
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[var(--color-brand-border)]/80"
          >
            <BudgetPlannerCategorySubcategoriesPanel
              category={category}
              labels={labels}
              onAddSubcategory={onAddSubcategory}
              onUpdateSubcategory={onUpdateSubcategory}
              onDeleteSubcategory={onDeleteSubcategory}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
