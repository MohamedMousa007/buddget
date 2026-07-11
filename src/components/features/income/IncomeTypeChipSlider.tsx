'use client'

import type { Dictionary } from '@/lib/i18n/types'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { MANUAL_INCOME_SOURCE_TYPES } from '@/lib/constants/incomeSourceTypes'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import type { IncomeSourceType } from '@/lib/store/types'

interface Props {
  value: IncomeSourceType
  onChange: (next: IncomeSourceType) => void
  labels: Dictionary['income']
}

/**
 * Single-row horizontal chip slider for income `sourceType` (handoff §6). All 7
 * manual types; the active chip fills with its accent tint. Shown in both tabs.
 */
export function IncomeTypeChipSlider({ value, onChange, labels }: Props) {
  return (
    <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
      {MANUAL_INCOME_SOURCE_TYPES.map((st) => {
        const active = value === st
        const colors = incomeTypeColors(st)
        return (
          <button
            key={st}
            type="button"
            onClick={() => onChange(st)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
              active ? '' : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
            }`}
            style={active ? { background: colors.bg, borderColor: colors.fg, color: colors.fg } : undefined}
          >
            <IncomeTypeIcon type={st} className="h-4 w-4" />
            {incomeSourceTypeLabel(labels, st)}
          </button>
        )
      })}
    </div>
  )
}
