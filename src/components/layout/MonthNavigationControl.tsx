'use client'

import { addMonths, subMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { IconButton } from '@/components/ui/IconButton'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'

interface MonthNavigationControlProps {
  monthFilter: string
  onChange: (yyyyMm: string) => void
  /** Smaller chevrons (w-6 h-6) and short month label ("Mar 2026") */
  compact?: boolean
}

function parseLocalMonth(yyyyMm: string): Date {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export function MonthNavigationControl({ monthFilter, onChange, compact }: MonthNavigationControlProps) {
  const t = useT()
  const prev = () => onChange(format(subMonths(parseLocalMonth(monthFilter), 1), 'yyyy-MM'))
  const next = () => onChange(format(addMonths(parseLocalMonth(monthFilter), 1), 'yyyy-MM'))

  return (
    <div className={cn('flex items-center', compact ? 'gap-0.5' : 'gap-1')}>
      <IconButton size="sm" onClick={prev} aria-label={t.common.previousMonth}>
        <ChevronLeft className={compact ? 'size-5' : 'size-6'} />
      </IconButton>
      <MonthYearPicker
        monthFilter={monthFilter}
        onChange={onChange}
        compact={compact}
        className="text-sm"
      />
      <IconButton size="sm" onClick={next} aria-label={t.common.nextMonth}>
        <ChevronRight className={compact ? 'size-5' : 'size-6'} />
      </IconButton>
    </div>
  )
}
