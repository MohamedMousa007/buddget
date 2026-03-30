'use client'

import { addMonths, subMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'

interface MonthNavigationControlProps {
  monthFilter: string
  onChange: (yyyyMm: string) => void
  /** Smaller chevrons (w-6 h-6) and short month label ("Mar 2026") */
  compact?: boolean
}

const btnBase =
  'inline-flex items-center justify-center shrink-0 rounded-lg text-[#A0A0B8] hover:text-white hover:bg-[var(--color-brand-elevated)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-red)]/50'

function parseLocalMonth(yyyyMm: string): Date {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export function MonthNavigationControl({ monthFilter, onChange, compact }: MonthNavigationControlProps) {
  const prev = () => onChange(format(subMonths(parseLocalMonth(monthFilter), 1), 'yyyy-MM'))
  const next = () => onChange(format(addMonths(parseLocalMonth(monthFilter), 1), 'yyyy-MM'))

  return (
    <div className={cn('flex items-center', compact ? 'gap-0.5' : 'gap-1')}>
      <button
        type="button"
        className={cn(btnBase, compact ? 'w-7 h-7' : 'w-8 h-8')}
        onClick={prev}
        aria-label="Previous month"
      >
        <ChevronLeft className={compact ? 'w-5 h-5' : 'w-[22px] h-[22px]'} />
      </button>
      <MonthYearPicker
        monthFilter={monthFilter}
        onChange={onChange}
        compact={compact}
        className="text-sm"
      />
      <button
        type="button"
        className={cn(btnBase, compact ? 'w-7 h-7' : 'w-8 h-8')}
        onClick={next}
        aria-label="Next month"
      >
        <ChevronRight className={compact ? 'w-5 h-5' : 'w-[22px] h-[22px]'} />
      </button>
    </div>
  )
}
