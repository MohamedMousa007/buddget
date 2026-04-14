'use client'

import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useNetWorth } from '@/hooks/useNetWorth'
import { KPICard } from '@/components/dashboard/KPICard'
import { BudgetRing } from '@/components/dashboard/BudgetRing'
import { CategoryBar } from '@/components/dashboard/CategoryBar'
import { RecentExpenses } from '@/components/dashboard/RecentExpenses'
import { SavingsCard } from '@/components/dashboard/SavingsCard'
import { DebtSnapshot } from '@/components/dashboard/DebtSnapshot'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'

export default function DashboardPage() {
  const router = useRouter()
  const t = useT()

  const stats = useMonthlyStats()
  const nw = useNetWorth()
  const incomeNote = stats.incomeBlocked ? t.dashboard.incomeBlockedHint : undefined

  return (
    <div className="min-h-screen">
      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-5xl mx-auto">
        {/* KPI Strip */}
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SavingsCard
            savingsTotal={stats.savingsTotal}
            savingsAccountsTotal={stats.savingsAccountsTotal}
            savingsHoldingsTotal={stats.savingsHoldingsTotal}
            savingsFromExpenses={stats.savingsFromExpenses}
            netSavingsTransfersThisMonth={stats.netSavingsTransfersThisMonth}
            savingsBudget={stats.plannedSavingsBudget}
            currency={stats.baseCurrency}
          />
          <RecentExpenses expenses={stats.monthlyExpenses} />
        </div>

        {/* Debt Snapshot */}
        <DebtSnapshot />
      </div>
    </div>
  )
}
