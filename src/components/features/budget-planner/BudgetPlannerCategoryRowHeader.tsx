'use client'

import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BudgetPlanCategory } from '@/lib/store/types'
import { BudgetPlannerEmojiPicker } from '@/components/features/budget-planner/BudgetPlannerEmojiPicker'
import type { BudgetPlannerCategoryRowLabels } from '@/components/features/budget-planner/budgetPlannerCategoryLabels'

export interface BudgetPlannerCategoryRowHeaderProps {
  category: BudgetPlanCategory
  labels: BudgetPlannerCategoryRowLabels
  open: boolean
  onToggleOpen: () => void
  isPredefined: boolean
  hasSubs: boolean
  categoryAmountInputValue: string
  onAmountChange: (value: string) => void
  onAmountFocus: () => void
  onAmountBlur: () => void
  onUpdateCategory: (updates: { name?: string; icon?: string; amount?: number }) => void
  onDeleteCategory: () => void
}

/**
 * Collapse toggle, icon/name fields, amount, and delete for one budget category.
 */
export function BudgetPlannerCategoryRowHeader({
  category,
  labels,
  open,
  onToggleOpen,
  isPredefined,
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
        className="p-1 rounded-lg text-[var(--color-brand-text-muted)] hover:text-white"
        aria-expanded={open}
        aria-label={labels.expandCategory}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {isPredefined ? (
        <span
          className="flex h-9 w-10 shrink-0 items-center justify-center rounded-lg border border-[#2A2A38] bg-[#1A1A24] text-lg"
          aria-hidden
        >
          {category.icon}
        </span>
      ) : (
        <BudgetPlannerEmojiPicker
          value={category.icon}
          onChange={(emoji) => onUpdateCategory({ icon: emoji })}
          ariaLabel={labels.emojiPickerLabel}
        />
      )}
      {isPredefined ? (
        <input
          value={category.name}
          readOnly
          placeholder={labels.categoryNamePlaceholder}
          className="flex-1 min-w-[120px] rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-2 py-1.5 text-sm text-white opacity-80 cursor-default placeholder:text-[var(--color-brand-text-muted)]"
        />
      ) : (
        <input
          value={category.name}
          onChange={(e) => onUpdateCategory({ name: e.target.value })}
          placeholder={labels.categoryNameExample}
          className="flex-1 min-w-[120px] rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-2 py-1.5 text-sm text-white placeholder:text-[var(--color-brand-text-muted)]"
        />
      )}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase text-[var(--color-brand-text-muted)]">{labels.amount}</span>
        <input
          type="text"
          inputMode="decimal"
          disabled={hasSubs}
          value={categoryAmountInputValue}
          onChange={(e) => !hasSubs && onAmountChange(e.target.value)}
          onFocus={onAmountFocus}
          onBlur={onAmountBlur}
          placeholder={labels.amountPlaceholder}
          readOnly={hasSubs}
          className={cn(
            'w-24 rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-2 py-1.5 text-sm text-white font-mono-numbers placeholder:text-[var(--color-brand-text-muted)]',
            hasSubs && 'opacity-60 cursor-not-allowed'
          )}
        />
      </div>
      <button
        type="button"
        onClick={onDeleteCategory}
        className="p-2 rounded-lg text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)]"
        aria-label={labels.delete}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
