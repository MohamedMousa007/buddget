'use client'

import { useT } from '@/lib/i18n'
import { CurrencyLabel } from '@/components/ui/CurrencyLabel'
import { cn } from '@/lib/utils'

export interface DashboardStatsRowProps {
  totalIncome: number
  totalSpent: number
  savingsTotal: number
  baseCurrency: string
}

/**
 * Minimal-theme stat row: three centred columns (in / out / saved) sitting
 * directly on the page background, separated by 1px hairline dividers, with
 * a subtle `border-bottom` to mark where the row ends and the category card
 * begins.
 */
export function DashboardStatsRow({
  totalIncome,
  totalSpent,
  savingsTotal,
  baseCurrency,
}: DashboardStatsRowProps) {
  const t = useT()
  return (
    <div
      className="flex items-stretch justify-center py-3 mb-3"
      style={{ borderBottom: '0.5px solid var(--color-brand-border)' }}
    >
      <Stat
        label={t.dashboard.heroStatIn}
        amount={totalIncome}
        currency={baseCurrency}
        color="text-[var(--color-brand-text-primary)]"
      />
      <Divider />
      <Stat
        label={t.dashboard.heroStatOut}
        amount={totalSpent}
        currency={baseCurrency}
        color="text-[var(--color-brand-red)]"
      />
      <Divider />
      <Stat
        label={t.dashboard.heroStatSaved}
        amount={savingsTotal}
        currency={baseCurrency}
        color="text-[var(--color-brand-green)]"
      />
    </div>
  )
}

function Stat({
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
    <div className="flex-1 min-w-0 text-center px-3">
      <div
        className={cn(
          'font-mono font-semibold text-base leading-none truncate',
          color,
        )}
      >
        <CurrencyLabel
          amount={Math.max(0, amount)}
          currency={currency}
          compact="auto"
          fullMaxChars={10}
        />
      </div>
      <div className="text-[10px] text-[var(--color-brand-text-secondary)] mt-1 lowercase">
        {label.toLowerCase()}
      </div>
    </div>
  )
}

function Divider() {
  return (
    <span
      aria-hidden
      className="shrink-0 self-stretch mx-1"
      style={{ width: '1px', background: 'var(--color-brand-border)' }}
    />
  )
}
