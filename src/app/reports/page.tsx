'use client'

import dynamic from 'next/dynamic'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { ChartPlaceholder } from '@/components/reports/ChartPlaceholder'
import { ReportFilters } from '@/components/reports/ReportFilters'
import { ReportExpenseDebtFilter } from '@/components/reports/ReportExpenseDebtFilter'
import { useReportsPage } from '@/hooks/useReportsPage'
import { expenseAmountInBase } from '@/lib/utils/calculations'
import { ReportsSummaryPanel } from '@/components/features/reports/ReportsSummaryPanel'
import { ReportsPaymentMethodPanel } from '@/components/features/reports/ReportsPaymentMethodPanel'
import { ReportsExportBar } from '@/components/features/reports/ReportsExportBar'
import { useT } from '@/lib/i18n'

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
  const t = useT()

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white">{t.reports.pageTitle}</h1>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-5xl mx-auto">
        <ReportFilters selected={r.dateRange} onSelect={r.setDateRange} />

        <ReportExpenseDebtFilter value={r.expenseDebtFilter} onChange={r.setExpenseDebtFilter} />

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MonthlyChart data={r.monthlyData} currency={r.settings.baseCurrency} />
          <CategoryPieChart data={r.categoryData} currency={r.settings.baseCurrency} />
        </div>

        <ReportsPaymentMethodPanel methods={r.methodBreakdown} baseCurrency={r.settings.baseCurrency} />

        <ReportsExportBar onExportCsv={r.handleExportCSV} onCopySummary={r.handleCopySummary} />
      </div>
    </div>
  )
}
