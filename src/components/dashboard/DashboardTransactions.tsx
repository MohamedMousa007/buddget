'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import {
  getCategoryPalette,
  formatCompact,
} from '@/components/dashboard/categoryVisuals'
import type { Expense } from '@/lib/store/types'

export interface DashboardTransactionsProps {
  expenses: Expense[]
  /** `'minimal'` swaps row spacing for border-top separators + a slightly
   *  larger type scale to match the Minimal theme's mockup. Defaults to
   *  `'standard'` which keeps today's styling. */
  variant?: 'standard' | 'minimal'
}

const MAX_ROWS = 5

/**
 * "Latest transactions" card. Shows the 5 most recent entries from the
 * month's expenses, sorted by `date` descending. Each row gets an initial-
 * letter chip tinted by category, description + `category · method` sub-
 * line, and a right-aligned amount + relative date.
 *
 * The store provides `monthlyExpenses` pre-scoped to the current month, so
 * this component doesn't fetch or filter by date; it just slices.
 */
export function DashboardTransactions({
  expenses,
  variant = 'standard',
}: DashboardTransactionsProps) {
  const t = useT()
  const paymentMethodNameById = useFinanceStore(
    useShallow((s) => {
      const map: Record<string, string> = {}
      for (const pm of s.paymentMethods) map[pm.id] = pm.name
      return map
    }),
  )

  const rows = useMemo<Expense[]>(() => {
    return [...expenses]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, MAX_ROWS)
  }, [expenses])

  const hasRows = rows.length > 0

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] uppercase tracking-[0.3px] text-[var(--color-brand-text-secondary)] font-semibold">
          {t.dashboard.sectionTxTitle}
        </h2>
        {hasRows ? (
          <Link
            href="/expenses"
            className="text-[11px] text-[var(--color-brand-red)] hover:underline"
          >
            {t.dashboard.sectionSeeAll}
          </Link>
        ) : null}
      </div>
      {hasRows ? (
        <ul className={variant === 'minimal' ? 'divide-y divide-black/[0.04]' : 'space-y-3'}>
          {rows.map((expense) => (
            <TxRow
              key={expense.id}
              expense={expense}
              methodName={paymentMethodNameById[expense.paymentMethodId] ?? ''}
              variant={variant}
            />
          ))}
        </ul>
      ) : (
        <div className="py-6 text-center space-y-1">
          <p className="text-xs text-[var(--color-brand-text-secondary)]">
            {t.dashboard.recentEmpty}
          </p>
          <p className="text-[11px] text-[var(--color-brand-text-muted)]">
            {t.dashboard.recentEmptyDesc}
          </p>
        </div>
      )}
    </section>
  )
}

function relativeDate(dateStr: string, t: ReturnType<typeof useT>): string {
  try {
    const d = parseISO(dateStr)
    if (isToday(d)) return t.common.today
    if (isYesterday(d)) return t.common.yesterday
    return format(d, 'MMM d')
  } catch {
    return dateStr
  }
}

function TxRow({
  expense,
  methodName,
  variant,
}: {
  expense: Expense
  methodName: string
  variant: 'standard' | 'minimal'
}) {
  const t = useT()
  const palette = getCategoryPalette(expense.category)
  const initial = (expense.description || expense.category || '?').charAt(0).toUpperCase()
  // Treat savings-tagged rows as "green credit" so users see a visual contrast;
  // everything else is spend-red.
  const amountColor = expense.category.toLowerCase() === 'savings' ? 'var(--color-brand-green)' : 'var(--color-brand-red)'
  const sign = expense.category.toLowerCase() === 'savings' ? '+' : '-'

  // Minimal variant: 13px text + border-separated rows (spacing comes from
  // the parent's `divide-y`). Standard: 12px text + `space-y-3` gap.
  const nameSize = variant === 'minimal' ? 'text-[13px]' : 'text-[12px]'
  const amountSize = variant === 'minimal' ? 'text-[13px]' : 'text-[12px]'
  const rowPad = variant === 'minimal' ? 'py-2.5' : ''

  return (
    <li className={`flex items-center gap-3 ${rowPad} rounded-lg hover:bg-[var(--color-brand-elevated)] active:opacity-70 transition-colors`}>
      <span
        aria-hidden
        className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[12px] font-semibold shrink-0"
        style={{ background: palette.bg, color: palette.text }}
      >
        {initial}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`${nameSize} font-medium text-[var(--color-brand-text-primary)] truncate`}>
          {expense.description || expense.category}
        </p>
        <p className="text-[10px] text-[var(--color-brand-text-secondary)] truncate">
          {expense.category}
          {methodName ? ` · ${methodName}` : null}
        </p>
      </div>
      <div className="text-end shrink-0">
        <div
          className={`${amountSize} font-mono font-medium tabular-nums`}
          style={{ color: amountColor }}
        >
          {sign}
          {formatCompact(expense.amount)}
        </div>
        <div className="text-[10px] text-[var(--color-brand-text-muted)] mt-0.5">
          {relativeDate(expense.date, t)}
        </div>
      </div>
    </li>
  )
}
