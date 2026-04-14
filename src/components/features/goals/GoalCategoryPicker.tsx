'use client'

import type { Dictionary } from '@/lib/i18n/types'
import { GOAL_CATEGORIES } from '@/lib/constants/goalCategories'
import type { GoalCategory } from '@/lib/store/types'
import { cn } from '@/lib/utils'
import { goalCategoryLabelKey } from '@/components/features/goals/goalCategoryLabel'

export type GoalCategoryPickerProps = {
  value: GoalCategory
  onChange: (c: GoalCategory) => void
  labels: Dictionary['goals']
}

/**
 * Emoji + label grid for picking a goal category (add goal step 1).
 */
export function GoalCategoryPicker({ value, onChange, labels }: GoalCategoryPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {GOAL_CATEGORIES.map((c) => {
        const active = value === c.value
        const raw = labels[goalCategoryLabelKey(c.value)]
        const label = typeof raw === 'string' ? raw : c.label
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={cn(
              'px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors text-start max-w-[11rem]',
              active
                ? 'bg-[var(--color-brand-red)]/20 border-[var(--color-brand-red)] text-[var(--color-brand-text-primary)]'
                : 'bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-text-muted)]'
            )}
          >
            <span className="me-1" aria-hidden>
              {c.emoji}
            </span>
            {label}
          </button>
        )
      })}
    </div>
  )
}
