'use client'

import type { Dictionary } from '@/lib/i18n/types'
import { GOAL_CATEGORIES } from '@/lib/constants/goalCategories'
import type { GoalCategory } from '@/lib/store/types'
import { goalCategoryLabelKey } from '@/components/features/goals/goalCategoryLabel'
import { OptionChip } from '@/components/ui/OptionChip'

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
          <OptionChip
            key={c.value}
            onClick={() => onChange(c.value)}
            selected={active}
            size="sm"
            className="max-w-[11rem]"
          >
            <span className="me-1" aria-hidden>
              {c.emoji}
            </span>
            {label}
          </OptionChip>
        )
      })}
    </div>
  )
}
