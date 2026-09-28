'use client'

import { OptionChip } from '@/components/ui/OptionChip'

type DateRange = 'thisMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'thisYear'

interface ReportFiltersProps {
  selected: DateRange
  onSelect: (range: DateRange) => void
}

const OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'last3Months', label: 'Last 3 Months' },
  { value: 'last6Months', label: 'Last 6 Months' },
  { value: 'thisYear', label: 'This Year' },
]

export function ReportFilters({ selected, onSelect }: ReportFiltersProps) {
  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
      {OPTIONS.map((opt) => (
        <OptionChip
          key={opt.value}
          selected={selected === opt.value}
          onClick={() => onSelect(opt.value)}
        >
          {opt.label}
        </OptionChip>
      ))}
    </div>
  )
}

export type { DateRange }
