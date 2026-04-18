'use client'

import { useEffect, useRef } from 'react'
import { DashboardSearchParamsSync } from '@/components/dashboard/DashboardSearchParamsSync'
import { DashboardFirstRunChecklist } from '@/components/dashboard/DashboardFirstRunChecklist'
import { useFirstRunChecklist } from '@/lib/onboarding/firstRunChecklist'
import { useLegacyOnboardingMigrator } from '@/lib/onboarding/migrateLegacyOnboarding'
import { ONBOARDING_EVENTS, track } from '@/lib/analytics/events'
import { useActionToast } from '@/components/ui/ActionToast'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useNetWorth } from '@/hooks/useNetWorth'
import { KPICard } from '@/components/dashboard/KPICard'
import { BudgetRing } from '@/components/dashboard/BudgetRing'
import { CategoryBar } from '@/components/dashboard/CategoryBar'
import { RecentExpenses } from '@/components/dashboard/RecentExpenses'
import { GoalsWidget } from '@/components/dashboard/GoalsWidget'
import { SavingsCard } from '@/components/dashboard/SavingsCard'
import { DebtSnapshot } from '@/components/dashboard/DebtSnapshot'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import {
  useHydrateBudget,
  useHydrateDebts,
  useHydrateExpenses,
  useHydrateGoals,
  useHydrateIncome,
  useHydrateSavings,
  useHydrateSubscriptions,
} from '@/hooks/remote'

export default function DashboardPage() {
  const router = useRouter()
  const t = useT()
  // Dashboard touches nearly every domain. Each hook runs in parallel and
  // hydrates its Zustand slice from Supabase (in addition to the cached
  // localStorage copy hydrated synchronously on mount).
  useHydrateExpenses()
  useHydrateIncome()
  useHydrateDebts()
  useHydrateSavings()
  useHydrateGoals()
  useHydrateBudget()
  useHydrateSubscriptions()
  useLegacyOnboardingMigrator()

  const stats = useMonthlyStats()
  const nw = useNetWorth()
  const checklist = useFirstRunChecklist()
  const incomeNote = stats.incomeBlocked ? t.dashboard.incomeBlockedHint : undefined
  const showToast = useActionToast()

  // Show the checklist card above the dashboard — and suppress the data
  // widgets underneath — until the user either finishes setup or hides the
  // checklist. One rule: visible AND not all-done.
  const showChecklist = !checklist.hidden && !checklist.allDone
  const suppressData = showChecklist

  // Celebrate when the 4-item checklist flips to 100%. Only fires on the
  // transition so returning users who land with allDone already true don't
  // get a spurious toast.
  const wasAllDoneRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (checklist.hidden) {
      wasAllDoneRef.current = null
      return
    }
    if (wasAllDoneRef.current === null) {
      wasAllDoneRef.current = checklist.allDone
      return
    }
    if (!wasAllDoneRef.current && checklist.allDone) {
      try {
        showToast(t.onboarding.checklistCompleteToast)
      } catch {
        /* toast provider not mounted in tests */
      }
      track(ONBOARDING_EVENTS.checklistAllCompleted)
    }
    wasAllDoneRef.current = checklist.allDone
  }, [checklist.allDone, checklist.hidden, showToast, t.onboarding.checklistCompleteToast])

  return (
    <div className="min-h-screen">
      <DashboardSearchParamsSync />
      <div className="px-4 pt-4 pb-5 lg:pt-4 lg:px-6 space-y-4 max-w-6xl mx-auto">
        {showChecklist ? <DashboardFirstRunChecklist snapshot={checklist} /> : null}
        {suppressData ? null : (
        <>
        {/* KPI grid — no horizontal scroll; reflows 2 → 3 → 6 cols. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          <KPICard
            title={t.dashboard.kpiNetWorth}
            value={nw.netWorth}
            currency={nw.baseCurrency}
            icon={t.dashboard.kpiNetWorthIcon}
            trendLabel={t.dashboard.kpiNetWorthTrend}
            color={nw.netWorth >= 0 ? 'green' : 'red'}
            footnote={nw.netWorthGoldIncomplete ? t.dashboard.kpiNetWorthGoldNote : undefined}
          />
          <KPICard
            title={t.dashboard.kpiIncome}
            value={stats.totalIncome}
            currency={stats.baseCurrency}
            icon={t.dashboard.kpiIncomeIcon}
            trendLabel={t.dashboard.kpiIncomeTrend}
            footnote={incomeNote}
          />
          <KPICard
            title={t.dashboard.kpiSpent}
            value={stats.totalSpent}
            currency={stats.baseCurrency}
            icon={t.dashboard.kpiSpentIcon}
            trendLabel={t.dashboard.kpiSpentTrend}
          />
          <KPICard
            title={t.dashboard.kpiRemaining}
            value={stats.leftToSpend}
            currency={stats.baseCurrency}
            icon={t.dashboard.kpiRemainingIcon}
            color={stats.leftToSpend >= 0 ? 'green' : 'red'}
            trendLabel={t.dashboard.kpiRemainingTrend}
          />
          <KPICard
            title={t.dashboard.kpiSavings}
            value={stats.savingsTotal}
            currency={stats.baseCurrency}
            icon={t.dashboard.kpiSavingsIcon}
            color="gold"
            trendLabel={t.dashboard.kpiSavingsTrend}
          />
          <KPICard
            title={t.dashboard.kpiDebt}
            value={stats.debtRemainingTotal}
            currency={stats.baseCurrency}
            icon={t.dashboard.kpiDebtIcon}
            color="red"
            trendLabel={t.dashboard.kpiDebtTrend}
            onClick={() => router.push('/debts')}
          />
        </div>

        {/* Budget Ring + Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BudgetRing
            percent={stats.budgetUsedPercent}
            remaining={stats.remaining}
            currency={stats.baseCurrency}
            daysLeft={stats.daysLeft}
            incomeBlockedNote={stats.incomeBlocked ? t.dashboard.incomeBlockedHint : null}
            dailyRate={stats.dailyRate}
            projectedSpend={stats.projectedSpend}
            paceStatus={stats.paceStatus}
            suggestedDaily={stats.suggestedDaily}
            overBudgetCategories={stats.overBudgetCategories}
          />
          <CategoryBar
            budgetCategories={stats.dashboardBudgetCategories}
            categorySpending={stats.categorySpending}
            categoryBudgetCaps={stats.categoryBudgetCaps}
            currency={stats.baseCurrency}
            incomeBlockedNote={stats.incomeBlocked ? t.dashboard.incomeBlockedHint : null}
          />
        </div>

        {/* Savings + Recent */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-4">
            <SavingsCard
              savingsTotal={stats.savingsTotal}
              savingsAccountsTotal={stats.savingsAccountsTotal}
              savingsHoldingsTotal={stats.savingsHoldingsTotal}
              savingsFromExpenses={stats.savingsFromExpenses}
              netSavingsTransfersThisMonth={stats.netSavingsTransfersThisMonth}
              savingsBudget={stats.plannedSavingsBudget}
              currency={stats.baseCurrency}
            />
            <GoalsWidget />
          </div>
          <RecentExpenses expenses={stats.monthlyExpenses} />
        </div>

        {/* Debt Snapshot */}
        <DebtSnapshot />
        </>
        )}
      </div>
    </div>
  )
}
