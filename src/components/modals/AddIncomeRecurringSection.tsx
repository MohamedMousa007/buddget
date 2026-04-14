'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/i18n/types'
import type { IncomeRecurringFrequency } from '@/lib/store/types'

const RECURRING_FREQ: { value: IncomeRecurringFrequency; label: string; amountHint: string }[] = [
  { value: 'monthly', label: 'Monthly', amountHint: 'Amount is per month.' },
  { value: 'biweekly', label: 'Bi-weekly', amountHint: 'Amount is per paycheck (26 per year).' },
  { value: 'weekly', label: 'Weekly', amountHint: 'Amount is per week.' },
]

type Props = {
  t: Dictionary
  recurringFrequency: IncomeRecurringFrequency
  setRecurringFrequency: (v: IncomeRecurringFrequency) => void
  dayOfMonth: string
  setDayOfMonth: (v: string) => void
}

/** Frequency + day-of-month when recurring income is enabled. */
export function AddIncomeRecurringSection({
  t,
  recurringFrequency,
  setRecurringFrequency,
  dayOfMonth,
  setDayOfMonth,
}: Props) {
  return (
    <>
      <div className={recurringFrequency === 'monthly' ? 'grid grid-cols-2 gap-3' : ''}>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelFrequency}</Label>
          <select
            value={recurringFrequency}
            onChange={(e) => setRecurringFrequency(e.target.value as IncomeRecurringFrequency)}
            className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
          >
            {RECURRING_FREQ.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        {recurringFrequency === 'monthly' && (
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelDayOfMonth}</Label>
            <Input
              type="number"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
            />
          </div>
        )}
      </div>
      <p className="text-[10px] text-[var(--color-brand-text-muted)]">
        {RECURRING_FREQ.find((f) => f.value === recurringFrequency)?.amountHint}
        {' '}
        Budgets use a monthly equivalent (e.g. weekly × 52÷12).
      </p>
    </>
  )
}
