'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { EMOJI_PICKER_GROUPS } from '@/lib/budget/budgetPlannerPresets'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface BudgetPlannerEmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
  ariaLabel: string
  /** Compact trigger for table rows */
  className?: string
}

/** Curated emoji groups in a popover (custom category / subcategory mode). */
export function BudgetPlannerEmojiPicker({ value, onChange, ariaLabel, className }: BudgetPlannerEmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const display = value.trim() || '📦'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          'flex h-9 w-10 shrink-0 items-center justify-center rounded-lg border border-[#2A2A38] bg-[#1A1A24] text-lg transition-colors hover:border-[var(--color-brand-border)]',
          className
        )}
        aria-label={ariaLabel}
      >
        <span className="leading-none">{display}</span>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-72 w-[min(100vw-2rem,20rem)] overflow-y-auto border border-[var(--color-brand-border)] bg-[#111118] p-3 text-white shadow-xl"
        align="start"
      >
        <div className="space-y-3">
          {EMOJI_PICKER_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
                {g.title}
              </p>
              <div className="flex flex-wrap gap-1">
                {g.emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      onChange(e)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-[var(--color-brand-elevated)]',
                      value === e && 'ring-1 ring-[var(--color-brand-red)]'
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
