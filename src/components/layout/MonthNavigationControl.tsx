'use client'

import { addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'

const navBtnClass =
  'inline-flex items-center justify-center w-7 h-7 rounded-lg bg-transparent hover:bg-[#1A1A24] text-[#A0A0B8] hover:text-white transition-colors duration-150 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-red)]/50'

interface MonthNavigationControlProps {
  monthFilter: string
  onChange: (yyyyMm: string) => void
}

export function MonthNavigationControl({ monthFilter, onChange }: MonthNavigationControlProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={navBtnClass}
        onClick={() => onChange(subMonths(new Date(`${monthFilter}-01`), 1).toISOString().slice(0, 7))}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <MonthYearPicker monthFilter={monthFilter} onChange={onChange} />
      <button
        type="button"
        className={navBtnClass}
        onClick={() => onChange(addMonths(new Date(`${monthFilter}-01`), 1).toISOString().slice(0, 7))}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
