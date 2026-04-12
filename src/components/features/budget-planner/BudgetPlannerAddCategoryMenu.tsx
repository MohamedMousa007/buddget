'use client'

import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
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
  categoryNameExample: string
  emojiPickerLabel: string
}

export interface BudgetPlannerAddCategoryMenuProps {
  categories: BudgetPlanCategory[]
  onSelectPreset: (preset: BudgetPlannerPresetCategory) => void
  onAddCustom: (name: string, icon: string) => void
  labels: BudgetPlannerAddCategoryMenuLabels
}

/** Popover: search + predefined categories + custom form at bottom. */
export function BudgetPlannerAddCategoryMenu({
  categories,
  onSelectPreset,
  onAddCustom,
  labels,
}: BudgetPlannerAddCategoryMenuProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [customNameOverride, setCustomNameOverride] = useState<string | null>(null)
  const [customIcon, setCustomIcon] = useState('📦')
  const customName = customNameOverride ?? searchQuery

  const taken = useMemo(() => {
    const s = new Set(categories.map((c) => c.name.trim().toLowerCase()))
    return s
  }, [categories])

  const filteredPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return PREDEFINED_BUDGET_CATEGORIES
    return PREDEFINED_BUDGET_CATEGORIES.filter((p) => p.label.toLowerCase().includes(q))
  }, [searchQuery])

  const handlePreset = (p: BudgetPlannerPresetCategory) => {
    if (taken.has(p.label.trim().toLowerCase())) return
    onSelectPreset(p)
    setSearchQuery('')
    setOpen(false)
  }

  const handleCustomAdd = () => {
    const name = customName.trim()
    if (!name || categoryNameAlreadyInPlan(name, categories)) return
    onAddCustom(name, customIcon.trim() || '📦')
    setCustomNameOverride(null)
    setCustomIcon('📦')
    setSearchQuery('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearchQuery('') }}>
      <PopoverTrigger
        type="button"
        data-add-category-trigger
        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-brand-red)] hover:bg-[var(--color-brand-elevated)] transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        {labels.addCategory}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(70vh,28rem)] w-[min(100vw-2rem,22rem)] overflow-y-auto border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-0 text-[var(--color-brand-text-primary)] shadow-xl"
      >
        <p className="border-b border-[var(--color-brand-border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
          {labels.chooseCategoryTitle}
        </p>

        <div className="px-3 pt-2 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-brand-text-muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCustomNameOverride(null)
              }}
              placeholder="Search categories..."
              className="w-full rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] pl-8 pr-3 py-1.5 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-red)]/40"
              autoFocus
            />
          </div>
        </div>

        <ul className="max-h-52 overflow-y-auto py-1">
          {filteredPresets.length === 0 ? (
            <li className="px-3 py-3 text-xs text-[var(--color-brand-text-muted)] text-center">
              No matching categories — add a custom one below
            </li>
          ) : (
            filteredPresets.map((p) => {
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
            })
          )}
        </ul>
        <div className="border-t border-[var(--color-brand-border)] p-3 space-y-2">
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
              onChange={(e) => setCustomNameOverride(e.target.value)}
              placeholder={labels.categoryNameExample}
              className="min-w-0 flex-1 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2 py-1.5 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
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
