'use client'

import { useT } from '@/lib/i18n'
import { OptionChip } from '@/components/ui/OptionChip'

type DateRange = 'thisMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'thisYear'

interface ReportFiltersProps {
  selected: DateRange
  onSelect: (range: DateRange) => void
  /** Ranges the plan does not include: shown with a Pro mark, and tapping one calls `onLocked` instead of selecting it. */
  lockedRanges?: readonly DateRange[]
  onLocked?: () => void
}

export function ReportFilters({ selected, onSelect, lockedRanges = [], onLocked }: ReportFiltersProps) {
  const t = useT()
  const options: { value: DateRange; label: string }[] = [
    { value: 'thisMonth', label: t.reports.rangeThisMonth },
    { value: 'lastMonth', label: t.reports.rangeLastMonth },
    { value: 'last3Months', label: t.reports.rangeLast3Months },
    { value: 'last6Months', label: t.reports.rangeLast6Months },
    { value: 'thisYear', label: t.reports.rangeThisYear },
  ]
  return (
    <div className="-my-1 flex gap-2 overflow-x-auto hide-scrollbar py-1">
      {options.map((opt) => (
        <OptionChip
          key={opt.value}
          selected={selected === opt.value}
          onClick={() => (lockedRanges.includes(opt.value) ? onLocked?.() : onSelect(opt.value))}
        >
          {opt.label}
          {lockedRanges.includes(opt.value) && (
            <span className="rounded-md bg-[color-mix(in_oklab,var(--color-brand-gold)_16%,var(--color-brand-card))] px-1.5 text-[0.59375rem] font-extrabold uppercase tracking-wide text-[var(--color-brand-gold)]">
              {t.insights.rangeLocked}
            </span>
          )}
        </OptionChip>
      ))}
    </div>
  )
}

export type { DateRange }
