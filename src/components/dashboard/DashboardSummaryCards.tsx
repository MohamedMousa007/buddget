'use client'

import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { formatCompact } from '@/components/dashboard/categoryVisuals'

export interface DashboardSummaryCardsProps {
  /** Lifetime cumulative savings — kept for non-summary breakdowns. */
  savingsTotal: number
  /** Net ledger transfers in the active month — secondary line. */
  netSavingsThisMonth: number
  /** Active month savings figure: projected during month, realized after close. */
  savingsThisMonth: number
  /** True once the active month is in the past (monthFilter < current). */
  monthClosed: boolean
  debtTotal: number
  baseCurrency: string
}

/**
 * Two side-by-side cards directly under the transactions list: savings total
 * (green) and outstanding debt (red). Reads active-debts count from the
 * store so the subtext stays accurate even when debt totals haven't refreshed.
 */
export function DashboardSummaryCards({
  savingsTotal,
  netSavingsThisMonth,
  savingsThisMonth,
  monthClosed,
  debtTotal,
  baseCurrency,
}: DashboardSummaryCardsProps) {
  const t = useT()
  const activeDebtCount = useFinanceStore(useShallow((s) => s.debts.length))
  void savingsTotal // lifetime figure is shown elsewhere; props kept for compat.

  // Debt card colour stays neutral at zero so empty-state dashboards don't
  // look alarming; flips to brand red only when the user actually has debt.
  const hasDebt = debtTotal > 0 || activeDebtCount > 0
  const debtColor = hasDebt ? '#E50914' : 'var(--color-brand-text-primary)'
  const debtSubtext = hasDebt
    ? t.dashboard.summaryDebtActive(activeDebtCount)
    : t.dashboard.summaryDebtActiveNone

  return (
    <div className="flex gap-3">
      <SummaryCard
        label={
          monthClosed
            ? t.dashboard.summarySavedLabel
            : t.dashboard.summaryProjectedSavingsLabel
        }
        amount={`${baseCurrency} ${formatCompact(savingsThisMonth)}`}
        amountColor="#18A349"
        subtext={
          monthClosed
            ? t.dashboard.summarySavedActualSubtext
            : t.dashboard.summaryProjectedSavingsSubtext(
                `${baseCurrency} ${formatCompact(Math.max(0, netSavingsThisMonth))}`,
              )
        }
      />
      <SummaryCard
        label={t.dashboard.summaryDebtLabel}
        amount={`${baseCurrency} ${formatCompact(debtTotal)}`}
        amountColor={debtColor}
        subtext={debtSubtext}
      />
    </div>
  )
}

function SummaryCard({
  label,
  amount,
  amountColor,
  subtext,
}: {
  label: string
  amount: string
  amountColor: string
  subtext: string
}) {
  return (
    <div className="flex-1 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3">
      <div className="text-[9px] uppercase tracking-wider text-[var(--color-brand-text-secondary)] font-semibold">
        {label}
      </div>
      <div
        className="mt-1 font-mono font-semibold text-[15px] tabular-nums truncate"
        style={{ color: amountColor }}
      >
        {amount}
      </div>
      <div className="text-[10px] text-[var(--color-brand-text-secondary)] mt-0.5 truncate">
        {subtext}
      </div>
    </div>
  )
}
