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
        Your Summary — {format(startDate, 'd MMM')} – {format(endDate, 'd MMM yyyy')}
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">Total money in</p>
          <p className="text-lg font-bold font-mono-numbers text-[var(--color-brand-green)]">
            {formatCurrency(periodRecurringIncome, baseCurrency)}
          </p>
          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-0.5 max-w-[14rem]">
            All recurring income earned during this period, starting from each source&apos;s start date.
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">Money sent home</p>
          <p className="text-lg font-bold font-mono-numbers text-[var(--color-brand-amber)]">
            {formatCurrency(remittances, baseCurrency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">Total money out</p>
          <p className="text-lg font-bold font-mono-numbers text-[var(--color-brand-red)]">
            {formatCurrency(totalExpenses, baseCurrency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">Net saved</p>
          <p className="text-lg font-bold font-mono-numbers text-white">
            {formatCurrency(periodRecurringIncome - totalExpenses, baseCurrency)}
          </p>
        </div>
        {largestExpense ? (
          <div>
            <p className="text-xs text-[var(--color-brand-text-muted)]">Biggest purchase</p>
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
            <p className="text-xs text-[var(--color-brand-text-muted)]">Go-to payment</p>
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
