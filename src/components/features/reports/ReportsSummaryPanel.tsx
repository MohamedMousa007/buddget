'use client'

import { format } from 'date-fns'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Currency, Expense } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

export interface ReportsSummaryPanelProps {
  startDate: Date
  endDate: Date
  baseCurrency: Currency
  periodRecurringIncome: number
  remittances: number
  totalExpenses: number
  largestExpense: Expense | null
  /** Same expense as `largestExpense`, converted to `baseCurrency` with current rates (not cached `amountInBaseCurrency`). */
  largestExpenseInPrimary: number | null
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
  largestExpenseInPrimary,
  mostUsedMethod,
}: ReportsSummaryPanelProps) {
  const t = useT()
  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-4">
        {t.reports.summaryHeading(format(startDate, 'd MMM'), format(endDate, 'd MMM yyyy'))}
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.reports.kpiTotalIn}</p>
          <p className="text-lg font-bold font-mono-numbers text-[var(--color-brand-green)]">
            {formatCurrency(periodRecurringIncome, baseCurrency)}
          </p>
          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-0.5 max-w-[14rem]">
            {t.reports.kpiTotalInHint}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.reports.kpiSentHome}</p>
          <p className="text-lg font-bold font-mono-numbers text-[var(--color-brand-amber)]">
            {formatCurrency(remittances, baseCurrency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.reports.kpiTotalOut}</p>
          <p className="text-lg font-bold font-mono-numbers text-[var(--color-brand-red)]">
            {formatCurrency(totalExpenses, baseCurrency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.reports.kpiNetSaved}</p>
          <p className="text-lg font-bold font-mono-numbers text-white">
            {formatCurrency(periodRecurringIncome - totalExpenses, baseCurrency)}
          </p>
        </div>
        {largestExpense && largestExpenseInPrimary != null ? (
          <div>
            <p className="text-xs text-[var(--color-brand-text-muted)]">{t.reports.kpiBiggestPurchase}</p>
            <p className="text-sm font-medium text-white">
              {largestExpense.description}
              <span className="text-[var(--color-brand-text-secondary)] ms-1 font-mono-numbers">
                ({formatCurrency(largestExpenseInPrimary, baseCurrency)})
              </span>
            </p>
          </div>
        ) : null}
        {mostUsedMethod ? (
          <div>
            <p className="text-xs text-[var(--color-brand-text-muted)]">{t.reports.kpiGoToPayment}</p>
            <p className="text-sm font-medium text-white">
              {mostUsedMethod.name}
              <span className="text-[var(--color-brand-text-secondary)] ms-1">
                {t.reports.timesUsed(mostUsedMethod.count)}
              </span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
