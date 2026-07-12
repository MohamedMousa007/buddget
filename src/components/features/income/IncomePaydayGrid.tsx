'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { deriveDefaultPaydays, paydaysPerMonth } from '@/lib/utils/paydaySchedule'
import type { IncomeRecurringFrequency } from '@/lib/store/types'

interface Props {
  frequency: IncomeRecurringFrequency
  /** Selected payday days (1–31), sorted. Monthly 1, biweekly 2, weekly 4. */
  days: number[]
  onChange: (days: number[]) => void
}

/**
 * 3-row calendar grid, days 1–31. Tap the first payday; for biweekly/weekly the
 * remaining paydays auto-derive (5 → 20 semi-monthly, weekly +7). The Edit
 * toggle (in the spare cells after day 31) switches to manual mode where each
 * tap fills the next of the 2/4 slots; a tap past the last slot restarts.
 */
export function IncomePaydayGrid({ frequency, days, onChange }: Props) {
  const t = useT()
  const required = paydaysPerMonth(frequency)
  const [manual, setManual] = useState(false)
  // Ordered picks in manual mode; anchor = last tapped day in auto mode.
  const [picks, setPicks] = useState<number[]>([])
  const [anchor, setAnchor] = useState<number | null>(null)

  const tap = (day: number) => {
    if (!manual) {
      setAnchor(day)
      onChange(deriveDefaultPaydays(day, frequency))
      return
    }
    let next: number[]
    if (picks.includes(day)) next = picks.filter((d) => d !== day)
    else if (picks.length >= required) next = [day]
    else next = [...picks, day]
    setPicks(next)
    onChange([...next].sort((a, b) => a - b))
  }

  const toggleManual = () => {
    if (!manual) setPicks(days)
    setManual((m) => !m)
  }

  const solid = manual ? new Set(days) : new Set([anchor ?? days[0]])
  const selected = new Set(days)

  return (
    <div className="grid grid-cols-11 gap-1.5">
      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
        const isSolid = solid.has(day)
        const isDerived = !isSolid && selected.has(day)
        return (
          <button
            key={day}
            type="button"
            onClick={() => tap(day)}
            className={`flex h-8 items-center justify-center rounded-md font-mono-numbers text-xs font-semibold transition-colors ${
              isSolid
                ? 'bg-[var(--color-brand-red)] text-white'
                : isDerived
                  ? 'bg-[rgba(229,9,20,0.18)] text-[var(--color-brand-red)]'
                  : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
            }`}
          >
            {day}
          </button>
        )
      })}
      {frequency !== 'monthly' ? (
        <button
          type="button"
          onClick={toggleManual}
          aria-pressed={manual}
          className={`col-span-2 flex h-8 items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition-colors ${
            manual
              ? 'bg-[rgba(229,9,20,0.18)] text-[var(--color-brand-red)]'
              : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
          }`}
        >
          <Pencil className="h-3 w-3" />
          {t.addIncome.paydayEditBtn}
        </button>
      ) : null}
    </div>
  )
}
