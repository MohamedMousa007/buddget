'use client'

import { cn } from '@/lib/utils'

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
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
            selected === opt.value
              ? 'bg-[var(--color-brand-red)] text-white'
              : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export type { DateRange }
