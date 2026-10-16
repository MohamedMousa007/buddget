'use client'

import type { ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { BudgetChip, type BudgetChipStatus } from '@/components/features/flow/BudgetChip'
import { useT } from '@/lib/i18n'

export interface FlowChip {
  key: string
  label: string
  selected: boolean
  onPress: () => void
  /** Leading glyph; a selected chip swaps it for the ✕ in place, so the chip never changes width. */
  icon?: ReactNode
  /** Present → a budget chip (% or "?" over a small progress bar). */
  budget?: BudgetChipStatus
  /** Overrides the default "Show only X" name, e.g. to carry the budget state. */
  ariaLabel?: string
}

/**
 * Filters first, then either the budget chips (All / Out), the income types (In), or —
 * once the sheet has narrowed things — the applied filters, each removable with its ✕.
 * One horizontal scroller, no scrollbar.
 */
export function FlowChipRow({
  filterCount,
  onOpenFilters,
  chips,
  results,
}: {
  filterCount: number
  onOpenFilters: () => void
  chips: FlowChip[]
  /** Shown at the end of the row while filters apply, so nothing is inserted under it. */
  results?: { count: number; summary: string; onClear: () => void }
}) {
  const t = useT()
  return (
    <div className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto px-4 [touch-action:pan-x]">
      <OptionChip
        as="trigger"
        surface="card"
        size="sm"
        selected={filterCount > 0}
        aria-label={filterCount > 0 ? t.flow.filtersCount(filterCount) : t.flow.openFilters}
        aria-haspopup="dialog"
        onClick={onOpenFilters}
      >
        {filterCount > 0 ? (
          <span
            aria-hidden
            className="flex size-4 items-center justify-center rounded-full bg-[var(--color-brand-primary)] font-mono-numbers text-[10px] font-bold leading-none text-[var(--color-brand-on-primary)]"
          >
            {filterCount > 9 ? '9+' : filterCount}
          </span>
        ) : (
          <SlidersHorizontal className="size-4" strokeWidth={1.75} aria-hidden />
        )}
        {t.flow.filters}
      </OptionChip>
      {chips.map((c) =>
        c.budget ? (
          <BudgetChip
            key={c.key}
            label={c.label}
            icon={c.icon}
            status={c.budget}
            selected={c.selected}
            onToggle={c.onPress}
            ariaLabel={c.ariaLabel ?? (c.selected ? t.flow.removeFilter(c.label) : t.flow.showOnly(c.label))}
          />
        ) : (
          <OptionChip
            key={c.key}
            as="trigger"
            surface="card"
            size="sm"
            selected={c.selected}
            aria-pressed={c.selected}
            aria-label={c.ariaLabel ?? (c.selected ? t.flow.removeFilter(c.label) : t.flow.showOnly(c.label))}
            onClick={c.onPress}
          >
            {c.selected ? <X className="size-3.5" strokeWidth={2.5} aria-hidden /> : c.icon}
            {c.label}
          </OptionChip>
        ),
      )}
      {results ? (
        <div className="ms-auto flex h-9 shrink-0 items-center gap-1 ps-2 text-[13px] text-[var(--color-brand-text-secondary)]">
          <span className="whitespace-nowrap">
            <b className="font-mono-numbers text-[var(--color-brand-text-primary)]">{results.count}</b> {t.flow.resultsWord(results.count)} ·{' '}
            <span className="font-mono-numbers">{results.summary}</span>
          </span>
          <Button variant="link" className="h-9 px-1.5" onClick={results.onClear}>
            {t.expenses.clearFilters}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
