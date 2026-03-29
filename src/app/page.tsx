'use client'

import { INCOME_BLOCKED_HINT, useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useRates } from '@/hooks/useRates'
import { useGoldPrice } from '@/hooks/useGoldPrice'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { KPICard } from '@/components/dashboard/KPICard'
import { BudgetRing } from '@/components/dashboard/BudgetRing'
import { CategoryBar } from '@/components/dashboard/CategoryBar'
import { RecentExpenses } from '@/components/dashboard/RecentExpenses'
import { SavingsCard } from '@/components/dashboard/SavingsCard'
import { DebtSnapshot } from '@/components/dashboard/DebtSnapshot'
import { QuickAddFAB } from '@/components/modals/QuickAddFAB'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  useRates()
  useGoldPrice()
  const router = useRouter()

  const { budgetCategories } = useFinanceStore(useShallow((s) => ({ budgetCategories: s.budgetCategories })))
  const stats = useMonthlyStats()
  const incomeNote = stats.incomeBlocked ? INCOME_BLOCKED_HINT : undefined

  const savingsBudget = budgetCategories.find((b) => b.category === 'Savings')?.budgetedAmount || 0

  return (
    <div className="min-h-screen">
      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-5xl mx-auto">
        {/* KPI Strip */}
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
          <KPICard
            title="Income"
            value={stats.totalIncome}
            currency={stats.baseCurrency}
            icon="💵"
            trendLabel="This month"
            footnote={incomeNote}
          />
          <KPICard
            title="Spent"
            value={stats.totalSpent}
            currency={stats.baseCurrency}
            icon="💸"
            trendLabel="This month"
          />
          <KPICard
            title="Remaining"
            value={stats.remaining}
            currency={stats.baseCurrency}
            icon="💰"
            color={stats.remaining >= 0 ? 'green' : 'red'}
            trendLabel="Budget left"
          />
          <KPICard
            title="Savings"
            value={stats.savingsTotal}
            currency={stats.baseCurrency}
            icon="🏦"
            color="gold"
            trendLabel="Holdings + this month"
          />
          <KPICard
            title="Debt"
            value={stats.debtRemainingTotal}
            currency={stats.baseCurrency}
            icon="📉"
            color="red"
            trendLabel="Total owed"
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
            incomeBlockedNote={stats.incomeBlocked ? INCOME_BLOCKED_HINT : null}
          />
          <CategoryBar
            budgetCategories={budgetCategories}
            categorySpending={stats.categorySpending}
            categoryBudgetCaps={stats.categoryBudgetCaps}
            currency={stats.baseCurrency}
            incomeBlockedNote={stats.incomeBlocked ? INCOME_BLOCKED_HINT : null}
          />
        </div>

        {/* Savings + Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SavingsCard
            savingsTotal={stats.savingsTotal}
            savingsHoldingsTotal={stats.savingsHoldingsTotal}
            savingsFromExpenses={stats.savingsFromExpenses}
            savingsBudget={savingsBudget}
            currency={stats.baseCurrency}
          />
          <RecentExpenses expenses={stats.monthlyExpenses} />
        </div>

        {/* Debt Snapshot */}
        <DebtSnapshot />
      </div>

      <QuickAddFAB />
    </div>
  )
}
