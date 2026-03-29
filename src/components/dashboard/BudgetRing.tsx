'use client'

import { motion } from 'framer-motion'
import { formatCurrency, formatPercent } from '@/lib/utils/formatters'
import { convertCurrency } from '@/lib/utils/currency'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

interface BudgetRingProps {
  percent: number
  remaining: number
  currency: string
  daysLeft: number
  /** When set, explains why budget totals are empty (no income declared). */
  incomeBlockedNote?: string | null
}

export function BudgetRing({ percent, remaining, currency, daysLeft, incomeBlockedNote }: BudgetRingProps) {
  const { settings, exchangeRates } = useFinanceStore()
  const secondary = settings.showSecondaryCurrency ? settings.secondaryCurrency : null

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
      ? 'A little over — let\'s adjust'
      : percent > 80
        ? 'CLOSE TO PLAN'
        : '✨ You\'re ahead of plan'

  const statusColor =
    percent > 100
      ? 'text-[var(--color-brand-red)]'
      : percent > 80
        ? 'text-[var(--color-brand-amber)]'
        : 'text-[var(--color-brand-green)]'

  const secondaryRemaining = secondary
    ? convertCurrency(Math.abs(remaining), currency, secondary, exchangeRates)
    : null

  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col items-center">
      {incomeBlockedNote ? (
        <p className="text-[11px] text-amber-200/90 text-center mb-3 px-1 leading-snug">{incomeBlockedNote}</p>
      ) : null}
      <div className="relative w-[200px] h-[200px]">
        <svg
          className="transform -rotate-90"
          width="200"
          height="200"
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
          <span className="text-3xl font-bold font-mono-numbers text-white">
            {formatPercent(percent)}
          </span>
          <span className="text-xs text-[var(--color-brand-text-secondary)] mt-1">
            of your monthly plan used
          </span>
        </div>
      </div>

      <div className="mt-4 text-center space-y-1">
        <p className="text-lg font-semibold font-mono-numbers text-white">
          {formatCurrency(Math.abs(remaining), currency)} {remaining >= 0 ? 'still yours to spend' : 'over plan'}
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
          {daysLeft} days left to finish strong
        </p>
      </div>
    </div>
  )
}
