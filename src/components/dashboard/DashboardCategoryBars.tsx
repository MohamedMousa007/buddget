'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowRight, AlertTriangle, Check } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  getCategoryPalette,
  formatCompact,
} from '@/components/dashboard/categoryVisuals'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import type { BudgetCategory } from '@/lib/store/types'

export interface DashboardCategoryBarsProps {
  budgetCategories: BudgetCategory[]
  categorySpending: Record<string, number>
  categoryBudgetCaps: Record<string, number>
}

interface RowDatum {
  category: string
  spent: number
  cap: number
  pct: number
}

function ringColor(pct: number): string {
  if (pct > 80) return 'var(--color-brand-red)'
  if (pct > 60) return 'var(--color-brand-amber)'
  return 'var(--color-brand-green)'
}

/**
 * "Spending by category" compact card. Renders every budgeted category as a
 * circular wheel — icon inside, colour-coded progress ring around — so the
 * user can scan the whole budget at a glance instead of reading a stack of
 * linear bars. Horizontally scrollable on mobile; wraps into a grid on
 * larger screens. A coloured status chip at the top announces the overall
 * budget health.
 */
export function DashboardCategoryBars({
  budgetCategories,
  categorySpending,
  categoryBudgetCaps,
}: DashboardCategoryBarsProps) {
  const t = useT()

  const rows = useMemo<RowDatum[]>(() => {
    return budgetCategories
      .filter((b) => (categoryBudgetCaps[b.category] ?? 0) > 0)
      .map((b) => {
        const cap = categoryBudgetCaps[b.category] ?? 0
        const spent = categorySpending[b.category] ?? 0
        const pct = cap > 0 ? (spent / cap) * 100 : 0
        return { category: b.category, spent, cap, pct }
      })
      .sort((a, b) => b.pct - a.pct)
  }, [budgetCategories, categoryBudgetCaps, categorySpending])

  const status = useMemo(() => {
    if (rows.length === 0) return null
    const over = rows.filter((r) => r.pct > 100)
    if (over.length > 0) {
      return {
        tone: 'over' as const,
        text: t.dashboard.categoryStatusOver(
          over.slice(0, 2).map((r) => r.category).join(', '),
        ),
      }
    }
    const near = rows.find((r) => r.pct > 80)
    if (near) {
      return {
        tone: 'near' as const,
        text: t.dashboard.categoryStatusNearLimit(near.category),
      }
    }
    return { tone: 'ok' as const, text: t.dashboard.categoryStatusAllWithin }
  }, [rows, t])

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-xs uppercase tracking-[0.3px] text-[var(--color-brand-text-secondary)] font-semibold shrink-0">
          {t.dashboard.sectionCategoriesTitle}
        </h2>
        {status ? <StatusChip tone={status.tone} text={status.text} /> : null}
      </div>

      {rows.length > 0 ? (
        <div
          className="flex gap-3 overflow-x-auto sm:grid sm:grid-cols-6 lg:grid-cols-8 sm:gap-3 sm:overflow-visible pb-1 scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {rows.map((r) => (
            <CategoryWheel key={r.category} row={r} />
          ))}
        </div>
      ) : (
        <div className="py-4 flex flex-col items-start gap-2">
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            {t.dashboard.categoryEmptyTitle}
          </p>
          <Link
            href="/budget-setup"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-brand-red)] font-medium hover:underline"
          >
            {t.dashboard.categoryEmptyCta}
            <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  )
}

function StatusChip({ tone, text }: { tone: 'ok' | 'near' | 'over'; text: string }) {
  const styles =
    tone === 'over'
      ? 'bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]'
      : tone === 'near'
        ? 'bg-[var(--color-status-warn-bg)] text-[var(--color-status-warn-fg)]'
        : 'bg-[var(--color-status-ok-bg)] text-[var(--color-status-ok-fg)]'
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium max-w-[55%] truncate ' +
        styles
      }
      title={text}
    >
      {tone === 'ok' ? (
        <Check className="w-3 h-3 shrink-0" aria-hidden />
      ) : (
        <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden />
      )}
      <span className="truncate">{text}</span>
    </span>
  )
}

function CategoryWheel({ row }: { row: RowDatum }) {
  const palette = getCategoryPalette(row.category)
  const pct = Math.max(0, Math.min(100, row.pct))
  const ringFill = ringColor(row.pct)
  const overBudget = row.pct > 100

  // SVG ring geometry — 52×52 wheel with 3.5px stroke.
  const size = 52
  const stroke = 3.5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct / 100)

  return (
    <div className="flex flex-col items-center gap-1 shrink-0 w-16 sm:w-auto">
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{ width: size, height: size, background: palette.bg }}
        aria-hidden
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0"
        >
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ring-track)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringFill}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        {/* Wrapper sets `color` so the lucide icon (which uses currentColor)
            picks up the palette's darker ink on the pastel circle. */}
        <span className="relative flex" style={{ color: palette.text }}>
          <CategoryIcon category={row.category} className="w-6 h-6" />
        </span>
      </div>
      <span
        className="text-[10px] text-[var(--color-brand-text-secondary)] truncate max-w-full"
        title={row.category}
      >
        {row.category}
      </span>
      <span
        className="text-[10px] font-mono tabular-nums"
        style={{ color: overBudget ? 'var(--color-brand-red)' : 'var(--color-brand-text-muted)' }}
      >
        {formatCompact(row.spent)}/{formatCompact(row.cap)}
      </span>
    </div>
  )
}
