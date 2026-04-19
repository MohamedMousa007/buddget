'use client'

import { CurrencyLabel } from '@/components/ui/CurrencyLabel'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

export interface DashboardNetWorthHeroProps {
  netWorth: number
  totalSavings: number
  totalDebt: number
  baseCurrency: string
}

/**
 * Secondary dark hero that sits under the primary left-to-spend card. Shows
 * the three balance-sheet aggregates (net worth, savings, debt) as a big
 * headline number + two coloured stats under a hairline divider. Reuses the
 * same navy gradient + typography as `DashboardHero` so the two cards feel
 * like a pair.
 */
export function DashboardNetWorthHero({
  netWorth,
  totalSavings,
  totalDebt,
  baseCurrency,
}: DashboardNetWorthHeroProps) {
  const t = useT()

  return (
    <section
      aria-label="Net worth summary"
      className="rounded-3xl text-white overflow-hidden shadow-[0_10px_30px_-12px_rgba(15,23,42,0.25)]"
      style={{ background: 'linear-gradient(180deg,#0F172A 0%,#1E293B 100%)' }}
    >
      <div className="px-5 py-5">
        {/* Net-worth headline */}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-white/60 font-medium">
            {t.dashboard.heroNetWorthLabel}
          </p>
          <p
            className={cn(
              'mt-1 font-mono font-bold text-[28px] leading-none truncate',
              netWorth >= 0 ? 'text-[#86EFAC]' : 'text-[#FCA5A5]',
            )}
          >
            <CurrencyLabel
              amount={netWorth}
              currency={baseCurrency}
              compact="auto"
              fullMaxChars={12}
            />
          </p>
        </div>

        {/* Two-column breakdown row */}
        <div className="mt-4 pt-4 grid grid-cols-2 divide-x divide-white/[0.06] border-t border-white/[0.06]">
          <SecondaryStat
            label={t.dashboard.heroStatSavings}
            amount={totalSavings}
            currency={baseCurrency}
            color="text-[#22C55E]"
          />
          <SecondaryStat
            label={t.dashboard.heroStatDebt}
            amount={totalDebt}
            currency={baseCurrency}
            color="text-[#EF4444]"
          />
        </div>
      </div>
    </section>
  )
}

function SecondaryStat({
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
    <div className="min-w-0 text-center px-2">
      <div className={cn('font-mono font-bold text-[16px] leading-none truncate', color)}>
        <CurrencyLabel
          amount={Math.max(0, amount)}
          currency={currency}
          compact="auto"
          fullMaxChars={10}
        />
      </div>
      <div className="text-[10px] text-white/70 truncate mt-1 uppercase tracking-wider">
        {label}
      </div>
    </div>
  )
}
