'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import { OptionChip } from '@/components/ui/OptionChip'
import { BudgetChip } from '@/components/features/flow/BudgetChip'
import { useT } from '@/lib/i18n'

export interface FlowChip {
  key: string
  label: string
  selected: boolean
  onPress: () => void
  /** Present → a budget chip (ring + %). */
  budget?: { pct: number; over: boolean }
}

/**
 * Filters first, then either the budget chips (All / Out), the income types (In), or —
 * once the sheet has narrowed things — the applied filters, each removable with its ✕.
 * One horizontal scroller, no scrollbar.
 */
export function FlowChipRow({ filterCount, onOpenFilters, chips }: { filterCount: number; onOpenFilters: () => void; chips: FlowChip[] }) {
  const t = useT()
  return (
    <div className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto px-4 [touch-action:pan-x]">
      <OptionChip
        as="trigger"
        surface="card"
        size="sm"
        selected={filterCount > 0}
        aria-label={t.flow.openFilters}
        aria-haspopup="dialog"
        onClick={onOpenFilters}
      >
        <SlidersHorizontal className="size-3.5" strokeWidth={1.75} aria-hidden />
        {filterCount > 0 ? t.flow.filtersCount(filterCount) : t.flow.filters}
      </OptionChip>
      {chips.map((c) =>
        c.budget ? (
          <BudgetChip
            key={c.key}
            label={c.label}
            pct={c.budget.pct}
            over={c.budget.over}
            selected={c.selected}
            onToggle={c.onPress}
            ariaLabel={c.selected ? t.flow.removeFilter(c.label) : t.flow.showOnly(c.label)}
          />
        ) : (
          <OptionChip
            key={c.key}
            as="trigger"
            surface="card"
            size="sm"
            selected={c.selected}
            aria-pressed={c.selected}
            aria-label={c.selected ? t.flow.removeFilter(c.label) : t.flow.showOnly(c.label)}
            onClick={c.onPress}
          >
            {c.label}
            {c.selected ? <X className="size-3" strokeWidth={2.5} aria-hidden /> : null}
          </OptionChip>
        ),
      )}
    </div>
  )
}
