'use client'

import { Check, TrendingDown } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { formatMoneyHero } from '@/lib/utils/formatters'
import type { PaceStatus, OverspentCategory } from '@/lib/utils/spendingPace'

export interface DashboardPaceBadgeProps {
  paceStatus: PaceStatus
  dailyRate: number
  suggestedDaily: number
  daysLeft: number
  baseCurrency: string
  overBudgetCategories: OverspentCategory[]
}

/**
 * Standalone spend-pace card shown between the hero and the category wheels.
 * Surfaces the same pace signal the hero used to mumble as a one-line caption,
 * but now with a coloured tile icon + title so the user can read the state at
 * a glance. When the user is burning through budget faster than they should,
 * the badge also names the top one-or-two over-budget categories so the
 * "slow down" message is actionable.
 */
export function DashboardPaceBadge({
  paceStatus,
  dailyRate,
  suggestedDaily,
  daysLeft,
  baseCurrency,
  overBudgetCategories,
}: DashboardPaceBadgeProps) {
  const t = useT()
  if (daysLeft < 0) return null

  const tone = toneFor(paceStatus)
  const title =
    paceStatus === 'on_track'
      ? t.dashboard.paceBadgeOnTrackTitle
      : paceStatus === 'warning'
        ? t.dashboard.paceBadgeSlowDownTitle
        : t.dashboard.paceBadgeOverTitle

  const paceLabel = formatMoneyHero(Math.max(0, dailyRate), baseCurrency, {
    compact: 'auto',
    fullMaxChars: 9,
  })
  const targetLabel = formatMoneyHero(Math.max(0, suggestedDaily), baseCurrency, {
    compact: 'auto',
    fullMaxChars: 9,
  })
  const subtitle = t.dashboard.paceBadgeSubtitle(paceLabel, targetLabel, daysLeft)

  const cutBackNames =
    paceStatus !== 'on_track' && overBudgetCategories.length > 0
      ? overBudgetCategories.slice(0, 2).map((c) => c.category).join(', ')
      : ''

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] p-3"
    >
      <span
        aria-hidden
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: tone.bg, color: tone.fg }}
      >
        {paceStatus === 'on_track' ? (
          <Check className="w-4 h-4" />
        ) : (
          <TrendingDown className="w-4 h-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--color-brand-text-primary)] truncate">
          {title}
        </p>
        <p className="text-[11px] text-[var(--color-brand-text-secondary)] mt-0.5">
          {subtitle}
        </p>
        {cutBackNames ? (
          <p className="text-[11px] text-[var(--color-brand-text-muted)] mt-0.5">
            {t.dashboard.paceBadgeCutBack(cutBackNames)}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function toneFor(status: PaceStatus): { bg: string; fg: string } {
  if (status === 'on_track') return { bg: 'var(--color-status-ok-bg)',      fg: 'var(--color-status-ok-fg)' }
  if (status === 'warning')  return { bg: 'var(--color-status-warn-bg)',    fg: 'var(--color-status-warn-fg)' }
  return                            { bg: 'var(--color-status-danger-bg)',  fg: 'var(--color-status-danger-fg)' }
}
