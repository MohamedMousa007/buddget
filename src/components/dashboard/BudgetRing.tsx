'use client'

import { motion } from 'framer-motion'
import { formatCurrency, formatPercent } from '@/lib/utils/formatters'
import { convertCurrency } from '@/lib/utils/currency'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { BudgetRingNoBudget } from '@/components/dashboard/BudgetRingNoBudget'
import type { PaceStatus, OverspentCategory } from '@/lib/utils/spendingPace'

interface BudgetRingProps {
  percent: number
  remaining: number
  currency: string
  daysLeft: number
  /** When set, explains why budget totals are empty (no income declared). */
  incomeBlockedNote?: string | null
  dailyRate?: number
  projectedSpend?: number
  paceStatus?: PaceStatus
  suggestedDaily?: number
  overBudgetCategories?: OverspentCategory[]
}

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

export function BudgetRing({
  percent,
  remaining,
  currency,
  daysLeft,
  incomeBlockedNote,
  dailyRate = 0,
  projectedSpend = 0,
  paceStatus = 'on_track',
  suggestedDaily = 0,
  overBudgetCategories = [],
}: BudgetRingProps) {
  const t = useT()
  const { settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, exchangeRates: s.exchangeRates }))
  )
  const secondary = settings.showSecondaryCurrency ? settings.secondaryCurrency : null

  const noBudgetSet = percent < 0

  if (noBudgetSet) {
    return (
      <BudgetRingNoBudget
        remaining={remaining}
        currency={currency}
        daysLeft={daysLeft}
        dailyRate={dailyRate}
        projectedSpend={projectedSpend}
        paceStatus={paceStatus}
        incomeBlockedNote={incomeBlockedNote}
      />
    )
  }

  const clampedPercent = Math.min(percent, 150)
  const radius = 80
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(clampedPercent, 100) / 100) * circumference

  const ringColor =
    percent > 100
      ? 'var(--color-brand-red)'
      : percent > 80
        ? 'var(--color-brand-amber)'
        : 'var(--color-brand-green)'

  const statusText =
    percent > 100
      ? t.dashboard.statusOverBudget
      : percent > 80
        ? t.dashboard.statusCloseToBudget
        : t.dashboard.statusWithinBudget

  const statusColor =
    percent > 100
      ? 'text-[var(--color-brand-red)]'
      : percent > 80
        ? 'text-[var(--color-brand-amber)]'
        : 'text-[var(--color-brand-green)]'

  const secondaryRemaining = secondary
    ? convertCurrency(Math.abs(remaining), currency, secondary, exchangeRates)
    : null

  const paceLabel =
    paceStatus === 'on_track'
      ? t.dashboard.paceOnTrack
      : paceStatus === 'warning'
        ? t.dashboard.paceWarning
        : t.dashboard.paceOver

  const showSuggestion = paceStatus !== 'on_track' && suggestedDaily > 0

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 flex flex-col items-center">
      {incomeBlockedNote ? (
        <p className="text-[11px] text-amber-200/90 text-center mb-3 px-1 leading-snug">{incomeBlockedNote}</p>
      ) : null}

      {/* Responsive ring: 140px mobile, 200px sm+ */}
      <div className="relative w-[140px] h-[140px] sm:w-[200px] sm:h-[200px]">
        <svg
          className="transform -rotate-90 w-full h-full"
          viewBox="0 0 200 200"
        >
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="var(--color-brand-border)"
            strokeWidth="12"
          />
          <motion.circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl sm:text-3xl font-bold font-mono-numbers text-[var(--color-brand-text-primary)]">
            {formatPercent(percent)}
          </span>
          <span className="text-[10px] sm:text-xs text-[var(--color-brand-text-secondary)] mt-0.5 sm:mt-1">
            {t.dashboard.budgetUsedLabel}
          </span>
        </div>
      </div>

      <div className="mt-3 sm:mt-4 text-center space-y-1">
        <p className="text-base sm:text-lg font-semibold font-mono-numbers text-[var(--color-brand-text-primary)]">
          {formatCurrency(Math.abs(remaining), currency)} {remaining >= 0 ? t.dashboard.remainingSuffix : t.dashboard.overBudgetSuffix}
        </p>
        {secondaryRemaining != null && (
          <p className="text-xs text-[var(--color-brand-text-muted)] font-mono-numbers">
            ({formatCurrency(secondaryRemaining, secondary!)})
          </p>
        )}
        <p className={`text-sm font-medium ${statusColor} flex items-center justify-center gap-1`}>
          {percent <= 100 && '●'} {statusText}
        </p>
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          {daysLeft > 0 ? t.common.daysLeft(daysLeft) : t.dashboard.monthEnded}
        </p>
      </div>

      {/* Spending pace section */}
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

        {showSuggestion && (
          <p className="text-[11px] text-[var(--color-brand-text-muted)] text-center pt-0.5">
            {t.dashboard.suggestedDailyLabel.replace('{amount}', formatCurrency(suggestedDaily, currency))}
          </p>
        )}

        {overBudgetCategories.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1 pt-1">
            <span className="text-[10px] text-[var(--color-brand-text-muted)]">{t.dashboard.cutBackHint}:</span>
            {overBudgetCategories.map((c) => (
              <span
                key={c.category}
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-brand-red)]/10 text-[var(--color-brand-red)]"
              >
                {c.icon && <span>{c.icon}</span>}
                {c.category}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
