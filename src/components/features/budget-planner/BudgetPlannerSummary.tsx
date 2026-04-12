'use client'

import { CirclePlus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Currency } from '@/lib/store/types'

export interface BudgetPlannerSummaryProps {
  totalIncome: number
  totalPlanned: number
  projectedSavings: number
  currency: Currency
  hasIncome?: boolean
  onAddIncome?: () => void
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
  hasIncome = true,
  onAddIncome,
  labels,
}: BudgetPlannerSummaryProps) {
  const savingsStr = hasIncome ? formatCurrency(projectedSavings, currency, true) : '—'
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-gradient-to-br from-[var(--color-brand-elevated)]/90 to-[var(--color-brand-card)] p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            {labels.totalIncome}
          </p>
          {hasIncome ? (
            <p className="mt-1 text-lg font-semibold text-[var(--color-brand-text-primary)] font-mono-numbers">
              {formatCurrency(totalIncome, currency, true)}
            </p>
          ) : (
            <button
              type="button"
              onClick={onAddIncome}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-amber)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-brand-amber)] hover:bg-[var(--color-brand-amber)]/20 transition-colors"
            >
              <CirclePlus className="h-3.5 w-3.5" />
              Add your income
            </button>
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            {labels.totalPlanned}
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--color-brand-text-primary)] font-mono-numbers">
            {formatCurrency(totalPlanned, currency, true)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
            {labels.projectedSavings}
          </p>
          {hasIncome ? (
            <p
              className={`mt-1 text-lg font-semibold font-mono-numbers ${
                projectedSavings >= 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'
              }`}
            >
              {savingsStr}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--color-brand-text-muted)]">
              Add income to see projected savings
            </p>
          )}
        </div>
      </div>
      {hasIncome && (
        <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed border-t border-[var(--color-brand-border)]/60 pt-4">
          {labels.projectedSavingsLine(savingsStr)}
        </p>
      )}
    </div>
  )
}
