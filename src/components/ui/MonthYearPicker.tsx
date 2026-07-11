'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { useLocale, useT } from '@/lib/i18n'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'

interface MonthYearPickerProps {
  monthFilter: string
  onChange: (yyyyMm: string) => void
  className?: string
  /** When true, shows "Mar 2026" instead of "March 2026" */
  compact?: boolean
  /** Expenses hero cue: big month + mono year + chevron-down, no calendar icon. */
  heroLabel?: boolean
}

export function MonthYearPicker({ monthFilter, onChange, className, compact, heroLabel }: MonthYearPickerProps) {
  const t = useT()
  const { locale } = useLocale()
  const { formatMonth, formatMonthShort, monthButtonLabel } = useLocalizedFormatters()
  const [open, setOpen] = useState(false)
  const parsed = useMemo(() => {
    const [ys, ms] = monthFilter.split('-')
    const fallbackYear = new Date().getFullYear()
    const year = parseInt(ys || String(fallbackYear), 10)
    const month = parseInt(ms || '1', 10)
    return { year: Number.isFinite(year) ? year : fallbackYear, month: Number.isFinite(month) ? month : 1 }
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

  const label = compact ? formatMonthShort(monthFilter) : formatMonth(monthFilter)
  const monthLong = new Date(parsed.year, parsed.month - 1, 1).toLocaleString(
    locale === 'ar' ? 'ar-EG' : 'en-US',
    { month: 'long' },
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {heroLabel ? (
        <PopoverTrigger
          type="button"
          className={cn(
            'inline-flex items-center gap-2 cursor-pointer outline-none',
            'focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/50',
            className,
          )}
        >
          <span className="text-[21px] font-bold tracking-[-0.015em] leading-none text-[var(--color-brand-text-primary)]">
            {monthLong}
          </span>
          <span className="font-mono-numbers text-sm font-medium text-[var(--color-brand-text-muted)]">
            {parsed.year}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-[var(--color-brand-text-muted)]" aria-hidden />
        </PopoverTrigger>
      ) : (
        <PopoverTrigger
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 cursor-pointer',
            'text-[var(--color-brand-text-primary)] hover:text-[var(--color-brand-text-secondary)] transition-colors duration-150',
            'outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/50',
            className
          )}
        >
          <CalendarDays className="w-3.5 h-3.5 shrink-0 text-[var(--color-brand-text-secondary)]" aria-hidden />
          <span className="font-medium whitespace-nowrap">{label}</span>
        </PopoverTrigger>
      )}
      <PopoverContent
        className="w-auto min-w-64 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] p-3"
        align="center"
      >
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs text-[var(--color-brand-text-muted)] shrink-0">{t.common.yearLabel}</label>
          <div className="flex-1">
            <SelectField
              value={String(parsed.year)}
              onChange={(v) => {
                const mm = String(parsed.month).padStart(2, '0')
                onChange(`${v}-${mm}`)
              }}
              items={years.map<SelectFieldOption>((y) => ({ value: String(y), label: String(y) }))}
              aria-label={t.common.yearLabel}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 12 }, (_, i) => {
            const m = i + 1
            const lbl = monthButtonLabel(m)
            const active = parsed.month === m
            return (
              <button
                key={m}
                type="button"
                onClick={() => pick(m)}
                className={cn(
                  'py-2 rounded-lg text-xs font-medium transition-colors',
                  active
                    ? 'bg-[var(--color-brand-red)] text-white'
                    : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
                )}
              >
                {lbl}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
