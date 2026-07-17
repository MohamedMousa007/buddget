'use client'

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
import { SmsAccountDetectionBanner } from '@/components/features/dashboard/SmsAccountDetectionBanner'
import { SmsSubscriptionDetectionBanner } from '@/components/features/dashboard/SmsSubscriptionDetectionBanner'
import { SubscriptionPlanChangeBanner } from '@/components/features/dashboard/SubscriptionPlanChangeBanner'
import { BannerStack } from '@/components/features/dashboard/BannerStack'
import { SmsReviewChip } from '@/components/features/dashboard/SmsReviewChip'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { SkeletonList } from '@/components/ui/SkeletonList'
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
  const dataReady = useFinanceStore((s) => s.dataReady)
  useHydrateExpenses()
  useHydrateIncome()
  useHydrateDebts()
  useHydrateSavings()
  useHydrateGoals()
  useHydrateBudget()
  useHydrateSubscriptions()

  const stats = useMonthlyStats()
  const netWorth = useNetWorth()
  const { dashboardLayout } = useFinanceStore(
    useShallow((s) => ({
      dashboardLayout: s.settings.dashboardLayout ?? 'standard',
    })),
  )
  const isMinimal = dashboardLayout === 'minimal'

  if (!dataReady) return <div className="p-4"><SkeletonList rows={8} /></div>

  return (
    <div>
      <DashboardSearchParamsSync />
      <div
        className="max-w-2xl lg:max-w-3xl mx-auto px-4 pt-4 pb-8 space-y-4 animate-[dashboardIn_0.35s_ease-out]"
      >
        <SmsReviewChip />
        {/* One floating slot: these genuinely stack instead of covering each other, and a
            single SMS can reveal both a new account and an untracked subscription. */}
        <BannerStack>
          <SmsAccountDetectionBanner />
          <SmsSubscriptionDetectionBanner />
          <SubscriptionPlanChangeBanner />
        </BannerStack>

        {isMinimal ? (
          <DashboardHeroMinimal
            stats={{
              leftToSpend: stats.leftToSpend,
              dailyRate: stats.dailyRate,
              paceStatus: stats.paceStatus,
              daysLeft: stats.daysLeft,
              baseCurrency: stats.baseCurrency,
            }}
          />
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
          />
        )}

        {isMinimal ? (
          <DashboardStatsRow
            totalIncome={stats.totalIncome}
            totalSpent={stats.totalSpent}
            savingsTotal={stats.savingsTotal}
            baseCurrency={stats.baseCurrency}
          />
        ) : (
          <>
            <DashboardNetWorthHero
              netWorth={netWorth.netWorth}
              monthlyFlow={netWorth.monthlyFlow}
              totalSavings={netWorth.totalSavings}
              totalDebt={netWorth.totalDebt}
              baseCurrency={stats.baseCurrency}
            />
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

        <DashboardCategoryBars
          budgetCategories={stats.dashboardBudgetCategories}
          categorySpending={stats.categorySpending}
          categoryBudgetCaps={stats.categoryBudgetCaps}
        />

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
