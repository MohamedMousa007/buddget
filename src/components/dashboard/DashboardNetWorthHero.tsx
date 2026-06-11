'use client'

import { CurrencyLabel } from '@/components/ui/CurrencyLabel'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

export interface DashboardNetWorthHeroProps {
  netWorth: number
  monthlyFlow: number
  totalSavings: number
  totalDebt: number
  baseCurrency: string
}

/**
 * Secondary summary card — NET WORTH headline on the left, SAVINGS + DEBT
 * as smaller stacked stats on the right. Uses the standard dashboard card
 * tokens (`--color-brand-card` + border) so it visually sits with the other
 * sections; the primary hero keeps its distinct navy gradient.
 */
export function DashboardNetWorthHero({
  netWorth,
  monthlyFlow,
  totalSavings,
  totalDebt,
  baseCurrency,
}: DashboardNetWorthHeroProps) {
  const t = useT()
  const flowSign = monthlyFlow >= 0 ? '+' : '\u2212' // unicode minus for alignment

  return (
    <section
      aria-label="Net worth summary"
      className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Net worth headline */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-secondary)] font-medium">
            {t.dashboard.heroNetWorthLabel}
          </p>
          <p
            className={cn(
              'mt-1 font-mono font-bold text-[26px] leading-none truncate',
              netWorth >= 0
                ? 'text-[var(--color-brand-text-primary)]'
                : 'text-[var(--color-brand-red)]',
            )}
          >
            <CurrencyLabel
              amount={netWorth}
              currency={baseCurrency}
              compact="auto"
              fullMaxChars={11}
            />
          </p>
          <p className="mt-1 text-[10px] text-[var(--color-brand-text-muted)]">
            {flowSign}
            <CurrencyLabel
              amount={Math.abs(monthlyFlow)}
              currency={baseCurrency}
              compact="auto"
              fullMaxChars={9}
            />
            <span className="ms-1">{t.dashboard.netWorthThisMonth}</span>
          </p>
        </div>

        {/* Side stats: SAVINGS + DEBT */}
        <div className="flex items-start gap-6 shrink-0">
          <SideStat
            label={t.dashboard.heroStatSavings}
            amount={totalSavings}
            currency={baseCurrency}
            color="text-[var(--color-brand-green)]"
          />
          <SideStat
            label={t.dashboard.heroStatDebt}
            amount={totalDebt}
            currency={baseCurrency}
            color="text-[var(--color-brand-gold)]"
          />
        </div>
      </div>
    </section>
  )
}

function SideStat({
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
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-secondary)] font-medium">
        {label}
      </p>
      <p className={cn('mt-1 font-mono font-bold text-[18px] leading-none truncate', color)}>
        <CurrencyLabel
          amount={Math.max(0, amount)}
          currency={currency}
          compact="auto"
          fullMaxChars={9}
        />
      </p>
    </div>
  )
}
