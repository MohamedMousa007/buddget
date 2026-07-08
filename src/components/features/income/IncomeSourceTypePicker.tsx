'use client'

import type { Dictionary } from '@/lib/i18n/types'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { MANUAL_INCOME_SOURCE_TYPES, ALL_INCOME_SOURCE_TYPES } from '@/lib/constants/incomeSourceTypes'
import { incomeTypeGridItem } from '@/lib/constants/categoryGrid'
import { rgba } from '@/lib/utils/color'
import type { IncomeSourceType } from '@/lib/store/types'

const HIDE_SCROLL = '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

export type IncomeSourceTypePickerProps = {
  value: IncomeSourceType
  onChange: (next: IncomeSourceType) => void
  labels: Dictionary['income']
  /** `manual` hides savings/investment (system-generated). */
  mode: 'manual' | 'all'
  disabled?: boolean
}

/**
 * Tile-grid selector for income `sourceType` (matches the expense category slider):
 * a two-row horizontal scroll of unique Lucide glyphs from INCOME_TYPE_GRID.
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
    <div className={`overflow-x-auto pb-0.5 ${HIDE_SCROLL}`}>
      <div
        className="grid w-max gap-2"
        style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(2,60px)', gridAutoColumns: '66px' }}
      >
        {list.map((st) => {
          const active = value === st
          const { icon: Icon, accent } = incomeTypeGridItem(st)
          const tileStyle: React.CSSProperties = active
            ? { background: rgba(accent, 0.15), border: `1px solid ${rgba(accent, 0.55)}` }
            : { background: 'var(--color-brand-elevated)', border: '1px solid var(--color-brand-border)' }
          return (
            <button
              key={st}
              type="button"
              disabled={disabled}
              onClick={() => onChange(st)}
              aria-pressed={active}
              style={tileStyle}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl transition-all ${
                disabled ? 'cursor-not-allowed opacity-60' : ''
              }`}
            >
              <Icon className="h-6 w-6" style={{ color: active ? accent : 'var(--color-brand-text-muted)' }} />
              <span
                className="whitespace-nowrap text-[10px] font-semibold"
                style={{ color: active ? 'var(--color-brand-text-primary)' : 'var(--color-brand-text-secondary)' }}
              >
                {incomeSourceTypeLabel(labels, st)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
