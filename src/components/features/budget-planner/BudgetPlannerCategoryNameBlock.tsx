'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Pencil } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { BudgetPlanCategory } from '@/lib/store/types'
import {
  PREDEFINED_BUDGET_CATEGORIES,
  isPredefinedCategoryName,
} from '@/lib/budget/budgetPlannerPresets'
import { BudgetPlannerEmojiPicker } from '@/components/features/budget-planner/BudgetPlannerEmojiPicker'
import type { BudgetPlannerCategoryRowLabels } from '@/components/features/budget-planner/budgetPlannerCategoryLabels'

function customEntriesFromPlan(planCategories: BudgetPlanCategory[], currentId: string) {
  const seen = new Set<string>()
  const out: { name: string; icon: string }[] = []
  for (const c of planCategories) {
    if (c.id === currentId) continue
    const key = c.name.trim().toLowerCase()
    if (!key || isPredefinedCategoryName(c.name)) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name: c.name.trim(), icon: c.icon })
  }
  return out
}

export interface BudgetPlannerCategoryNameBlockProps {
  category: BudgetPlanCategory
  planCategories: BudgetPlanCategory[]
  labels: BudgetPlannerCategoryRowLabels
  onUpdateCategory: (updates: { name?: string; icon?: string }) => void
}

/** Preset/custom picker plus pencil mode for free-text name and emoji. */
export function BudgetPlannerCategoryNameBlock({
  category,
  planCategories,
  labels,
  onUpdateCategory,
}: BudgetPlannerCategoryNameBlockProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [penMode, setPenMode] = useState(false)
  const [draftName, setDraftName] = useState(category.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!penMode) return
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [penMode])

  const commitPen = () => {
    const next = draftName.trim() || category.name
    if (next !== category.name) onUpdateCategory({ name: next })
    setPenMode(false)
  }

  const customs = customEntriesFromPlan(planCategories, category.id)

  const popoverItems = (
    <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto p-1">
      {PREDEFINED_BUDGET_CATEGORIES.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => {
            onUpdateCategory({ name: p.label, icon: p.icon })
            setPickerOpen(false)
            setPenMode(false)
          }}
          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-border)]"
        >
          <span className="text-lg" aria-hidden>
            {p.icon}
          </span>
          <span className="truncate">{p.label}</span>
        </button>
      ))}
      {customs.map((c) => (
        <button
          key={c.name}
          type="button"
          onClick={() => {
            onUpdateCategory({ name: c.name, icon: c.icon })
            setPickerOpen(false)
            setPenMode(false)
          }}
          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-border)]"
        >
          <span className="text-lg" aria-hidden>
            {c.icon}
          </span>
          <span className="truncate">{c.name}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          setPickerOpen(false)
          setDraftName(category.name)
          setPenMode(true)
        }}
        className="cursor-pointer rounded-lg border border-dashed border-[var(--color-brand-border)] px-2 py-2 text-left text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]/60"
      >
        + {labels.customCategoryOption}
      </button>
    </div>
  )

  if (penMode) {
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <BudgetPlannerEmojiPicker
          value={category.icon}
          onChange={(emoji) => onUpdateCategory({ icon: emoji })}
          ariaLabel={labels.emojiPickerLabel}
        />
        <input
          ref={inputRef}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitPen}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitPen()
            }
          }}
          placeholder={labels.categoryNameExample}
          className="min-w-32 flex-1 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2 py-1.5 text-sm text-[var(--color-brand-text-primary)] ring-1 ring-[var(--color-brand-red)]/50 placeholder:text-[var(--color-brand-text-muted)]"
        />
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span
        className="flex h-9 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-lg"
        aria-hidden
      >
        {category.icon}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger
            type="button"
            className={cn(
              'flex min-w-0 min-h-11 flex-1 cursor-pointer items-center gap-1 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2 py-1.5 text-left text-sm text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-border)]'
            )}
          >
            <span className="truncate">{category.name || labels.categoryNamePlaceholder}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[min(100vw-2rem,18rem)] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-0 text-[var(--color-brand-text-primary)] shadow-xl"
          >
            <p className="border-b border-[var(--color-brand-border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
              {labels.chooseCategoryTitle}
            </p>
            {popoverItems}
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={() => {
            setDraftName(category.name)
            setPenMode(true)
          }}
          className="cursor-pointer inline-flex shrink-0 items-center justify-center min-w-11 min-h-11 rounded-lg text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)]"
          aria-label={labels.editCategoryName}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
