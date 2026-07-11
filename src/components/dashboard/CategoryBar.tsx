'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { useT } from '@/lib/i18n'
import type { BudgetCategory } from '@/lib/store/types'
import { CategoryBarSpendingBlock } from '@/components/dashboard/CategoryBarSpendingBlock'
import { EmptyState } from '@/components/ui/EmptyState'

interface CategoryBarProps {
  budgetCategories: BudgetCategory[]
  categorySpending: Record<string, number>
  categoryBudgetCaps: Record<string, number>
  currency: string
  incomeBlockedNote?: string | null
}

/**
 * Home “Where Your Money Goes” card: flat list of category rows with spent vs budget bars.
 */
export function CategoryBar({
  budgetCategories,
  categorySpending,
  categoryBudgetCaps,
  currency,
  incomeBlockedNote,
}: CategoryBarProps) {
  const t = useT()

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      {incomeBlockedNote ? (
        <p className="text-xs text-amber-200/90 leading-snug">{incomeBlockedNote}</p>
      ) : null}
      <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
        {t.dashboard.categoryTitle}
      </h3>

      {budgetCategories.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title={t.dashboard.categoryEmptyTitle}
          description={t.dashboard.categoryEmptyDesc}
          className="py-10"
          action={
            <Link
              href="/budget-setup"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              {t.dashboard.categoryEmptyCta}
            </Link>
          }
        />
      ) : (
        <CategoryBarSpendingBlock
          budgetCategories={budgetCategories}
          categorySpending={categorySpending}
          categoryBudgetCaps={categoryBudgetCaps}
          currency={currency}
        />
      )}
    </div>
  )
}
