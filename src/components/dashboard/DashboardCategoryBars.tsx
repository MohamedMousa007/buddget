'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
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

const GREEN = '#18A349'
const AMBER = '#D4A017'
const RED = '#E50914'

function fillColor(pct: number): string {
  if (pct > 100) return RED
  if (pct >= 75) return AMBER
  return GREEN
}

/**
 * Compact "Spending by category" card. One row per budgeted category with a
 * thin progress bar, a vertical budget-cap marker, and a "spent/cap" compact
 * label. Only categories with a positive cap are shown — the dashboard stays
 * clean while budget-setup remains the place to edit them.
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

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
      <h2 className="text-[11px] uppercase tracking-[0.3px] text-[var(--color-brand-text-secondary)] font-semibold mb-3">
        {t.dashboard.sectionCategoriesTitle}
      </h2>
      {rows.length > 0 ? (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <CategoryRow key={r.category} row={r} />
          ))}
        </ul>
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

function CategoryRow({ row }: { row: RowDatum }) {
  const { bg, text } = getCategoryPalette(row.category)
  const fill = fillColor(row.pct)
  const overBudget = row.pct > 100
  // Visual width caps at ~113% so the bar slightly bleeds past the marker.
  const visibleWidth = Math.max(0, Math.min(113, row.pct))

  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
        style={{ background: bg, color: text }}
      >
        <CategoryIcon category={row.category} className="w-3 h-3" />
      </span>
      <span
        className="text-[11px] font-medium text-[var(--color-brand-text-primary)] shrink-0"
        style={{ width: 58 }}
        title={row.category}
      >
        {row.category}
      </span>

      {/* progress bar + marker */}
      <div className="relative flex-1 h-[5px] bg-[#F0F0F0] rounded-full overflow-visible">
        <div
          className="absolute inset-y-0 start-0 rounded-full"
          style={{ width: `${visibleWidth}%`, background: fill, transition: 'width 300ms ease' }}
        />
        {/* budget-cap marker at 100% */}
        <span
          aria-hidden
          className="absolute top-[-2px] bottom-[-2px] w-[1.5px]"
          style={{ insetInlineStart: '100%', background: 'rgba(0,0,0,0.2)' }}
        />
      </div>

      <span
        className="text-[10px] font-mono shrink-0"
        style={{ color: overBudget ? RED : 'var(--color-brand-text-secondary)' }}
      >
        {formatCompact(row.spent)}/{formatCompact(row.cap)}
      </span>
    </li>
  )
}
