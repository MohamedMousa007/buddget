'use client'

import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils/formatters'
import type { BudgetCategory } from '@/lib/store/types'

const CATEGORY_ICONS: Record<string, string> = {
  Rent: '🏠',
  Transport: '🚇',
  Food: '🍕',
  Enjoyment: '🎮',
  Savings: '💰',
  Debt: '💳',
  Remittance: '💸',
  Other: '📦',
}

interface CategoryBarExpenseRowsProps {
  budgetCategories: BudgetCategory[]
  categorySpending: Record<string, number>
  categoryBudgetCaps: Record<string, number>
  currency: string
}

/**
 * Progress rows for every budget category (spent vs cap), same bar treatment for all.
 */
export function CategoryBarExpenseRows({
  budgetCategories,
  categorySpending,
  categoryBudgetCaps,
  currency,
}: CategoryBarExpenseRowsProps) {
  return (
    <div className="space-y-3">
      {budgetCategories.map((budget) => {
        const spent = categorySpending[budget.category] || 0
        const cap = categoryBudgetCaps[budget.category] ?? budget.budgetedAmount
        const percent = cap > 0 ? (spent / cap) * 100 : 0
        const clampedPercent = Math.min(percent, 100)

        const barColor =
          percent > 100
            ? 'bg-[var(--color-brand-red)]'
            : percent > 80
              ? 'bg-[var(--color-brand-amber)]'
              : 'bg-[var(--color-brand-red)]'

        const statusIcon =
          percent > 100 ? '!' : percent > 80 ? '⚠' : percent > 0 ? '✓' : '–'

        const statusColor =
          percent > 100
            ? 'text-[var(--color-brand-red)]'
            : percent > 80
              ? 'text-[var(--color-brand-amber)]'
              : 'text-[var(--color-brand-green)]'

        return (
          <div key={budget.category} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-white">
                <span>{CATEGORY_ICONS[budget.category] || '📦'}</span>
                {budget.category}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono-numbers text-[var(--color-brand-text-secondary)] text-xs">
                  {formatCurrency(spent, currency, false)} / {formatCurrency(cap, currency, false)}
                </span>
                <span className={`text-xs ${statusColor}`}>{statusIcon}</span>
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
        )
      })}
    </div>
  )
}
