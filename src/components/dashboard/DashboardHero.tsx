'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { addMonths, subMonths, format, parse } from 'date-fns'
import { ChevronLeft, ChevronRight, User } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useAuth } from '@/components/auth/AuthProvider'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { NotificationInbox } from '@/components/notifications/NotificationInbox'
import { ProfileDropdown } from '@/components/layout/ProfileDropdown'
import { useT } from '@/lib/i18n'
import { formatCompact } from '@/components/dashboard/categoryVisuals'
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
  /** When the first-run checklist is visible, suppress the numeric KPI zone
   *  and show a "Let's get you set up" greeting instead. */
  suppressNumbers?: boolean
}

/**
 * Blended dark hero + absorbed header for the dashboard. Replaces both the
 * old AppShell top bar and the 6-column KPI grid. All dark colors are
 * hardcoded per spec — this block is always dark regardless of theme.
 */
export function DashboardHero({ stats, suppressNumbers }: DashboardHeroProps) {
  const t = useT()
  const { monthFilter, setMonthFilter } = useSettingsStore(
    useShallow((s) => ({ monthFilter: s.monthFilter, setMonthFilter: s.setMonthFilter })),
  )

  const monthLabel = useMemo(() => {
    try {
      return format(parse(monthFilter, 'yyyy-MM', new Date()), 'MMM yyyy')
    } catch {
      return monthFilter
    }
  }, [monthFilter])

  const stepMonth = (delta: number) => {
    try {
      const base = parse(monthFilter, 'yyyy-MM', new Date())
      const next = delta > 0 ? addMonths(base, delta) : subMonths(base, -delta)
      setMonthFilter(format(next, 'yyyy-MM'))
    } catch {
      /* noop — malformed monthFilter */
    }
  }

  return (
    <section
      aria-label="Dashboard"
      className="rounded-b-3xl text-white"
      style={{
        background: 'linear-gradient(180deg,#0F172A 0%,#1E293B 100%)',
        paddingTop: 'env(safe-area-inset-top,0px)',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-3 pb-5">
        {/* ─── Header row ─── */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="shrink-0 text-xl font-bold font-heading tracking-tight text-white"
          >
            Bud<span className="text-[var(--color-brand-red)]">d</span>get
          </Link>

          <div className="flex-1 flex items-center justify-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => stepMonth(-1)}
              aria-label="Previous month"
              className="w-7 h-7 rounded-md text-white/60 hover:text-white hover:bg-white/10 inline-flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-5 h-5 rtl:rotate-180" aria-hidden />
            </button>
            <span className="text-sm text-white/45 min-w-0 truncate">{monthLabel}</span>
            <button
              type="button"
              onClick={() => stepMonth(1)}
              aria-label="Next month"
              className="w-7 h-7 rounded-md text-white/60 hover:text-white hover:bg-white/10 inline-flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-5 h-5 rtl:rotate-180" aria-hidden />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <NotificationInbox variant="dark" />
            <HeroAvatarMenu />
          </div>
        </div>

        {suppressNumbers ? (
          <div className="mt-6 pb-2">
            <p className="text-lg font-semibold text-white">{t.onboarding.coreGateTitle}</p>
            <p className="text-xs text-white/50 mt-1">{t.onboarding.coreGateSubtitle}</p>
          </div>
        ) : (
          <>
            {/* ─── Hero row: left-to-spend + ring ─── */}
            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  {t.dashboard.heroLeftToSpend}
                </p>
                <p className="mt-1 font-mono font-bold text-white text-[30px] leading-none truncate">
                  {stats.baseCurrency} {formatCompact(Math.max(0, stats.leftToSpend))}
                </p>
              </div>
              <HeroRing percent={stats.budgetUsedPercent} usedLabel={t.dashboard.heroUsedSuffix} />
            </div>

            {/* ─── Stats row ─── */}
            <div className="mt-4 pt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06]">
              <Stat label={t.dashboard.heroStatIncome} value={stats.totalIncome} color="text-white" />
              <Stat label={t.dashboard.heroStatSpent} value={stats.totalSpent} color="text-[#FCA5A5]" />
              <Stat
                label={t.dashboard.heroStatSaved}
                value={stats.savingsTotal}
                color="text-[#86EFAC]"
              />
            </div>

            {/* ─── Pace line ─── */}
            {stats.daysLeft >= 0 ? (
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-white/35">
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
      <div className={cn('font-mono font-semibold text-[14px] truncate', color)}>
        {formatCompact(Math.max(0, value))}
      </div>
      <div className="text-[10px] text-white/30 truncate">{label}</div>
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
        <span className="text-white text-[14px] font-semibold">{clamped}%</span>
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

/** Dark-styled avatar that opens the existing ProfileDropdown. Mirrors the
 *  ProfileAvatarWithMenu in AuthNavButtons but re-painted for the hero. */
function HeroAvatarMenu() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const configured = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    return !!(url && key)
  }, [])
  const profile = useFinanceStore(useShallow((s) => s.profile))
  const src = configured && !user ? null : resolveProfileAvatarSrc(profile)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-tutorial-id="profile-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full overflow-hidden border border-white/15 bg-white/10 flex items-center justify-center shrink-0 w-9 h-9 hover:ring-2 hover:ring-white/30 transition-all cursor-pointer"
        aria-label={t.nav.profileMenu}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="w-full h-full object-cover" width={36} height={36} />
        ) : (
          <User className="w-5 h-5 text-white/70" />
        )}
      </button>
      <ProfileDropdown open={open} onClose={() => setOpen(false)} containerRef={containerRef} />
    </div>
  )
}
