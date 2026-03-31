'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { BudgetPlanCategory, BudgetPlanSubcategory } from '@/lib/store/types'
import { effectivePlanCategoryAmount } from '@/lib/budget/budgetPlans'
import { presetForCategoryName } from '@/lib/budget/budgetPlannerPresets'
import { BudgetPlannerEmojiPicker } from '@/components/features/budget-planner/BudgetPlannerEmojiPicker'

export interface BudgetPlannerCategoryRowLabels {
  subcategories: string
  addSubcategory: string
  amount: string
  delete: string
  expandCategory: string
  categoryNamePlaceholder: string
  subcategoryNamePlaceholder: string
  amountPlaceholder: string
  emojiPickerLabel: string
}

export interface BudgetPlannerCategoryRowProps {
  category: BudgetPlanCategory
  labels: BudgetPlannerCategoryRowLabels
  onUpdateCategory: (updates: {
    name?: string
    icon?: string
    amount?: number
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

  const preset = presetForCategoryName(category.name)
  const isPredefined = preset != null && category.icon === preset.icon

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

  return (
    <div className="rounded-xl border border-[#2A2A38] bg-[var(--color-brand-elevated)]/40 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
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
            placeholder={labels.categoryNamePlaceholder}
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
            onChange={(e) => !hasSubs && setAmountStr(e.target.value)}
            onFocus={focusCategoryAmount}
            onBlur={blurCategoryAmount}
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
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[#2A2A38]/80"
          >
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
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function BudgetPlannerSubcategoryRow({
  sub,
  labels,
  onUpdate,
  onDelete,
}: {
  sub: BudgetPlanSubcategory
  labels: BudgetPlannerCategoryRowLabels
  onUpdate: (u: Partial<Pick<BudgetPlanSubcategory, 'name' | 'amount' | 'icon'>>) => void
  onDelete: () => void
}) {
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
