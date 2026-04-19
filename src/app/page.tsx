'use client'

import { useEffect, useRef, useState } from 'react'
import { DashboardSearchParamsSync } from '@/components/dashboard/DashboardSearchParamsSync'
import { DashboardHero } from '@/components/dashboard/DashboardHero'
import { DashboardNetWorthHero } from '@/components/dashboard/DashboardNetWorthHero'
import { DashboardPaceBadge } from '@/components/dashboard/DashboardPaceBadge'
import { DashboardCategoryBars } from '@/components/dashboard/DashboardCategoryBars'
import { DashboardTransactions } from '@/components/dashboard/DashboardTransactions'
import { DashboardSummaryCards } from '@/components/dashboard/DashboardSummaryCards'
import { DashboardGoalsStrip } from '@/components/dashboard/DashboardGoalsStrip'
import { DashboardFirstRunChecklist } from '@/components/dashboard/DashboardFirstRunChecklist'
import { BuildBudgetCta } from '@/components/dashboard/BuildBudgetCta'
import { useFirstRunChecklist } from '@/lib/onboarding/firstRunChecklist'
import { useLegacyOnboardingMigrator } from '@/lib/onboarding/migrateLegacyOnboarding'
import { ONBOARDING_EVENTS, track } from '@/lib/analytics/events'
import { useActionToast } from '@/components/ui/ActionToast'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useNetWorth } from '@/hooks/useNetWorth'
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

  // Show the onboarding checklist above the data widgets until the user
  // either finishes setup or hides the checklist. `justBuilt` is set by the
  // Build-My-Budget CTA so KPIs reveal the moment the AI plan lands, even
  // before the next checklist snapshot rolls in.
  const [justBuilt, setJustBuilt] = useState(false)
  const showChecklist = !checklist.hidden && !checklist.allDone && !justBuilt

  // Celebrate the first time all six cards flip to done.
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
      <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 pt-4 pb-8 space-y-4">
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

        {showChecklist ? null : (
          <DashboardNetWorthHero
            netWorth={netWorth.netWorth}
            totalSavings={netWorth.totalSavings}
            totalDebt={netWorth.totalDebt}
            baseCurrency={stats.baseCurrency}
          />
        )}

        {showChecklist ? (
          <>
            <DashboardFirstRunChecklist snapshot={checklist} />
            <BuildBudgetCta onBuilt={() => setJustBuilt(true)} />
          </>
        ) : (
          <DashboardPaceBadge
            paceStatus={stats.paceStatus}
            dailyRate={stats.dailyRate}
            suggestedDaily={stats.suggestedDaily}
            daysLeft={stats.daysLeft}
            baseCurrency={stats.baseCurrency}
            overBudgetCategories={stats.overBudgetCategories}
          />
        )}

        <DashboardCategoryBars
          budgetCategories={stats.dashboardBudgetCategories}
          categorySpending={stats.categorySpending}
          categoryBudgetCaps={stats.categoryBudgetCaps}
        />
        <DashboardTransactions expenses={stats.monthlyExpenses} />
        <DashboardSummaryCards
          savingsTotal={stats.savingsTotal}
          netSavingsThisMonth={stats.netSavingsTransfersThisMonth}
          debtTotal={stats.debtRemainingTotal}
          baseCurrency={stats.baseCurrency}
        />
        <DashboardGoalsStrip />
      </div>
    </div>
  )
}
