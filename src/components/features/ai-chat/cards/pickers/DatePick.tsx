'use client'

import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { OptionChip } from '@/components/ui/OptionChip'
import { UnifiedDatePicker } from '@/components/ui/UnifiedDatePicker'
import { useLocale } from '@/lib/i18n'
import { useBuddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'
import { localTodayISO } from '@/lib/utils/localDate'

export interface DatePickProps {
  /** ISO yyyy-MM-dd. */
  value: string
  onPick: (iso: string) => void
  /** For tests and the card's own clock. */
  now?: Date
}

/** The two dates people mean most often as chips; anything else opens the app's date picker. */
export function DatePick({ value, onPick, now = new Date() }: DatePickProps) {
  const copy = useBuddgyCardCopy().date
  const { locale } = useLocale()
  const [open, setOpen] = useState(false)
  const today = localTodayISO(now)
  const yesterday = localTodayISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const other = value !== today && value !== yesterday
  const otherLabel = other
    ? new Date(`${value}T12:00:00`).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : copy.pick
  return (
    <div role="group" aria-label={copy.label} className="flex flex-col gap-2">
      <span className="text-[0.8125rem] font-semibold">{copy.label}</span>
      <div className="flex flex-wrap gap-2">
        <OptionChip selected={value === today} onClick={() => onPick(today)}>{copy.today}</OptionChip>
        <OptionChip selected={value === yesterday} onClick={() => onPick(yesterday)}>{copy.yesterday}</OptionChip>
        <OptionChip as="trigger" selected={other} aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <CalendarDays aria-hidden />
          {otherLabel}
        </OptionChip>
      </div>
      {open ? (
        <UnifiedDatePicker
          open
          value={value}
          onConfirm={(iso) => {
            onPick(iso)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  )
}
