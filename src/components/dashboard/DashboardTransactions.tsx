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
}

const MAX_ROWS = 5
const EXPENSE_COLOR = '#E50914'
const INCOME_COLOR = '#18A349'

/**
 * "Latest transactions" card. Shows the 5 most recent entries from the
 * month's expenses, sorted by `date` descending. Each row gets an initial-
 * letter chip tinted by category, description + `category · method` sub-
 * line, and a right-aligned amount + relative date.
 *
 * The store provides `monthlyExpenses` pre-scoped to the current month, so
 * this component doesn't fetch or filter by date; it just slices.
 */
export function DashboardTransactions({ expenses }: DashboardTransactionsProps) {
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
        <ul className="space-y-3">
          {rows.map((expense) => (
            <TxRow
              key={expense.id}
              expense={expense}
              methodName={paymentMethodNameById[expense.paymentMethodId] ?? ''}
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

function TxRow({ expense, methodName }: { expense: Expense; methodName: string }) {
  const t = useT()
  const palette = getCategoryPalette(expense.category)
  const initial = (expense.description || expense.category || '?').charAt(0).toUpperCase()
  // Treat savings-tagged rows as "green credit" so users see a visual contrast;
  // everything else is spend-red.
  const amountColor = expense.category.toLowerCase() === 'savings' ? INCOME_COLOR : EXPENSE_COLOR
  const sign = expense.category.toLowerCase() === 'savings' ? '+' : '-'

  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden
        className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[12px] font-semibold shrink-0"
        style={{ background: palette.bg, color: palette.text }}
      >
        {initial}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[var(--color-brand-text-primary)] truncate">
          {expense.description || expense.category}
        </p>
        <p className="text-[10px] text-[var(--color-brand-text-secondary)] truncate">
          {expense.category}
          {methodName ? ` · ${methodName}` : null}
        </p>
      </div>
      <div className="text-end shrink-0">
        <div
          className="text-[12px] font-mono font-medium tabular-nums"
          style={{ color: amountColor }}
        >
          {sign}
          {formatCompact(expense.amount)}
        </div>
        <div className="text-[9px] text-[var(--color-brand-text-muted)] mt-0.5">
          {relativeDate(expense.date, t)}
        </div>
      </div>
    </li>
  )
}
