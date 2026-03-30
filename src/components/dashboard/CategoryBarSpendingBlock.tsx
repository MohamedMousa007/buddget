'use client'

import { useState } from 'react'
import type { BudgetCategory } from '@/lib/store/types'
import type { Dictionary } from '@/lib/i18n/types'
import { CategoryBarExpenseRows } from '@/components/dashboard/CategoryBarExpenseRows'
import { CategoryBarSavingsTab } from '@/components/dashboard/CategoryBarSavingsTab'

type BreakdownTab = 'expenses' | 'savings'

export interface CategoryBarSpendingBlockProps {
  t: Dictionary['dashboard']
  budgetCategories: BudgetCategory[]
  categorySpending: Record<string, number>
  categoryBudgetCaps: Record<string, number>
  currency: string
  savingsHoldingsTotal: number
}

/** Inner Expenses / Savings tabs and rows for the home category card (Spending panel). */
export function CategoryBarSpendingBlock({
  t,
  budgetCategories,
  categorySpending,
  categoryBudgetCaps,
  currency,
  savingsHoldingsTotal,
}: CategoryBarSpendingBlockProps) {
  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>('expenses')

  const expenseBudgets = budgetCategories.filter((b) => b.category !== 'Savings')
  const savingsBudget = budgetCategories.find((b) => b.category === 'Savings')
  const savingsSpent = categorySpending.Savings ?? 0
  const savingsCap =
    savingsBudget != null ? (categoryBudgetCaps.Savings ?? savingsBudget.budgetedAmount) : 0

  const innerTabBtn = (active: boolean) =>
    `flex-1 rounded-lg py-2 px-3 text-xs font-medium transition-colors ${
      active
        ? 'bg-[var(--color-brand-border)] text-white shadow-sm'
        : 'text-[var(--color-brand-text-secondary)] hover:text-white'
    }`

  return (
    <>
      <div
        className="flex rounded-xl bg-[var(--color-brand-elevated)] p-1 gap-1"
        role="tablist"
        aria-label={t.categoryBreakdownTabsAria}
      >
        <button
          type="button"
          role="tab"
          aria-selected={breakdownTab === 'expenses'}
          onClick={() => setBreakdownTab('expenses')}
          className={innerTabBtn(breakdownTab === 'expenses')}
        >
          {t.categoryTabExpenses}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={breakdownTab === 'savings'}
          onClick={() => setBreakdownTab('savings')}
          className={innerTabBtn(breakdownTab === 'savings')}
        >
          {t.categoryTabSavings}
        </button>
      </div>
      {breakdownTab === 'expenses' ? (
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
    </>
  )
}
