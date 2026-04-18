'use client'

import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { formatCompact } from '@/components/dashboard/categoryVisuals'

export interface DashboardSummaryCardsProps {
  savingsTotal: number
  netSavingsThisMonth: number
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
  debtTotal,
  baseCurrency,
}: DashboardSummaryCardsProps) {
  const t = useT()
  const activeDebtCount = useFinanceStore(useShallow((s) => s.debts.length))

  return (
    <div className="flex gap-3">
      <SummaryCard
        label={t.dashboard.summarySavingsLabel}
        amount={`${baseCurrency} ${formatCompact(savingsTotal)}`}
        amountColor="#18A349"
        subtext={t.dashboard.summarySavedThisMonth(
          `${baseCurrency} ${formatCompact(Math.max(0, netSavingsThisMonth))}`,
        )}
      />
      <SummaryCard
        label={t.dashboard.summaryDebtLabel}
        amount={`${baseCurrency} ${formatCompact(debtTotal)}`}
        amountColor="#E50914"
        subtext={t.dashboard.summaryDebtActive(activeDebtCount)}
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
