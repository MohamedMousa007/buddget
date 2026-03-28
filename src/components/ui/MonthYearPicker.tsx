'use client'

import { useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'
import { formatMonth } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface MonthYearPickerProps {
  monthFilter: string
  onChange: (yyyyMm: string) => void
  className?: string
}

export function MonthYearPicker({ monthFilter, onChange, className }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false)
  const parsed = useMemo(() => {
    const [ys, ms] = monthFilter.split('-')
    const year = parseInt(ys || '2025', 10)
    const month = parseInt(ms || '1', 10)
    return { year: Number.isFinite(year) ? year : 2025, month: Number.isFinite(month) ? month : 1 }
  }, [monthFilter])

  const years = useMemo(() => {
    const y = new Date().getFullYear()
    return Array.from({ length: 11 }, (_, i) => y - 5 + i)
  }, [])

  const pick = (month: number) => {
    const mm = String(month).padStart(2, '0')
    onChange(`${parsed.year}-${mm}`)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          'inline-flex items-center gap-1 cursor-pointer transition-colors duration-150',
          'text-white hover:text-[#A0A0B8]',
          className
        )}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 text-[#A0A0B8]" aria-hidden />
        <span className="text-sm font-medium underline underline-offset-2">{formatMonth(monthFilter)}</span>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[260px] bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] p-3"
        align="center"
      >
        <div className="flex gap-2 mb-3">
          <label className="text-xs text-[var(--color-brand-text-muted)] shrink-0 self-center">Year</label>
          <select
            value={parsed.year}
            onChange={(e) => {
              const y = parseInt(e.target.value, 10)
              const mm = String(parsed.month).padStart(2, '0')
              onChange(`${y}-${mm}`)
            }}
            className="flex-1 h-9 px-2 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
          ].map((label, i) => {
            const m = i + 1
            const active = parsed.month === m
            return (
              <button
                key={label}
                type="button"
                onClick={() => pick(m)}
                className={cn(
                  'py-2 rounded-lg text-xs font-medium transition-colors',
                  active
                    ? 'bg-[var(--color-brand-red)] text-white'
                    : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
