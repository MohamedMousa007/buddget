'use client'

import { PageBody, PageDivider } from '@/components/layout/PageContainer'
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
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { reportCycles } from '@/lib/reports/reportsPeriod'

const MonthlyChart = dynamic(
  () => import('@/components/reports/MonthlyChart').then((m) => ({ default: m.MonthlyChart })),
  { ssr: false, loading: () => <ChartPlaceholder /> }
)

const CategoryPieChart = dynamic(
  () => import('@/components/reports/CategoryPieChart').then((m) => ({ default: m.CategoryPieChart })),
  { ssr: false, loading: () => <ChartPlaceholder /> }
)

export default function ReportsPage() {
  const r = useReportsPage()
  const stats = useMonthlyStats()
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  // The pace panel reads the viewed month's stats, so it shows only when that month is the report's current cycle.
  const paceInRange = r.dateRange === 'thisMonth' && reportCycles('thisMonth', new Date(), r.settings.monthStartDay).at(-1) === monthFilter

  return (
    <div>
      <PageBody className="space-y-4">
        <ReportFilters selected={r.dateRange} onSelect={r.setDateRange} />

        <ReportExpenseDebtFilter value={r.expenseDebtFilter} onChange={r.setExpenseDebtFilter} />

        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        <ReportsNetWorthPanel />

        <ReportsSummaryPanel
          startDate={r.startDate}
          endDate={r.endDate}
          baseCurrency={r.settings.baseCurrency}
          periodRecurringIncome={r.periodRecurringIncome}
          periodReceivedIncome={r.periodReceivedIncome}
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
        </div>

        <PageDivider />

        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        {paceInRange && stats.monthClosed === false && (
        <SpendingPacePanel
          dailyRate={stats.dailyRate}
          projectedSpend={stats.projectedSpend}
          totalExpenseBudget={stats.totalExpenseBudget}
          paceStatus={stats.paceStatus}
          suggestedDaily={stats.suggestedDaily}
          overBudgetCategories={stats.overBudgetCategories}
          currency={stats.baseCurrency}
        />
        )}

        <ReportsSavingsPanel
          transactions={r.savingsTransactions}
          startDate={r.startDate}
          endDate={r.endDate}
          baseCurrency={r.settings.baseCurrency}
          exchangeRates={r.exchangeRates}
        />
        </div>

        <PageDivider />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MonthlyChart data={r.monthlyData} currency={r.settings.baseCurrency} />
          <CategoryPieChart data={r.categoryData} currency={r.settings.baseCurrency} />
        </div>

        <ReportsPaymentMethodPanel methods={r.methodBreakdown} baseCurrency={r.settings.baseCurrency} />

        <ReportsExportBar onExportCsv={r.handleExportCSV} onCopySummary={r.handleCopySummary} />
      </PageBody>
    </div>
  )
}
