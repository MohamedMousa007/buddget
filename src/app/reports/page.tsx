'use client'

import dynamic from 'next/dynamic'
import { ChartPlaceholder } from '@/components/reports/ChartPlaceholder'
import { ReportFilters } from '@/components/reports/ReportFilters'
import { ReportExpenseDebtFilter } from '@/components/reports/ReportExpenseDebtFilter'
import { useReportsPage } from '@/hooks/useReportsPage'
import { expenseAmountInBase } from '@/lib/utils/calculations'
import { ReportsSummaryPanel } from '@/components/features/reports/ReportsSummaryPanel'
import { ReportsPaymentMethodPanel } from '@/components/features/reports/ReportsPaymentMethodPanel'
import { ReportsExportBar } from '@/components/features/reports/ReportsExportBar'
import { SpendingPacePanel } from '@/components/reports/SpendingPacePanel'
import { ReportsSavingsPanel } from '@/components/reports/ReportsSavingsPanel'
import { ReportsNetWorthPanel } from '@/components/reports/ReportsNetWorthPanel'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useHydrateExpenses, useHydrateIncome, useHydrateDebts, useHydrateSavings } from '@/hooks/remote'

const MonthlyChart = dynamic(
  () => import('@/components/reports/MonthlyChart').then((m) => ({ default: m.MonthlyChart })),
  { ssr: false, loading: () => <ChartPlaceholder /> }
)

const CategoryPieChart = dynamic(
  () => import('@/components/reports/CategoryPieChart').then((m) => ({ default: m.CategoryPieChart })),
  { ssr: false, loading: () => <ChartPlaceholder /> }
)

export default function ReportsPage() {
  useHydrateExpenses()
  useHydrateIncome()
  useHydrateDebts()
  useHydrateSavings()
  const r = useReportsPage()
  const stats = useMonthlyStats()

  return (
    <div>
      <div className="px-4 py-4 lg:px-6 space-y-4 max-w-6xl mx-auto">
        <ReportFilters selected={r.dateRange} onSelect={r.setDateRange} />

        <ReportExpenseDebtFilter value={r.expenseDebtFilter} onChange={r.setExpenseDebtFilter} />

        <ReportsNetWorthPanel />

        <ReportsSummaryPanel
          startDate={r.startDate}
          endDate={r.endDate}
          baseCurrency={r.settings.baseCurrency}
          periodRecurringIncome={r.periodRecurringIncome}
          remittances={r.remittances}
          totalExpenses={r.totalExpenses}
          largestExpense={r.largestExpense}
          largestExpenseInPrimary={
            r.largestExpense
              ? expenseAmountInBase(r.largestExpense, r.settings.baseCurrency, r.exchangeRates)
              : null
          }
          mostUsedMethod={r.mostUsedMethod}
        />

        <SpendingPacePanel
          dailyRate={stats.dailyRate}
          projectedSpend={stats.projectedSpend}
          totalExpenseBudget={stats.totalExpenseBudget}
          paceStatus={stats.paceStatus}
          suggestedDaily={stats.suggestedDaily}
          overBudgetCategories={stats.overBudgetCategories}
          currency={stats.baseCurrency}
        />

        <ReportsSavingsPanel
          transactions={r.savingsTransactions}
          startDate={r.startDate}
          endDate={r.endDate}
          baseCurrency={r.settings.baseCurrency}
          exchangeRates={r.exchangeRates}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MonthlyChart data={r.monthlyData} currency={r.settings.baseCurrency} />
          <CategoryPieChart data={r.categoryData} currency={r.settings.baseCurrency} />
        </div>

        <ReportsPaymentMethodPanel methods={r.methodBreakdown} baseCurrency={r.settings.baseCurrency} />

        <ReportsExportBar onExportCsv={r.handleExportCSV} onCopySummary={r.handleCopySummary} />
      </div>
    </div>
  )
}
