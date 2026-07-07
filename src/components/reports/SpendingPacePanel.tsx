'use client'

import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import type { PaceStatus, OverspentCategory } from '@/lib/utils/spendingPace'

interface SpendingPacePanelProps {
  dailyRate: number
  projectedSpend: number
  totalExpenseBudget: number
  paceStatus: PaceStatus
  suggestedDaily: number
  overBudgetCategories: OverspentCategory[]
  currency: string
}

const statusColor: Record<PaceStatus, string> = {
  on_track: 'text-[var(--color-brand-green)]',
  warning: 'text-[var(--color-brand-amber)]',
  over: 'text-[var(--color-brand-red)]',
}

const badgeBg: Record<PaceStatus, string> = {
  on_track: 'bg-[var(--color-brand-green)]/15 text-[var(--color-brand-green)]',
  warning: 'bg-[var(--color-brand-amber)]/15 text-[var(--color-brand-amber)]',
  over: 'bg-[var(--color-brand-red)]/15 text-[var(--color-brand-red)]',
}

/**
 * Spending pace card for the reports page.
 * Shows daily rate, projected spend vs budget, and categories to watch.
 */
export function SpendingPacePanel({
  dailyRate,
  projectedSpend,
  totalExpenseBudget,
  paceStatus,
  suggestedDaily,
  overBudgetCategories,
  currency,
}: SpendingPacePanelProps) {
  const t = useT()

  const paceLabel =
    paceStatus === 'on_track'
      ? t.reports.paceOnTrack
      : paceStatus === 'warning'
        ? t.reports.paceWarning
        : t.reports.paceOver

  const barPercent = totalExpenseBudget > 0
    ? Math.min((projectedSpend / totalExpenseBudget) * 100, 100)
    : 0

  const barColor =
    paceStatus === 'over'
      ? 'var(--color-brand-red)'
      : paceStatus === 'warning'
        ? 'var(--color-brand-amber)'
        : 'var(--color-brand-green)'

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.reports.spendingPaceTitle}
        </h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeBg[paceStatus]}`}>
          {paceLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)] mb-0.5">{t.reports.avgDailySpend}</p>
          <p className={`text-lg font-semibold font-mono-numbers ${statusColor[paceStatus]}`}>
            {formatCurrency(dailyRate, currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-brand-text-muted)] mb-0.5">{t.reports.projectedTotal}</p>
          <p className={`text-lg font-semibold font-mono-numbers ${statusColor[paceStatus]}`}>
            {formatCurrency(projectedSpend, currency)}
          </p>
        </div>
      </div>

      {/* Projected vs budget bar */}
      {totalExpenseBudget > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[var(--color-brand-text-muted)]">
            <span>{t.reports.projectedTotal}</span>
            <span>{formatCurrency(totalExpenseBudget, currency)}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-brand-border)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${barPercent}%`, backgroundColor: barColor }}
            />
          </div>
        </div>
      )}

      {paceStatus !== 'on_track' && suggestedDaily > 0 && (
        <p className="text-xs text-[var(--color-brand-text-muted)] text-center">
          {t.reports.suggestedDailyLabel.replace('{amount}', formatCurrency(suggestedDaily, currency))}
        </p>
      )}

      {overBudgetCategories.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--color-brand-text-secondary)]">{t.reports.categoriesToWatch}</p>
          <div className="space-y-1.5">
            {overBudgetCategories.map((c) => (
              <div key={c.category} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-[var(--color-brand-text-primary)]">
                  {c.icon && <span>{c.icon}</span>}
                  {c.category}
                </span>
                <span className="font-mono-numbers text-[var(--color-brand-red)]">
                  {formatCurrency(c.spent, currency)} / {formatCurrency(c.cap, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
