'use client'

import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import { IncomePaydayGrid } from '@/components/features/income/IncomePaydayGrid'
import { INCOME_RECURRING_FREQ_OPTIONS } from '@/lib/constants/incomeRecurring'
import type { Dictionary } from '@/lib/i18n/types'
import type { IncomeRecurringFrequency } from '@/lib/store/types'

type Props = {
  t: Dictionary
  recurringFrequency: IncomeRecurringFrequency
  setRecurringFrequency: (v: IncomeRecurringFrequency) => void
  paydayDays: number[]
  setPaydayDays: (days: number[]) => void
}

/** Frequency + payday-days block for edit income. */
export function EditIncomeRecurringBlock({
  t,
  recurringFrequency,
  setRecurringFrequency,
  paydayDays,
  setPaydayDays,
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
      <div>
        <div className="flex items-baseline gap-2">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.paydayLabel}</Label>
          {recurringFrequency !== 'monthly' ? (
            <span className="text-[10px] text-[var(--color-brand-text-muted)]">
              {t.addIncome.paydayHelper(recurringFrequency === 'biweekly' ? 2 : 4)}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5">
          <IncomePaydayGrid frequency={recurringFrequency} days={paydayDays} onChange={setPaydayDays} />
        </div>
      </div>
    </>
  )
}
