'use client'

import { useT } from '@/lib/i18n'
import { formatMoneyHero } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import type { PaceStatus } from '@/lib/utils/spendingPace'

export interface DashboardHeroStats {
  leftToSpend: number
  budgetUsedPercent: number
  totalIncome: number
  totalSpent: number
  savingsTotal: number
  netSavingsTransfersThisMonth: number
  dailyRate: number
  paceStatus: PaceStatus
  daysLeft: number
  baseCurrency: string
}

export interface DashboardHeroProps {
  stats: DashboardHeroStats
  /** When the first-run checklist is visible, suppress the numeric zone and
   *  show a "Let's get you set up" greeting instead of misleading zero values. */
  suppressNumbers?: boolean
}

/**
 * Standalone navy "summary" card — the dashboard's first visual.
 * - Left-to-spend big number + 60×60 budget ring on the first row.
 * - Three-column In / Out / Saved stats row with hairline dividers, each
 *   value coloured (green / red / gold) and carrying its currency symbol.
 * - Pace info is promoted to `<DashboardPaceBadge>` underneath so it can
 *   actually stand out instead of hiding as muted text at the hero's foot.
 */
export function DashboardHero({ stats, suppressNumbers }: DashboardHeroProps) {
  const t = useT()

  return (
    <section
      aria-label="Dashboard summary"
      className="rounded-3xl text-white overflow-hidden shadow-[0_10px_30px_-12px_rgba(15,23,42,0.25)]"
      style={{ background: 'linear-gradient(180deg,#0F172A 0%,#1E293B 100%)' }}
    >
      <div className="px-5 py-5">
        {suppressNumbers ? (
          <div className="py-2">
            <p className="text-lg font-semibold text-white">{t.onboarding.coreGateTitle}</p>
            <p className="text-xs text-white/50 mt-1">{t.onboarding.coreGateSubtitle}</p>
          </div>
        ) : (
          <>
            {/* Left-to-spend + ring */}
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
                  {t.dashboard.heroLeftToSpend}
                </p>
                <p className="mt-1 font-mono font-bold text-white text-[32px] leading-none truncate">
                  {formatMoneyHero(Math.max(0, stats.leftToSpend), stats.baseCurrency, {
                    compact: 'auto',
                    fullMaxChars: 11,
                  })}
                </p>
              </div>
              <HeroRing percent={stats.budgetUsedPercent} usedLabel={t.dashboard.heroUsedSuffix} />
            </div>

            {/* Stats row — In / Out / Saved with hairline dividers + currency */}
            <div className="mt-5 pt-4 border-t border-white/[0.06] grid grid-cols-3 divide-x divide-white/[0.06]">
              <Stat
                label={t.dashboard.heroStatIn}
                amount={stats.totalIncome}
                currency={stats.baseCurrency}
                color="text-[#22C55E]"
              />
              <Stat
                label={t.dashboard.heroStatOut}
                amount={stats.totalSpent}
                currency={stats.baseCurrency}
                color="text-[#EF4444]"
              />
              <Stat
                label={t.dashboard.heroStatSaved}
                amount={stats.savingsTotal}
                currency={stats.baseCurrency}
                color="text-[#FACC15]"
              />
            </div>
          </>
        )}
      </div>
    </section>
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
  // Compact threshold tuned for a 3-column grid on ~375px mobile: with multi-
  // char currency symbols ("د.إ", "E£") any value above mid-thousands needs
  // compact notation to avoid truncation.
  const value = formatMoneyHero(Math.max(0, amount), currency, {
    compact: 'auto',
    fullMaxChars: 8,
  })
  return (
    <div className="min-w-0 text-center px-1.5">
      <div className={cn('font-mono font-bold text-[15px] leading-none truncate', color)}>
        {value}
      </div>
      <div className="text-[9px] text-white/40 truncate mt-1 uppercase tracking-wider">
        {label}
      </div>
    </div>
  )
}

function HeroRing({ percent, usedLabel }: { percent: number; usedLabel: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const size = 60
  const stroke = 4.5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped / 100)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E50914"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-white text-[15px] font-semibold">{clamped}%</span>
        <span className="text-white/35 text-[8px] mt-0.5">{usedLabel}</span>
      </div>
    </div>
  )
}
