'use client'

import type { IncomeRecurringFrequency } from '@/lib/store/types'

interface Props {
  frequency: IncomeRecurringFrequency
  /** Anchor payday (1–31). */
  value: number
  onChange: (day: number) => void
}

/** Paydays that light up given an anchor day + cadence (handoff §6). */
export function derivedPaydays(anchor: number, frequency: IncomeRecurringFrequency): number[] {
  const step = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 0
  if (step === 0) return [anchor]
  const days: number[] = []
  for (let d = anchor; d <= 31; d += step) days.push(d)
  return days
}

/**
 * 3-row calendar grid, days 1–31. Tap the first payday; for biweekly/weekly the
 * derived paydays auto-light in soft red. No "lands on" caption (handoff §6).
 */
export function IncomePaydayGrid({ frequency, value, onChange }: Props) {
  const derived = new Set(derivedPaydays(value, frequency))
  return (
    <div className="grid grid-cols-11 gap-1.5">
      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
        const isAnchor = day === value
        const isDerived = !isAnchor && derived.has(day)
        return (
          <button
            key={day}
            type="button"
            onClick={() => onChange(day)}
            className={`flex h-8 items-center justify-center rounded-md font-mono-numbers text-xs font-semibold transition-colors ${
              isAnchor
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
    </div>
  )
}
