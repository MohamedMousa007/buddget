'use client'

import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { CurrencyLabel } from '@/components/ui/CurrencyLabel'
import { cn } from '@/lib/utils'

export interface DashboardSummaryTrioProps {
  savingsTotal: number
  debtTotal: number
  netWorth: number
  baseCurrency: string
}

/**
 * Minimal-theme trio: savings / debt / net-worth in three flex-equal cards
 * at the bottom of the dashboard stack. Same tokens as every other card on
 * the page, compact type scale, accent colour per amount.
 */
export function DashboardSummaryTrio({
  savingsTotal,
  debtTotal,
  netWorth,
  baseCurrency,
}: DashboardSummaryTrioProps) {
  const t = useT()
  const activeDebtCount = useFinanceStore(useShallow((s) => s.debts.length))
  const hasDebt = debtTotal > 0 || activeDebtCount > 0

  return (
    <div className="flex gap-2">
      <Card
        label={t.dashboard.summarySavingsLabel}
        amount={savingsTotal}
        currency={baseCurrency}
        color="text-[var(--color-brand-green)]"
      />
      <Card
        label={t.dashboard.summaryDebtLabel}
        amount={debtTotal}
        currency={baseCurrency}
        color={hasDebt ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-primary)]'}
      />
      <Card
        label={t.dashboard.heroNetWorthLabel}
        amount={netWorth}
        currency={baseCurrency}
        color={netWorth >= 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'}
      />
    </div>
  )
}

function Card({
  label,
  amount,
  currency,
  color,
}: {
  label: string
  amount: number
  currency: string
  color: string
}) {
  return (
    <div
      className="flex-1 min-w-0 rounded-xl border bg-[var(--color-brand-card)] px-3 py-2.5"
      style={{ borderColor: 'var(--color-brand-border)' }}
    >
      <div className="text-[10px] uppercase tracking-[0.3px] text-[var(--color-brand-text-secondary)] font-semibold truncate">
        {label}
      </div>
      <div className={cn('mt-0.5 font-mono font-semibold text-[15px] truncate', color)}>
        <CurrencyLabel
          amount={amount}
          currency={currency}
          compact="auto"
          fullMaxChars={9}
        />
      </div>
    </div>
  )
}
