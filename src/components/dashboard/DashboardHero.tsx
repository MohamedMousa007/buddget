'use client'

import { useT } from '@/lib/i18n'
import { formatCompact } from '@/components/dashboard/categoryVisuals'
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
 * Standalone navy "summary" card — the dashboard's first visual. Absorbs the
 * former 6-col KPI grid into a single block: left-to-spend + 60×60 budget
 * ring + three-way stats row + pace line. Rendered inside the regular
 * content column (the AppShell top bar stays above it), so the card has all
 * four corners rounded and sits inset like any other card on the page.
 *
 * All dark-surface colours are hardcoded per spec — this block stays navy
 * regardless of the user's light/dark preference.
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
                  {stats.baseCurrency} {formatCompact(Math.max(0, stats.leftToSpend))}
                </p>
              </div>
              <HeroRing percent={stats.budgetUsedPercent} usedLabel={t.dashboard.heroUsedSuffix} />
            </div>

            {/* Stats row */}
            <div className="mt-5 pt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06]">
              <Stat label={t.dashboard.heroStatIncome} value={stats.totalIncome} color="text-white" />
              <Stat label={t.dashboard.heroStatSpent} value={stats.totalSpent} color="text-[#FCA5A5]" />
              <Stat
                label={t.dashboard.heroStatSaved}
                value={stats.savingsTotal}
                color="text-[#86EFAC]"
              />
            </div>

            {/* Pace line */}
            {stats.daysLeft >= 0 ? (
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-white/40">
                <span
                  className="w-[5px] h-[5px] rounded-full shrink-0"
                  style={{ background: paceDotColor(stats.paceStatus) }}
                  aria-hidden
                />
                <span className="truncate">
                  {t.dashboard.heroPace(
                    `${stats.baseCurrency} ${formatCompact(stats.dailyRate)}`,
                    paceLabel(stats.paceStatus, t),
                    stats.daysLeft,
                  )}
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="min-w-0">
      <div className={cn('font-mono font-bold text-[14px] truncate', color)}>
        {formatCompact(Math.max(0, value))}
      </div>
      <div className="text-[10px] text-white/30 truncate mt-0.5">{label}</div>
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
          stroke="rgba(255,255,255,0.08)"
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
        <span className="text-white text-[14px] font-bold">{clamped}%</span>
        <span className="text-white/50 text-[8px] mt-0.5">{usedLabel}</span>
      </div>
    </div>
  )
}

function paceDotColor(status: PaceStatus): string {
  if (status === 'over') return '#FCA5A5'
  if (status === 'warning') return '#FCD34D'
  return '#86EFAC'
}

function paceLabel(status: PaceStatus, t: ReturnType<typeof useT>): string {
  if (status === 'over') return t.dashboard.paceOver
  if (status === 'warning') return t.dashboard.paceWarning
  return t.dashboard.paceOnTrack
}
