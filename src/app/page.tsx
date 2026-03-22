'use client'

import { useMonthlyStats } from '@/lib/hooks/useMonthlyStats'
import { useRates } from '@/lib/hooks/useRates'
import { useGoldPrice } from '@/lib/hooks/useGoldPrice'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { addMonths, subMonths } from 'date-fns'
import { KPICard } from '@/components/dashboard/KPICard'
import { BudgetRing } from '@/components/dashboard/BudgetRing'
import { CategoryBar } from '@/components/dashboard/CategoryBar'
import { RecentExpenses } from '@/components/dashboard/RecentExpenses'
import { SavingsCard } from '@/components/dashboard/SavingsCard'
import { DebtSnapshot } from '@/components/dashboard/DebtSnapshot'
import { QuickAddFAB } from '@/components/modals/QuickAddFAB'
import { BarChart3, Bell } from 'lucide-react'
import Link from 'next/link'
import { AuthNavButtons } from '@/components/layout/AuthNavButtons'
import { useRouter } from 'next/navigation'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'
import { PAGE_HEADER_SURFACE_CLASS } from '@/components/layout/PageHeader'

export default function DashboardPage() {
  useRates()
  useGoldPrice()
  const router = useRouter()

  const { budgetCategories } = useFinanceStore(useShallow((s) => ({ budgetCategories: s.budgetCategories })))
  const { monthFilter, setMonthFilter } = useSettingsStore()
  const stats = useMonthlyStats()

  const savingsBudget = budgetCategories.find((b) => b.category === 'Savings')?.budgetedAmount || 0

  return (
    <div className="min-h-screen">
      <header className={PAGE_HEADER_SURFACE_CLASS}>
        <div className="flex items-center justify-between px-4 py-3 lg:px-8">
          <div className="lg:hidden">
            <span className="text-xl font-bold font-heading tracking-tight">
              Bud<span className="text-[var(--color-brand-red)]">d</span>get
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/reports"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--color-brand-elevated)] text-sm text-white hover:bg-[var(--color-brand-border)] transition-colors"
              aria-label="Reports"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden md:inline">Reports</span>
            </Link>
            <button
              onClick={() => setMonthFilter(subMonths(new Date(`${monthFilter}-01`), 1).toISOString().slice(0, 7))}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--color-brand-elevated)] text-sm text-white hover:bg-[var(--color-brand-border)] transition-colors"
              aria-label="Previous month"
            >
              ←
            </button>
            <MonthYearPicker
              monthFilter={monthFilter}
              onChange={setMonthFilter}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-brand-elevated)] text-sm text-white"
            />
            <button
              onClick={() => setMonthFilter(addMonths(new Date(`${monthFilter}-01`), 1).toISOString().slice(0, 7))}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--color-brand-elevated)] text-sm text-white hover:bg-[var(--color-brand-border)] transition-colors"
              aria-label="Next month"
            >
              →
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-[var(--color-brand-text-secondary)]" />
            </button>
            <AuthNavButtons />
          </div>
        </div>
      </header>

      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-5xl mx-auto">
        {/* KPI Strip */}
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
          <KPICard
            title="Income"
            value={stats.totalIncome}
            currency={stats.baseCurrency}
            icon="💵"
            trendLabel="This month"
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
          />
          <CategoryBar
            budgetCategories={budgetCategories}
            categorySpending={stats.categorySpending}
            categoryBudgetCaps={stats.categoryBudgetCaps}
            currency={stats.baseCurrency}
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
