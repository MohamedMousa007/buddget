'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'

interface CategoryBarSavingsTabProps {
  spentThisMonth: number
  budgetCap: number
  holdingsTotal: number
  currency: string
}

/**
 * Savings allocation vs monthly target and link to the full Savings page.
 */
export function CategoryBarSavingsTab({
  spentThisMonth,
  budgetCap,
  holdingsTotal,
  currency,
}: CategoryBarSavingsTabProps) {
  const t = useT()
  const percent = budgetCap > 0 ? (spentThisMonth / budgetCap) * 100 : 0
  const clampedPercent = Math.min(percent, 100)
  const barColor =
    percent > 100
      ? 'bg-[var(--color-brand-amber)]'
      : percent > 80
        ? 'bg-[var(--color-brand-green)]'
        : 'bg-[var(--color-brand-green)]'

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--color-brand-text-muted)] leading-relaxed">
        {t.dashboard.categorySavingsHint}
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-white">
            <span>💰</span>
            {t.categories.Savings}
          </span>
          <span className="font-mono-numbers text-[var(--color-brand-text-secondary)] text-xs">
            {formatCurrency(spentThisMonth, currency, false)} /{' '}
            {formatCurrency(budgetCap, currency, false)}
          </span>
        </div>
        <div className="h-2 bg-[var(--color-brand-border)] rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${clampedPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>
      <p className="text-xs text-[var(--color-brand-text-muted)] font-mono-numbers">
        {t.dashboard.categorySavingsHoldingsLabel}
        {formatCurrency(holdingsTotal, currency)}
      </p>
      <Link
        href="/savings"
        className="inline-block text-xs text-[var(--color-brand-red)] hover:text-[var(--color-brand-red-hover)]"
      >
        {t.dashboard.categorySavingsManageLink}
      </Link>
    </div>
  )
}
