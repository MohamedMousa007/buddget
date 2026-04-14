'use client'

import { formatCurrency } from '@/lib/utils/formatters'
import { convertCurrency } from '@/lib/utils/currency'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import type { PaceStatus } from '@/lib/utils/spendingPace'

const paceColorMap: Record<PaceStatus, string> = {
  on_track: 'text-[var(--color-brand-green)]',
  warning: 'text-[var(--color-brand-amber)]',
  over: 'text-[var(--color-brand-red)]',
}

const paceDotMap: Record<PaceStatus, string> = {
  on_track: 'bg-[var(--color-brand-green)]',
  warning: 'bg-[var(--color-brand-amber)]',
  over: 'bg-[var(--color-brand-red)]',
}

const RADIUS = 80

/**
 * Ring + summary when there is spending but no expense budget total (sentinel percent −1).
 */
export function BudgetRingNoBudget({
  remaining,
  currency,
  daysLeft,
  dailyRate,
  projectedSpend,
  paceStatus,
  incomeBlockedNote,
}: {
  remaining: number
  currency: string
  daysLeft: number
  dailyRate: number
  projectedSpend: number
  paceStatus: PaceStatus
  incomeBlockedNote?: string | null
}) {
  const t = useT()
  const { settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, exchangeRates: s.exchangeRates }))
  )
  const secondary = settings.showSecondaryCurrency ? settings.secondaryCurrency : null
  const spent = Math.abs(remaining)
  const secondarySpent = secondary ? convertCurrency(spent, currency, secondary, exchangeRates) : null

  const paceLabel =
    paceStatus === 'on_track'
      ? t.dashboard.paceOnTrack
      : paceStatus === 'warning'
        ? t.dashboard.paceWarning
        : t.dashboard.paceOver

  const daysLine =
    daysLeft > 0 ? (
      <p className="text-xs text-[var(--color-brand-text-muted)]">{t.common.daysLeft(daysLeft)}</p>
    ) : (
      <p className="text-xs text-[var(--color-brand-text-muted)]">{t.dashboard.monthEnded}</p>
    )

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 flex flex-col items-center">
      {incomeBlockedNote ? (
        <p className="text-[11px] text-amber-200/90 text-center mb-3 px-1 leading-snug">{incomeBlockedNote}</p>
      ) : null}

      <div className="relative w-[140px] h-[140px] sm:w-[200px] sm:h-[200px]">
        <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            stroke="var(--color-brand-border)"
            strokeWidth="12"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
          <span className="text-lg sm:text-xl font-medium text-center text-[var(--color-brand-text-secondary)]">
            {t.dashboard.noBudgetRingLabel}
          </span>
        </div>
      </div>

      <div className="mt-3 sm:mt-4 text-center space-y-1">
        <p className="text-base sm:text-lg font-semibold font-mono-numbers text-[var(--color-brand-text-primary)]">
          {formatCurrency(spent, currency)} {t.dashboard.spentLabel}
        </p>
        {secondarySpent != null && secondary ? (
          <p className="text-xs text-[var(--color-brand-text-muted)] font-mono-numbers">
            ({formatCurrency(secondarySpent, secondary)})
          </p>
        ) : null}
        <p className="text-xs text-[var(--color-brand-text-muted)]">{t.dashboard.noBudgetHint}</p>
        {daysLine}
      </div>

      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-[var(--color-brand-border)] w-full space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-brand-text-secondary)]">{t.dashboard.paceLabel}</span>
          <span className={`font-medium flex items-center gap-1.5 ${paceColorMap[paceStatus]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${paceDotMap[paceStatus]}`} />
            {formatCurrency(dailyRate, currency)}/day — {paceLabel}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-brand-text-secondary)]">{t.dashboard.projectedLabel}</span>
          <span className={`font-mono-numbers font-medium ${paceColorMap[paceStatus]}`}>
            {formatCurrency(projectedSpend, currency)}
          </span>
        </div>
      </div>
    </div>
  )
}
