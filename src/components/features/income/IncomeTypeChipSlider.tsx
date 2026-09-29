'use client'

import { ChevronRight } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/types'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { MANUAL_INCOME_SOURCE_TYPES } from '@/lib/constants/incomeSourceTypes'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import type { IncomeSourceType } from '@/lib/store/types'
import { OptionChip } from '@/components/ui/OptionChip'

interface Props {
  value: IncomeSourceType
  onChange: (next: IncomeSourceType) => void
  labels: Dictionary['income']
  /** The surface the row sits on; the end fade blends into it. Default: a sheet (card). */
  fadeColor?: string
}

/**
 * Single-row horizontal chip slider for income `sourceType` (handoff §6). All 7
 * manual types; the active chip fills with its accent tint. Shown in both tabs.
 */
export function IncomeTypeChipSlider({ value, onChange, labels, fadeColor = 'var(--color-brand-card)' }: Props) {
  return (
    <div className="relative">
      {/* py-1 -my-1: room for the selected chip's border, which overflow-x would otherwise clip. */}
      <div className="hide-scrollbar -mx-1 -my-1 flex gap-2 overflow-x-auto px-1 py-1">
        {MANUAL_INCOME_SOURCE_TYPES.map((st) => {
        const active = value === st
        const colors = incomeTypeColors(st)
        return (
          <OptionChip
            key={st}
            selected={active}
            onClick={() => onChange(st)}
            style={active ? { background: colors.bg, borderColor: colors.fg, color: colors.fg } : undefined}
          >
            <IncomeTypeIcon type={st} className="h-4 w-4" />
            {incomeSourceTypeLabel(labels, st)}
          </OptionChip>
        )
      })}
      </div>
      {/* Right-edge fade + chevron — hints the row scrolls horizontally (7 types overflow). */}
      <div
        className="pointer-events-none absolute inset-y-0 end-0 flex w-10 items-center justify-end pe-0.5"
        style={{ background: `linear-gradient(to left, ${fadeColor}, transparent)` }}
      >
        <ChevronRight className="h-4 w-4 text-[var(--color-brand-text-muted)] rtl:rotate-180" />
      </div>
    </div>
  )
}
