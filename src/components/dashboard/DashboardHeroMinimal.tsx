'use client'

import { useT } from '@/lib/i18n'
import { CurrencyLabel } from '@/components/ui/CurrencyLabel'
import type { PaceStatus } from '@/lib/utils/spendingPace'

export interface DashboardHeroMinimalStats {
  leftToSpend: number
  dailyRate: number
  paceStatus: PaceStatus
  daysLeft: number
  baseCurrency: string
}

export interface DashboardHeroMinimalProps {
  stats: DashboardHeroMinimalStats
}

/**
 * Minimal hero: centred "LEFT TO SPEND" label + big mono value directly on
 * the page background (no card, no border), followed by a coloured pace
 * pill that summarises daily pace + remaining days. Lives only in the
 * Minimal theme's dashboard stack — the standard theme keeps the navy
 * `DashboardHero` card.
 */
export function DashboardHeroMinimal({ stats }: DashboardHeroMinimalProps) {
  const t = useT()

  const tone = paceTone(stats.paceStatus)
  const statusLabel = paceLabel(stats.paceStatus, t)

  return (
    <div className="py-4 text-center">
      <p className="text-[11px] uppercase tracking-[0.5px] text-[var(--color-brand-text-secondary)] font-medium">
        {t.dashboard.heroLeftToSpend}
      </p>
      <p className="mt-1 font-mono font-bold text-[36px] leading-none text-[var(--color-brand-text-primary)]">
        <CurrencyLabel
          amount={Math.max(0, stats.leftToSpend)}
          currency={stats.baseCurrency}
          compact="auto"
          fullMaxChars={12}
        />
      </p>

      {stats.daysLeft >= 0 ? (
        <div
          className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-md text-[11px] font-medium"
          style={{ background: tone.bg, color: tone.fg }}
        >
          <span
            aria-hidden
            className="w-[5px] h-[5px] rounded-full shrink-0"
            style={{ background: tone.fg }}
          />
          <span>{statusLabel}</span>
          <span className="opacity-70">·</span>
          <CurrencyLabel
            amount={Math.max(0, stats.dailyRate)}
            currency={stats.baseCurrency}
            compact="auto"
            fullMaxChars={8}
          />
          <span className="opacity-70">/day</span>
          <span className="opacity-70">·</span>
          <span>{t.dashboard.heroPaceDaysLeft(stats.daysLeft)}</span>
        </div>
      ) : null}
    </div>
  )
}

function paceTone(status: PaceStatus): { bg: string; fg: string } {
  if (status === 'on_track') return { bg: 'var(--color-status-ok-bg)',      fg: 'var(--color-status-ok-fg)' }
  if (status === 'warning')  return { bg: 'var(--color-status-warn-bg)',    fg: 'var(--color-status-warn-fg)' }
  return                            { bg: 'var(--color-status-danger-bg)',  fg: 'var(--color-status-danger-fg)' }
}

function paceLabel(status: PaceStatus, t: ReturnType<typeof useT>): string {
  if (status === 'on_track') return t.dashboard.paceOnTrack
  if (status === 'warning') return t.dashboard.paceWarning
  return t.dashboard.paceOver
}
