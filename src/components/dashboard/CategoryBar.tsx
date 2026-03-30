'use client'

import { useT } from '@/lib/i18n'
import type { BudgetCategory } from '@/lib/store/types'
import { CategorySpendingBars } from '@/components/dashboard/CategorySpendingBars'
import { ProfileBudgetSection } from '@/components/profile/ProfileBudgetSection'
import { useCategoryPanelFromHash } from '@/hooks/useCategoryPanelFromHash'

interface CategoryBarProps {
  budgetCategories: BudgetCategory[]
  categorySpending: Record<string, number>
  /** Effective cap per category (handles % of income mode) */
  categoryBudgetCaps: Record<string, number>
  currency: string
  incomeBlockedNote?: string | null
}

/**
 * Home dashboard card: category spending vs caps, with a second tab for in-place budget setup.
 */
export function CategoryBar({
  budgetCategories,
  categorySpending,
  categoryBudgetCaps,
  currency,
  incomeBlockedNote,
}: CategoryBarProps) {
  const t = useT()
  const { panel, selectSpending, selectBudget } = useCategoryPanelFromHash()

  const tabBtn = (active: boolean) =>
    `flex-1 min-w-0 rounded-xl px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
      active
        ? 'bg-[var(--color-brand-elevated)] text-white shadow-sm border border-[var(--color-brand-border)]'
        : 'text-[var(--color-brand-text-muted)] hover:text-white'
    }`

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      {incomeBlockedNote ? (
        <p className="text-[11px] text-amber-200/90 leading-snug">{incomeBlockedNote}</p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider shrink-0">
          {t.dashboard.categoryTitle}
        </h3>
        <div
          className="flex w-full gap-1 rounded-xl bg-[var(--color-brand-elevated)]/60 p-1 border border-[var(--color-brand-border)]/80 sm:max-w-md"
          role="tablist"
          aria-label={t.dashboard.categoryTitle}
        >
          <button
            type="button"
            role="tab"
            aria-selected={panel === 'spending'}
            className={tabBtn(panel === 'spending')}
            onClick={selectSpending}
          >
            {t.dashboard.categoryTabSpending}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panel === 'budget'}
            className={tabBtn(panel === 'budget')}
            onClick={selectBudget}
          >
            {t.dashboard.categoryTabBudgetSetup}
          </button>
        </div>
      </div>

      {panel === 'spending' ? (
        <CategorySpendingBars
          budgetCategories={budgetCategories}
          categorySpending={categorySpending}
          categoryBudgetCaps={categoryBudgetCaps}
          currency={currency}
        />
      ) : (
        <ProfileBudgetSection variant="embedded" />
      )}
    </div>
  )
}
