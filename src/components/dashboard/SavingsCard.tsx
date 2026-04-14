'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils/formatters'
import { convertCurrency } from '@/lib/utils/currency'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { TrendingUp } from 'lucide-react'

interface SavingsCardProps {
  savingsTotal: number
  savingsAccountsTotal: number
  savingsHoldingsTotal: number
  savingsFromExpenses: number
  netSavingsTransfersThisMonth: number
  savingsBudget: number
  currency: string
}

/**
 * Dashboard summary: cumulative saved up plus optional budget progress.
 */
export function SavingsCard({
  savingsTotal,
  savingsAccountsTotal,
  savingsHoldingsTotal,
  savingsFromExpenses,
  netSavingsTransfersThisMonth,
  savingsBudget,
  currency,
}: SavingsCardProps) {
  const t = useT()
  const { settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, exchangeRates: s.exchangeRates }))
  )
  const secondary = settings.showSecondaryCurrency ? settings.secondaryCurrency : null
  const percent = savingsBudget > 0 ? (savingsFromExpenses / savingsBudget) * 100 : 0

  const secondarySavings = secondary
    ? convertCurrency(savingsTotal, currency, secondary, exchangeRates)
    : null

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-brand-green)]" />
          <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
            {t.dashboard.savingsTitle}
          </h3>
        </div>
        <Link
          href="/savings"
          className="text-xs text-[var(--color-brand-red)] hover:text-[var(--color-brand-red-hover)]"
        >
          {t.dashboard.savingsLink}
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold font-mono-numbers text-[var(--color-brand-green)]">
              {formatCurrency(savingsTotal, currency)}
            </p>
            {secondarySavings != null && (
              <p className="text-xs text-[var(--color-brand-text-muted)] font-mono-numbers">
                ({formatCurrency(secondarySavings, secondary!)})
              </p>
            )}
            <p className="text-xs text-[var(--color-brand-text-muted)]">
              {t.dashboard.savingsSubAccounts}
              {formatCurrency(savingsAccountsTotal, currency)}
              {savingsHoldingsTotal > 0.0001 && (
                <>
                  {t.dashboard.savingsDotSeparator}
                  {t.dashboard.savingsSubLegacy}
                  {formatCurrency(savingsHoldingsTotal, currency)}
                </>
              )}
              {savingsFromExpenses > 0.0001 && (
                <>
                  {t.dashboard.savingsDotSeparator}
                  {t.dashboard.savingsSubExpensesTagged}
                  {formatCurrency(savingsFromExpenses, currency)}
                </>
              )}
            </p>
            {Math.abs(netSavingsTransfersThisMonth) > 0.0001 && (
              <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5">
                {t.dashboard.savingsNetLedgerMonth}
                {formatCurrency(netSavingsTransfersThisMonth, currency)}
              </p>
            )}
            <p className="text-xs text-[var(--color-brand-text-muted)] mt-1">
              {t.dashboard.savingsMonthlyTarget}
              {formatCurrency(savingsBudget, currency)}
            </p>
          </div>
          <span className="text-sm font-mono-numbers text-[var(--color-brand-text-secondary)]">
            {Math.round(percent)}%
          </span>
        </div>

        <div className="h-2 bg-[var(--color-brand-border)] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[var(--color-brand-green)]"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percent, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}
