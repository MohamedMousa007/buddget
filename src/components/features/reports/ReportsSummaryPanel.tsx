'use client'

import { format } from 'date-fns'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Currency, Expense } from '@/lib/store/types'

export interface ReportsSummaryPanelProps {
  startDate: Date
  endDate: Date
  baseCurrency: Currency
  periodRecurringIncome: number
  remittances: number
  totalExpenses: number
  largestExpense: Expense | null
  mostUsedMethod: { name: string; count: number; total: number } | null
}

/**
 * KPI grid for the selected reporting period.
 */
export function ReportsSummaryPanel({
  startDate,
  endDate,
  baseCurrency,
  periodRecurringIncome,
  remittances,
  totalExpenses,
  largestExpense,
  mostUsedMethod,
}: ReportsSummaryPanelProps) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-4">
        Summary — {format(startDate, 'd MMM')} – {format(endDate, 'd MMM yyyy')}
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">Recurring income (period)</p>
          <p className="text-lg font-bold font-mono-numbers text-[var(--color-brand-green)]">
            {formatCurrency(periodRecurringIncome, baseCurrency)}
          </p>
          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-0.5 max-w-[14rem]">
            Sum of monthly recurring sources for each calendar month in this range (sources count only after their start
            date).
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">Total Remittances</p>
          <p className="text-lg font-bold font-mono-numbers text-[var(--color-brand-amber)]">
            {formatCurrency(remittances, baseCurrency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">Total Expenses</p>
          <p className="text-lg font-bold font-mono-numbers text-[var(--color-brand-red)]">
            {formatCurrency(totalExpenses, baseCurrency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">Net (income − expenses)</p>
          <p className="text-lg font-bold font-mono-numbers text-white">
            {formatCurrency(periodRecurringIncome - totalExpenses, baseCurrency)}
          </p>
        </div>
        {largestExpense ? (
          <div>
            <p className="text-xs text-[var(--color-brand-text-muted)]">Largest Expense</p>
            <p className="text-sm font-medium text-white">
              {largestExpense.description}
              <span className="text-[var(--color-brand-text-secondary)] ml-1 font-mono-numbers">
                ({formatCurrency(largestExpense.amountInBaseCurrency, baseCurrency)})
              </span>
            </p>
          </div>
        ) : null}
        {mostUsedMethod ? (
          <div>
            <p className="text-xs text-[var(--color-brand-text-muted)]">Most Used Method</p>
            <p className="text-sm font-medium text-white">
              {mostUsedMethod.name}
              <span className="text-[var(--color-brand-text-secondary)] ml-1">
                ({mostUsedMethod.count} times)
              </span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
