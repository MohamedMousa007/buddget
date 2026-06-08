'use client'

import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { DashboardSearchParamsSync } from '@/components/dashboard/DashboardSearchParamsSync'
import { DashboardHero } from '@/components/dashboard/DashboardHero'
import { DashboardHeroMinimal } from '@/components/dashboard/DashboardHeroMinimal'
import { DashboardNetWorthHero } from '@/components/dashboard/DashboardNetWorthHero'
import { DashboardPaceBadge } from '@/components/dashboard/DashboardPaceBadge'
import { DashboardStatsRow } from '@/components/dashboard/DashboardStatsRow'
import { DashboardCategoryBars } from '@/components/dashboard/DashboardCategoryBars'
import { DashboardTransactions } from '@/components/dashboard/DashboardTransactions'
import { DashboardSummaryCards } from '@/components/dashboard/DashboardSummaryCards'
import { DashboardSummaryTrio } from '@/components/dashboard/DashboardSummaryTrio'
import { DashboardGoalsStrip } from '@/components/dashboard/DashboardGoalsStrip'
import { DashboardFirstRunChecklist } from '@/components/dashboard/DashboardFirstRunChecklist'
import { BuildBudgetCta } from '@/components/dashboard/BuildBudgetCta'
import { LockedFeatureCard } from '@/components/ui/LockedFeatureCard'
import { SetupChecklist } from '@/components/features/onboarding/SetupChecklist'
import { SmsAccountDetectionBanner } from '@/components/features/dashboard/SmsAccountDetectionBanner'
import { SmsPendingConfirmationsBanner } from '@/components/features/dashboard/SmsPendingConfirmationsBanner'
import { SmsActivityMini } from '@/components/features/dashboard/SmsActivityMini'
import { useFirstRunChecklist } from '@/lib/onboarding/firstRunChecklist'
import { useLegacyOnboardingMigrator } from '@/lib/onboarding/migrateLegacyOnboarding'
import { ONBOARDING_EVENTS, track } from '@/lib/analytics/events'
import { useActionToast } from '@/components/ui/ActionToast'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
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
  const t = useT()
  // Each hook runs in parallel and hydrates its Zustand slice from Supabase
  // (in addition to the localStorage copy hydrated synchronously on mount).
  useHydrateExpenses()
  useHydrateIncome()
  useHydrateDebts()
  useHydrateSavings()
  useHydrateGoals()
  useHydrateBudget()
  useHydrateSubscriptions()
  useLegacyOnboardingMigrator()

  const stats = useMonthlyStats()
  const netWorth = useNetWorth()
  const checklist = useFirstRunChecklist()
  const showToast = useActionToast()
  const { dashboardLayout } = useFinanceStore(
    useShallow((s) => ({
      dashboardLayout: s.settings.dashboardLayout ?? 'standard',
    })),
  )
  const isMinimal = dashboardLayout === 'minimal'

  const [justBuilt, setJustBuilt] = useState(false)
  const showChecklist = !checklist.hidden && !checklist.allDone && !justBuilt
  // Locks bypassed for device testing — re-enable when onboarding flow is stable
  const incomeIsLocked = false
  const budgetIsLocked = false
  const netWorthIsLocked = false

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
      <div
        className="max-w-2xl lg:max-w-3xl mx-auto px-4 pt-4 pb-8 space-y-4"
      >
        <SetupChecklist />
        <SmsAccountDetectionBanner />
        <SmsPendingConfirmationsBanner />
        <SmsActivityMini />

        {isMinimal ? (
          <DashboardHeroMinimal
            stats={{
              leftToSpend: stats.leftToSpend,
              dailyRate: stats.dailyRate,
              paceStatus: stats.paceStatus,
              daysLeft: stats.daysLeft,
              baseCurrency: stats.baseCurrency,
            }}
            suppressNumbers={showChecklist}
          />
        ) : incomeIsLocked ? (
          <LockedFeatureCard title="Cash flow & income" dependency="income">
            <DashboardHero
              stats={{
                leftToSpend: 0,
                budgetUsedPercent: 0,
                totalIncome: 0,
                totalSpent: stats.totalSpent,
                savingsTotal: stats.savingsTotal,
                netSavingsTransfersThisMonth: 0,
                dailyRate: stats.dailyRate,
                paceStatus: stats.paceStatus,
                daysLeft: stats.daysLeft,
                baseCurrency: stats.baseCurrency,
              }}
              suppressNumbers={false}
            />
          </LockedFeatureCard>
        ) : (
          <DashboardHero
            stats={{
              leftToSpend: stats.leftToSpend,
              budgetUsedPercent: stats.budgetUsedPercent,
              totalIncome: stats.totalIncome,
              totalSpent: stats.totalSpent,
              savingsTotal: stats.savingsTotal,
              netSavingsTransfersThisMonth: stats.netSavingsTransfersThisMonth,
              dailyRate: stats.dailyRate,
              paceStatus: stats.paceStatus,
              daysLeft: stats.daysLeft,
              baseCurrency: stats.baseCurrency,
            }}
            suppressNumbers={showChecklist}
          />
        )}

        {showChecklist ? (
          <>
            <DashboardFirstRunChecklist snapshot={checklist} />
            <BuildBudgetCta onBuilt={() => setJustBuilt(true)} />
          </>
        ) : isMinimal ? (
          <DashboardStatsRow
            totalIncome={stats.totalIncome}
            totalSpent={stats.totalSpent}
            savingsTotal={stats.savingsTotal}
            baseCurrency={stats.baseCurrency}
          />
        ) : (
          <>
            {netWorthIsLocked ? (
              <LockedFeatureCard title="Net worth" dependency="income" />
            ) : (
              <DashboardNetWorthHero
                netWorth={netWorth.netWorth}
                monthlyFlow={netWorth.monthlyFlow}
                totalSavings={netWorth.totalSavings}
                totalDebt={netWorth.totalDebt}
                baseCurrency={stats.baseCurrency}
              />
            )}
            <DashboardPaceBadge
              paceStatus={stats.paceStatus}
              dailyRate={stats.dailyRate}
              suggestedDaily={stats.suggestedDaily}
              daysLeft={stats.daysLeft}
              baseCurrency={stats.baseCurrency}
              overBudgetCategories={stats.overBudgetCategories}
            />
          </>
        )}

        {budgetIsLocked ? (
          <LockedFeatureCard title="Budget progress" dependency="budget_plan" />
        ) : (
          <DashboardCategoryBars
            budgetCategories={stats.dashboardBudgetCategories}
            categorySpending={stats.categorySpending}
            categoryBudgetCaps={stats.categoryBudgetCaps}
          />
        )}

        <DashboardTransactions
          expenses={stats.monthlyExpenses}
          variant={isMinimal ? 'minimal' : 'standard'}
        />

        {isMinimal ? (
          <DashboardSummaryTrio
            savingsTotal={stats.savingsTotal}
            debtTotal={stats.debtRemainingTotal}
            netWorth={netWorth.netWorth}
            baseCurrency={stats.baseCurrency}
          />
        ) : (
          <>
            <DashboardSummaryCards
              savingsTotal={stats.savingsTotal}
              netSavingsThisMonth={stats.netSavingsTransfersThisMonth}
              savingsThisMonth={stats.savingsThisMonth}
              monthClosed={stats.monthClosed}
              debtTotal={stats.debtRemainingTotal}
              baseCurrency={stats.baseCurrency}
            />
            <DashboardGoalsStrip />
          </>
        )}
      </div>
    </div>
  )
}
