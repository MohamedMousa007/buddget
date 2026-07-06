'use client'

import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT, useLocale } from '@/lib/i18n'
import { UnifiedDatePicker, formatDatePillLabel } from '@/components/ui/UnifiedDatePicker'

const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MON_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

export interface DatePickerFieldProps {
  /** ISO `yyyy-mm-dd`; for `mode="month"` an `yyyy-mm` value. */
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
  /** Shown when `value` is empty. Defaults to the localized "Select date". */
  placeholder?: string
  /** `month` shows/returns `yyyy-mm` (day is dropped). */
  mode?: 'day' | 'month'
}

/**
 * The app-wide date "pill": a calendar-icon trigger showing a friendly label
 * that opens the shared {@link UnifiedDatePicker}. Replaces every native
 * `<input type="date">` / `type="month"` so all date surfaces look identical.
 */
export function DatePickerField({
  value,
  onChange,
  id,
  className,
  placeholder,
  mode = 'day',
}: DatePickerFieldProps) {
  const t = useT()
  const { locale } = useLocale()
  const [open, setOpen] = useState(false)

  const label = !value
    ? (placeholder ?? t.common.selectDate)
    : mode === 'month'
      ? `${(locale === 'ar' ? MON_AR : MONS)[Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}`
      : formatDatePillLabel(value, locale, t.expenseForm.today)

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-start text-sm text-[var(--color-brand-text-primary)]',
          className,
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)]" />
        <span className={cn('truncate', !value && 'text-[var(--color-brand-text-muted)]')}>{label}</span>
      </button>
      <UnifiedDatePicker
        open={open}
        value={mode === 'month' && value ? `${value}-01` : value}
        onConfirm={(iso) => onChange(mode === 'month' ? iso.slice(0, 7) : iso)}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
