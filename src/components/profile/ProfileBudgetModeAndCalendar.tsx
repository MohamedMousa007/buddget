'use client'

import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils/formatters'
import { Label } from '@/components/ui/label'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import type { Dictionary } from '@/lib/i18n/types'

function ordinalSuffix(d: number): string {
  return d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'
}

export interface ProfileBudgetModeAndCalendarProps {
  t: Dictionary['profile']
  baseCurrency: string
  budgetMode: 'amount' | 'percent_of_income'
  monthlyIncome: number
  monthStartDay: number
  onModeAmount: () => void
  onModePercent: () => void
  onMonthStartDay: (day: number) => void
}

/** Fixed vs % mode toggle, recurring-income hint, and budget month start day. */
export function ProfileBudgetModeAndCalendar({
  t,
  baseCurrency,
  budgetMode,
  monthlyIncome,
  monthStartDay,
  onModeAmount,
  onModePercent,
  onMonthStartDay,
}: ProfileBudgetModeAndCalendarProps) {
  const dayItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () =>
      Array.from({ length: 28 }, (_, i) => i + 1).map((d) => ({
        value: String(d),
        label: `${d}${ordinalSuffix(d)}`,
      })),
    [],
  )

  return (
    <>
      <p className="text-[10px] text-[var(--color-brand-text-muted)]">
        All budget amounts are shown in <strong className="text-[var(--color-brand-text-primary)]">{baseCurrency}</strong>, your primary currency.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onModeAmount}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            budgetMode === 'amount'
              ? 'bg-[var(--color-brand-red)] text-white'
              : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
          }`}
        >
          {t.budgetModeFixed}
        </button>
        <button
          type="button"
          onClick={onModePercent}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            budgetMode === 'percent_of_income'
              ? 'bg-[var(--color-brand-red)] text-white'
              : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
          }`}
        >
          {t.budgetModePercent}
        </button>
      </div>
      {budgetMode === 'percent_of_income' && (
        <p className="text-[10px] text-[var(--color-brand-text-muted)]">
          {t.budgetRecurringIncome(baseCurrency)}
          <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">{formatCurrency(monthlyIncome, baseCurrency)}</span>
          /mo. Your category percentages should add up to around 100% for a full allocation.
        </p>
      )}
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.budgetMonthStarts}</Label>
        <div className="mt-1 w-32">
          <SelectField
            value={String(monthStartDay)}
            onChange={(v) => onMonthStartDay(parseInt(v, 10))}
            items={dayItems}
            aria-label={t.budgetMonthStarts}
          />
        </div>
      </div>
    </>
  )
}
