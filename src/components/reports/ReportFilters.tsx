'use client'

import { useT } from '@/lib/i18n'
import { OptionChip } from '@/components/ui/OptionChip'

type DateRange = 'thisMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'thisYear'

interface ReportFiltersProps {
  selected: DateRange
  onSelect: (range: DateRange) => void
}

export function ReportFilters({ selected, onSelect }: ReportFiltersProps) {
  const t = useT()
  const options: { value: DateRange; label: string }[] = [
    { value: 'thisMonth', label: t.reports.rangeThisMonth },
    { value: 'lastMonth', label: t.reports.rangeLastMonth },
    { value: 'last3Months', label: t.reports.rangeLast3Months },
    { value: 'last6Months', label: t.reports.rangeLast6Months },
    { value: 'thisYear', label: t.reports.rangeThisYear },
  ]
  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
      {options.map((opt) => (
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
