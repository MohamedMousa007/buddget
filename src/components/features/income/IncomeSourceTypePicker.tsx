'use client'

import type { Dictionary } from '@/lib/i18n/types'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { MANUAL_INCOME_SOURCE_TYPES, ALL_INCOME_SOURCE_TYPES } from '@/lib/constants/incomeSourceTypes'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { incomeTypeGridItem } from '@/lib/constants/categoryGrid'
import type { IncomeSourceType } from '@/lib/store/types'

export type IncomeSourceTypePickerProps = {
  value: IncomeSourceType
  onChange: (next: IncomeSourceType) => void
  labels: Dictionary['income']
  /** `manual` hides savings/investment (system-generated). */
  mode: 'manual' | 'all'
  disabled?: boolean
}

/**
 * Pill selector for income `sourceType`; used on add and edit flows.
 */
export function IncomeSourceTypePicker({
  value,
  onChange,
  labels,
  mode,
  disabled,
}: IncomeSourceTypePickerProps) {
  const list = mode === 'manual' ? MANUAL_INCOME_SOURCE_TYPES : ALL_INCOME_SOURCE_TYPES
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((st) => {
        const active = value === st
        return (
          <button
            key={st}
            type="button"
            disabled={disabled}
            onClick={() => onChange(st)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              active
                ? 'bg-[var(--color-brand-red)]/20 border-[var(--color-brand-red)] text-[var(--color-brand-text-primary)]'
                : 'bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-text-muted)]'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <IncomeTypeIcon
              type={st}
              className="h-3.5 w-3.5"
              style={active ? { color: incomeTypeGridItem(st).accent } : undefined}
            />
            {incomeSourceTypeLabel(labels, st)}
          </button>
        )
      })}
    </div>
  )
}
