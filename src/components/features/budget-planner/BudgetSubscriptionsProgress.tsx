'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { currencyLabel } from '@/components/features/subscriptions/subscriptionLabels'
import { RotateCwClock } from '@/components/ui/icons/RotateCwClock'
import { effectivePlanCategoryAmountInBase } from '@/lib/budget/budgetPlans'
import { useLocale, useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { BudgetPlanCategory } from '@/lib/store/types'
import { leftToPayThisMonth } from '@/lib/subscriptions/subscriptionForecast'
import { money0 } from '@/lib/subscriptions/subscriptionFormat'
import { expenseAmountInBase, filterExpensesByMonth } from '@/lib/utils/calculations'

/**
 * The Subscriptions row of a budget plan: actual against plan, and what is still to pay from
 * real due dates. The bar is red only when the plan is exceeded.
 */
export function BudgetSubscriptionsProgress({ category }: { category: BudgetPlanCategory }) {
  const t = useT()
  const { locale } = useLocale()
  const ui = t.subscriptions.ui.budget
  const month = useSettingsStore((s) => s.monthFilter)
  const { subscriptions, expenses, base, rates, monthStartDay } = useFinanceStore(
    useShallow((s) => ({
      subscriptions: s.subscriptions,
      expenses: s.expenses,
      base: s.settings.baseCurrency,
      rates: s.exchangeRates,
      monthStartDay: s.settings.monthStartDay,
    })),
  )

  const { spent, planned, left } = useMemo(() => {
    const spentBase = filterExpensesByMonth(expenses, month, monthStartDay)
      .filter((e) => e.category === 'Subscription')
      .reduce((a, e) => a + expenseAmountInBase(e, base, rates), 0)
    return {
      spent: spentBase,
      planned: effectivePlanCategoryAmountInBase(category, base, rates),
      left: leftToPayThisMonth(subscriptions, expenses, new Date(), base, rates),
    }
  }, [expenses, subscriptions, category, month, monthStartDay, base, rates])

  const over = planned > 0 && spent > planned
  const pct = planned > 0 ? Math.min(100, (spent / planned) * 100) : 0

  return (
    <div className="flex items-center gap-3 border-t border-[var(--color-brand-border)] px-3 py-2.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
        <RotateCwClock className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-[15px] font-semibold text-[var(--color-brand-text-primary)]">
          <span className="truncate">{t.nav.subscriptions}</span>
          <span className="font-mono-numbers text-[13px] font-medium">
            {money0(spent)} / {money0(planned)} {currencyLabel(base, locale)}
          </span>
        </div>
        <div className="h-[5px] overflow-hidden rounded-full bg-[var(--color-brand-elevated)]">
          <div
            className={over ? 'h-full rounded-full bg-[var(--color-brand-red)]' : 'h-full rounded-full bg-[var(--color-brand-primary-bright)]'}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={
            over
              ? 'text-xs font-semibold text-[var(--color-brand-red-text)]'
              : 'text-xs text-[var(--color-brand-text-secondary)]'
          }
        >
          {over ? ui.overBudget(money0(spent - planned)) : ui.planLeft(money0(left))}
        </span>
      </div>
    </div>
  )
}
