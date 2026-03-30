'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n'
import type { BudgetCategory } from '@/lib/store/types'
import { CategoryBarExpenseRows } from '@/components/dashboard/CategoryBarExpenseRows'
import { CategoryBarSavingsTab } from '@/components/dashboard/CategoryBarSavingsTab'

type BreakdownTab = 'expenses' | 'savings'

interface CategoryBarProps {
  budgetCategories: BudgetCategory[]
  categorySpending: Record<string, number>
  categoryBudgetCaps: Record<string, number>
  currency: string
  incomeBlockedNote?: string | null
  savingsHoldingsTotal: number
}

/**
 * Home category breakdown: **Expenses** (budget vs spend) and **Savings** (allocation / holdings), not mixed in one list.
 */
export function CategoryBar({
  budgetCategories,
  categorySpending,
  categoryBudgetCaps,
  currency,
  incomeBlockedNote,
  savingsHoldingsTotal,
}: CategoryBarProps) {
  const t = useT()
  const [tab, setTab] = useState<BreakdownTab>('expenses')

  const expenseBudgets = budgetCategories.filter((b) => b.category !== 'Savings')
  const savingsBudget = budgetCategories.find((b) => b.category === 'Savings')
  const savingsSpent = categorySpending.Savings ?? 0
  const savingsCap =
    savingsBudget != null
      ? (categoryBudgetCaps.Savings ?? savingsBudget.budgetedAmount)
      : 0

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      {incomeBlockedNote ? (
        <p className="text-[11px] text-amber-200/90 leading-snug">{incomeBlockedNote}</p>
      ) : null}
      <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
        {t.dashboard.categoryTitle}
      </h3>
      <div
        className="flex rounded-xl bg-[var(--color-brand-elevated)] p-1 gap-1"
        role="tablist"
        aria-label={t.dashboard.categoryBreakdownTabsAria}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'expenses'}
          onClick={() => setTab('expenses')}
          className={`flex-1 rounded-lg py-2 px-3 text-xs font-medium transition-colors ${
            tab === 'expenses'
              ? 'bg-[var(--color-brand-border)] text-white shadow-sm'
              : 'text-[var(--color-brand-text-secondary)] hover:text-white'
          }`}
        >
          {t.dashboard.categoryTabExpenses}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'savings'}
          onClick={() => setTab('savings')}
          className={`flex-1 rounded-lg py-2 px-3 text-xs font-medium transition-colors ${
            tab === 'savings'
              ? 'bg-[var(--color-brand-border)] text-white shadow-sm'
              : 'text-[var(--color-brand-text-secondary)] hover:text-white'
          }`}
        >
          {t.dashboard.categoryTabSavings}
        </button>
      </div>
      {tab === 'expenses' ? (
        <CategoryBarExpenseRows
          budgetCategories={expenseBudgets}
          categorySpending={categorySpending}
          categoryBudgetCaps={categoryBudgetCaps}
          currency={currency}
        />
      ) : (
        <CategoryBarSavingsTab
          spentThisMonth={savingsSpent}
          budgetCap={savingsCap}
          holdingsTotal={savingsHoldingsTotal}
          currency={currency}
        />
      )}
    </div>
  )
}
