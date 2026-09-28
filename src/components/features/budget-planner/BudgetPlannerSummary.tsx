'use client'

import { CirclePlus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'
import { microClassName } from '@/lib/ui/microLabelStyle'
import type { Currency } from '@/lib/store/types'
import { Button } from '@/components/ui/button'

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
    projectedSavingsLine: (amount: string, savingsRatePercent: number) => string
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
  const savingsRatePercent =
    hasIncome && totalIncome > 0
      ? Math.max(0, Math.min(100, Math.round((projectedSavings / totalIncome) * 100)))
      : 0
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-gradient-to-br from-[var(--color-brand-elevated)]/90 to-[var(--color-brand-card)] p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className={microClassName}>
            {labels.totalIncome}
          </p>
          {hasIncome ? (
            <p className="mt-1 text-lg font-semibold text-[var(--color-brand-text-primary)] font-mono-numbers">
              {formatCurrency(totalIncome, currency, true)}
            </p>
          ) : (
            <Button
              variant="ghost"
              size="touch"
              onClick={onAddIncome}
              className="mt-1 bg-[var(--color-brand-amber)]/10 text-xs text-[var(--color-brand-amber)] hover:bg-[var(--color-brand-amber)]/20"
            >
              <CirclePlus className="h-3.5 w-3.5" />
              Add your income
            </Button>
          )}
        </div>
        <div>
          <p className={microClassName}>
            {labels.totalPlanned}
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--color-brand-text-primary)] font-mono-numbers">
            {formatCurrency(totalPlanned, currency, true)}
          </p>
        </div>
        <div>
          <p className={microClassName}>
            {labels.projectedSavings}
          </p>
          {hasIncome ? (
            <p
              className={`mt-1 text-lg font-semibold font-mono-numbers ${
                projectedSavings >= 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red-text)]'
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
          {labels.projectedSavingsLine(savingsStr, savingsRatePercent)}
        </p>
      )}
    </div>
  )
}
