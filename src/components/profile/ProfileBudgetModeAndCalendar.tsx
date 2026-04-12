'use client'

import { formatCurrency } from '@/lib/utils/formatters'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/i18n/types'

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
        <select
          value={monthStartDay}
          onChange={(e) => onMonthStartDay(parseInt(e.target.value))}
          className="mt-1 w-24 h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
        >
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
              {d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}
