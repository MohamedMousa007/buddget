'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { BudgetPlanCategory, BudgetPlanSubcategory } from '@/lib/store/types'
import { effectivePlanCategoryAmount } from '@/lib/budget/budgetPlans'

export interface BudgetPlannerCategoryRowProps {
  category: BudgetPlanCategory
  labels: {
    subcategories: string
    addSubcategory: string
    amount: string
    delete: string
    expandCategory: string
    newCategoryName: string
    iconPlaceholder: string
  }
  onUpdateCategory: (updates: {
    name?: string
    icon?: string
    amount?: number
    subcategories?: BudgetPlanSubcategory[]
  }) => void
  onDeleteCategory: () => void
  onAddSubcategory: () => void
  onUpdateSubcategory: (subId: string, updates: Partial<Pick<BudgetPlanSubcategory, 'name' | 'amount'>>) => void
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
        <input
          value={category.icon}
          onChange={(e) => onUpdateCategory({ icon: e.target.value })}
          className="w-10 rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-1 py-1.5 text-center text-sm text-white"
          aria-label={labels.iconPlaceholder}
        />
        <input
          value={category.name}
          onChange={(e) => onUpdateCategory({ name: e.target.value })}
          placeholder={labels.newCategoryName}
          className="flex-1 min-w-[120px] rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-2 py-1.5 text-sm text-white"
        />
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase text-[var(--color-brand-text-muted)]">{labels.amount}</span>
          <input
            type="number"
            min={0}
            step="0.01"
            disabled={hasSubs}
            value={hasSubs ? effective : category.amount}
            onChange={(e) => onUpdateCategory({ amount: Math.max(0, parseFloat(e.target.value) || 0) })}
            className={cn(
              'w-24 rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-2 py-1.5 text-sm text-white font-mono-numbers',
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
                <div key={sub.id} className="flex flex-wrap items-center gap-2">
                  <input
                    value={sub.name}
                    onChange={(e) => onUpdateSubcategory(sub.id, { name: e.target.value })}
                    className="flex-1 min-w-[100px] rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-2 py-1 text-xs text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={sub.amount}
                    onChange={(e) =>
                      onUpdateSubcategory(sub.id, { amount: Math.max(0, parseFloat(e.target.value) || 0) })
                    }
                    className="w-24 rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-2 py-1 text-xs text-white font-mono-numbers"
                  />
                  <button
                    type="button"
                    onClick={() => onDeleteSubcategory(sub.id)}
                    className="p-1 text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)]"
                    aria-label={labels.delete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
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
