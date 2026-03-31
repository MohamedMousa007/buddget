'use client'

import { formatCurrency } from '@/lib/utils/formatters'
import type { Currency } from '@/lib/store/types'

export interface BudgetPlannerSummaryProps {
  totalIncome: number
  totalPlanned: number
  projectedSavings: number
  currency: Currency
  labels: {
    totalIncome: string
    totalPlanned: string
    projectedSavings: string
    projectedSavingsLine: (amount: string) => string
  }
}

/** Prominent income / planned / projected savings panel. */
export function BudgetPlannerSummary({
  totalIncome,
  totalPlanned,
  projectedSavings,
  currency,
  labels,
}: BudgetPlannerSummaryProps) {
  const savingsStr = formatCurrency(projectedSavings, currency, true)
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-gradient-to-br from-[var(--color-brand-elevated)]/90 to-[#111118] p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            {labels.totalIncome}
          </p>
          <p className="mt-1 text-lg font-semibold text-white font-mono-numbers">
            {formatCurrency(totalIncome, currency, true)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            {labels.totalPlanned}
          </p>
          <p className="mt-1 text-lg font-semibold text-white font-mono-numbers">
            {formatCurrency(totalPlanned, currency, true)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            {labels.projectedSavings}
          </p>
          <p
            className={`mt-1 text-lg font-semibold font-mono-numbers ${
              projectedSavings >= 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'
            }`}
          >
            {savingsStr}
          </p>
        </div>
      </div>
      <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed border-t border-[var(--color-brand-border)]/60 pt-4">
        {labels.projectedSavingsLine(savingsStr)}
      </p>
    </div>
  )
}
