'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import { INCOME_RECURRING_FREQ_OPTIONS } from '@/lib/constants/incomeRecurring'
import type { Dictionary } from '@/lib/i18n/types'
import type { IncomeRecurringFrequency } from '@/lib/store/types'

type Props = {
  t: Dictionary
  recurringFrequency: IncomeRecurringFrequency
  setRecurringFrequency: (v: IncomeRecurringFrequency) => void
  dayOfMonth: string
  setDayOfMonth: (v: string) => void
}

/** Frequency + day-of-month block for edit income. */
export function EditIncomeRecurringBlock({
  t,
  recurringFrequency,
  setRecurringFrequency,
  dayOfMonth,
  setDayOfMonth,
}: Props) {
  const freqItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => INCOME_RECURRING_FREQ_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    [],
  )

  return (
    <>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.editIncome.labelFrequency}</Label>
        <SelectField
          value={recurringFrequency}
          onChange={(v) => setRecurringFrequency(v as IncomeRecurringFrequency)}
          items={freqItems}
          className="mt-1"
          aria-label={t.editIncome.labelFrequency}
        />
        <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">
          {INCOME_RECURRING_FREQ_OPTIONS.find((x) => x.value === recurringFrequency)?.amountHint}
          {' '}
          {t.editIncome.freqHint}
        </p>
      </div>
      {recurringFrequency === 'monthly' && (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.editIncome.labelDayOfMonth}</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            className="mt-1 w-24 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
          />
        </div>
      )}
    </>
  )
}
