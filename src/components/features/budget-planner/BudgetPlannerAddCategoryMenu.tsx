'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  PREDEFINED_BUDGET_CATEGORIES,
  categoryNameAlreadyInPlan,
  type BudgetPlannerPresetCategory,
} from '@/lib/budget/budgetPlannerPresets'
import { BudgetPlannerEmojiPicker } from '@/components/features/budget-planner/BudgetPlannerEmojiPicker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { BudgetPlanCategory } from '@/lib/store/types'

export interface BudgetPlannerAddCategoryMenuLabels {
  addCategory: string
  chooseCategoryTitle: string
  customCategoryOption: string
  addCustomCategory: string
  categoryNamePlaceholder: string
  emojiPickerLabel: string
}

export interface BudgetPlannerAddCategoryMenuProps {
  categories: BudgetPlanCategory[]
  onSelectPreset: (preset: BudgetPlannerPresetCategory) => void
  onAddCustom: (name: string, icon: string) => void
  labels: BudgetPlannerAddCategoryMenuLabels
}

/** Popover: predefined categories (hide taken) + custom form at bottom. */
export function BudgetPlannerAddCategoryMenu({
  categories,
  onSelectPreset,
  onAddCustom,
  labels,
}: BudgetPlannerAddCategoryMenuProps) {
  const [open, setOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customIcon, setCustomIcon] = useState('📦')

  const taken = useMemo(() => {
    const s = new Set(categories.map((c) => c.name.trim().toLowerCase()))
    return s
  }, [categories])

  const handlePreset = (p: BudgetPlannerPresetCategory) => {
    if (taken.has(p.label.trim().toLowerCase())) return
    onSelectPreset(p)
    setOpen(false)
  }

  const handleCustomAdd = () => {
    const name = customName.trim()
    if (!name || categoryNameAlreadyInPlan(name, categories)) return
    onAddCustom(name, customIcon.trim() || '📦')
    setCustomName('')
    setCustomIcon('📦')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className="text-xs font-medium text-[var(--color-brand-red)] hover:underline"
      >
        + {labels.addCategory}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(70vh,28rem)] w-[min(100vw-2rem,22rem)] overflow-y-auto border border-[var(--color-brand-border)] bg-[#111118] p-0 text-white shadow-xl"
      >
        <p className="border-b border-[#2A2A38] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
          {labels.chooseCategoryTitle}
        </p>
        <ul className="max-h-52 overflow-y-auto py-1">
          {PREDEFINED_BUDGET_CATEGORIES.map((p) => {
            const disabled = taken.has(p.label.trim().toLowerCase())
            return (
              <li key={p.label}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handlePreset(p)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                    disabled
                      ? 'cursor-not-allowed text-[var(--color-brand-text-muted)] opacity-45'
                      : 'hover:bg-[var(--color-brand-elevated)]'
                  )}
                >
                  <span className="text-lg" aria-hidden>
                    {p.icon}
                  </span>
                  <span>{p.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="border-t border-[#2A2A38] p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            {labels.customCategoryOption}
          </p>
          <div className="flex items-center gap-2">
            <BudgetPlannerEmojiPicker
              value={customIcon}
              onChange={setCustomIcon}
              ariaLabel={labels.emojiPickerLabel}
            />
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={labels.categoryNamePlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-2 py-1.5 text-sm text-white placeholder:text-[var(--color-brand-text-muted)]"
            />
          </div>
          <button
            type="button"
            onClick={handleCustomAdd}
            disabled={!customName.trim() || categoryNameAlreadyInPlan(customName.trim(), categories)}
            className="w-full rounded-xl bg-[var(--color-brand-red)] py-2 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40"
          >
            {labels.addCustomCategory}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
