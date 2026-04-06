'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { BudgetPlanSubcategory } from '@/lib/store/types'
import { BudgetPlannerEmojiPicker } from '@/components/features/budget-planner/BudgetPlannerEmojiPicker'
import type { BudgetPlannerCategoryRowLabels } from '@/components/features/budget-planner/budgetPlannerCategoryLabels'

export interface BudgetPlannerSubcategoryRowProps {
  sub: BudgetPlanSubcategory
  labels: BudgetPlannerCategoryRowLabels
  onUpdate: (u: Partial<Pick<BudgetPlanSubcategory, 'name' | 'amount' | 'icon'>>) => void
  onDelete: () => void
}

/**
 * Single subcategory line: emoji, name, amount, delete.
 */
export function BudgetPlannerSubcategoryRow({ sub, labels, onUpdate, onDelete }: BudgetPlannerSubcategoryRowProps) {
  const [amountFocused, setAmountFocused] = useState(false)
  const [amountStr, setAmountStr] = useState('')

  const displayAmount = amountFocused ? amountStr : sub.amount === 0 ? '' : String(sub.amount)

  const focusAmount = () => {
    setAmountFocused(true)
    setAmountStr(sub.amount === 0 ? '' : String(sub.amount))
  }

  const blurAmount = () => {
    const raw = amountStr.trim()
    const n = raw === '' ? 0 : Math.max(0, parseFloat(raw) || 0)
    onUpdate({ amount: n })
    setAmountFocused(false)
    setAmountStr('')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <BudgetPlannerEmojiPicker
        value={sub.icon ?? '📦'}
        onChange={(emoji) => onUpdate({ icon: emoji })}
        ariaLabel={labels.emojiPickerLabel}
      />
      <input
        value={sub.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        placeholder={labels.subcategoryNamePlaceholder}
        className="flex-1 min-w-[100px] rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-2 py-1 text-xs text-white placeholder:text-[var(--color-brand-text-muted)]"
      />
      <input
        type="text"
        inputMode="decimal"
        value={displayAmount}
        onChange={(e) => setAmountStr(e.target.value)}
        onFocus={focusAmount}
        onBlur={blurAmount}
        placeholder={labels.amountPlaceholder}
        className="w-24 rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-2 py-1 text-xs text-white font-mono-numbers placeholder:text-[var(--color-brand-text-muted)]"
      />
      <button
        type="button"
        onClick={onDelete}
        className="p-1 text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)]"
        aria-label={labels.delete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
