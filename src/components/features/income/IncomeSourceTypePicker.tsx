'use client'

import type { Dictionary } from '@/lib/i18n/types'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { MANUAL_INCOME_SOURCE_TYPES, ALL_INCOME_SOURCE_TYPES } from '@/lib/constants/incomeSourceTypes'
import type { IncomeSourceType } from '@/lib/store/types'

const TYPE_EMOJI: Partial<Record<IncomeSourceType, string>> = {
  salary: '💰',
  bonus: '🎯',
  side_hustle: '💼',
  investment: '📈',
  savings: '🏦',
  debt: '💳',
  gift: '🎁',
  refund: '↩️',
  other: '⋯',
}

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
        const emoji = TYPE_EMOJI[st] ?? ''
        return (
          <button
            key={st}
            type="button"
            disabled={disabled}
            onClick={() => onChange(st)}
            className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              active
                ? 'bg-[var(--color-brand-red)]/20 border-[var(--color-brand-red)] text-[var(--color-brand-text-primary)]'
                : 'bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-text-muted)]'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <span className="mr-1" aria-hidden>
              {emoji}
            </span>
            {incomeSourceTypeLabel(labels, st)}
          </button>
        )
      })}
    </div>
  )
}
