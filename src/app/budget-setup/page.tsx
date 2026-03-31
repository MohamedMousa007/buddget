'use client'

import Link from 'next/link'
import { SlidersHorizontal, Check, ArrowRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { ProfileBudgetSection } from '@/components/profile/ProfileBudgetSection'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'

/**
 * Dedicated budget editor and onboarding checklist (moved from Profile).
 */
export default function BudgetSetupPage() {
  const t = useT()
  const { budgetCategories, incomeSources, expenses, savingsHoldings, paymentMethods } = useFinanceStore(
    useShallow((s) => ({
      budgetCategories: s.budgetCategories,
      incomeSources: s.incomeSources,
      expenses: s.expenses,
      savingsHoldings: s.savingsHoldings,
      paymentMethods: s.paymentMethods,
    }))
  )

  const setupSteps = [
    { label: t.profile.setupStepIncome, done: incomeSources.length > 0, href: '/income' },
    { label: t.profile.setupStepBudget, done: budgetCategories.some((b) => b.budgetedAmount > 0), href: '/budget-setup' },
    { label: t.profile.setupStepPayment, done: paymentMethods.length > 1, href: '/settings' },
    { label: t.profile.setupStepExpense, done: expenses.length > 0, href: '/expenses' },
    { label: t.profile.setupStepSavings, done: savingsHoldings.length > 0, href: '/savings' },
  ]
  const completedCount = setupSteps.filter((s) => s.done).length

  const setupMessage =
    completedCount === 0
      ? t.profile.setupMsg0
      : completedCount <= 2
        ? t.profile.setupMsg1
        : completedCount <= 4
          ? t.profile.setupMsg3
          : t.profile.setupMsg5

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-[var(--color-brand-red)]" />
            {t.nav.budgetSetup}
          </h1>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-6">
        <div className="bg-[#111118] border border-[#2A2A38] rounded-2xl p-6">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-4">
            {t.profile.budgetTitle}
          </h2>
          <ProfileBudgetSection variant="embedded" />
        </div>

        <div className="bg-[#111118] border border-[#2A2A38] rounded-2xl p-6">
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-1">
            {t.profile.setupTitle}
          </h2>
          <p className="text-xs text-[var(--color-brand-text-muted)] mb-4">{setupMessage}</p>
          <div className="h-2 bg-[var(--color-brand-border)] rounded-full overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-[var(--color-brand-green)] transition-all"
              style={{ width: `${(completedCount / 5) * 100}%` }}
            />
          </div>
          <ul className="space-y-2">
            {setupSteps.map((step) => (
              <li key={step.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {step.done ? (
                    <Check className="w-4 h-4 text-[var(--color-brand-green)]" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[#2A2A38]" />
                  )}
                  <span className={step.done ? 'text-sm text-white' : 'text-sm text-[var(--color-brand-text-muted)]'}>
                    {step.label}
                  </span>
                </div>
                {!step.done && (
                  <Link href={step.href} className="text-xs text-[var(--color-brand-red)] hover:underline flex items-center gap-0.5">
                    {t.profile.doIt} <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
