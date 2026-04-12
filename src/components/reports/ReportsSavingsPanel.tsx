'use client'

import { useMemo } from 'react'
import { isWithinInterval, parseISO } from 'date-fns'
import type { SavingsTransaction } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import type { Currency } from '@/lib/store/types'

export interface ReportsSavingsPanelProps {
  transactions: SavingsTransaction[]
  startDate: Date
  endDate: Date
  baseCurrency: Currency
  exchangeRates: Record<string, number>
}

/**
 * Savings ledger totals for the selected report period (separate from expenses).
 */
export function ReportsSavingsPanel({
  transactions,
  startDate,
  endDate,
  baseCurrency,
  exchangeRates,
}: ReportsSavingsPanelProps) {
  const t = useT()
  const { deposits, withdrawals } = useMemo(() => {
    let d = 0
    let w = 0
    for (const tx of transactions) {
      const day = parseISO(tx.date.length > 10 ? tx.date : `${tx.date}T12:00:00`)
      if (!isWithinInterval(day, { start: startDate, end: endDate })) continue
      const v = convertCurrency(tx.amount, tx.currency, baseCurrency, exchangeRates)
      if (tx.type === 'deposit') d += v
      else w += v
    }
    return { deposits: d, withdrawals: w }
  }, [transactions, startDate, endDate, baseCurrency, exchangeRates])

  return (
    <section className="glass-card rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
        {t.reports.savingsSectionTitle}
      </h2>
      <p className="text-xs text-[var(--color-brand-text-muted)]">{t.reports.moneyFlowHint}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3">
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.reports.savingsDeposits}</p>
          <p className="text-lg font-mono-numbers text-[var(--color-brand-green)]">
            {formatCurrency(deposits, baseCurrency)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3">
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.reports.savingsWithdrawals}</p>
          <p className="text-lg font-mono-numbers text-[var(--color-brand-amber)]">
            {formatCurrency(withdrawals, baseCurrency)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3">
          <p className="text-xs text-[var(--color-brand-text-muted)]">{t.reports.savingsNet}</p>
          <p className="text-lg font-mono-numbers text-[var(--color-brand-text-primary)]">
            {formatCurrency(deposits - withdrawals, baseCurrency)}
          </p>
        </div>
      </div>
    </section>
  )
}
