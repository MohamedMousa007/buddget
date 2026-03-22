'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  isWithinInterval,
  parseISO,
  eachMonthOfInterval,
} from 'date-fns'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { formatCurrency, escapeCsvField } from '@/lib/utils/formatters'
import {
  calculateRecurringIncomeForCalendarMonth,
  sumRecurringIncomeOverDateRange,
  getPaymentMethodBreakdown,
} from '@/lib/utils/calculations'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { ChartPlaceholder } from '@/components/reports/ChartPlaceholder'
import { ReportFilters, type DateRange } from '@/components/reports/ReportFilters'
import { Download, Copy } from 'lucide-react'

const MonthlyChart = dynamic(
  () => import('@/components/reports/MonthlyChart').then((m) => ({ default: m.MonthlyChart })),
  { ssr: false, loading: () => <ChartPlaceholder /> }
)

const CategoryPieChart = dynamic(
  () => import('@/components/reports/CategoryPieChart').then((m) => ({ default: m.CategoryPieChart })),
  { ssr: false, loading: () => <ChartPlaceholder /> }
)

export default function ReportsPage() {
  const { expenses, incomeSources, paymentMethods, settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({
      expenses: s.expenses,
      incomeSources: s.incomeSources,
      paymentMethods: s.paymentMethods,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
    }))
  )
  const [dateRange, setDateRange] = useState<DateRange>('thisMonth')

  const { filteredExpenses, startDate, endDate } = useMemo(() => {
    const now = new Date()
    let start: Date
    let end = endOfMonth(now)

    switch (dateRange) {
      case 'thisMonth':
        start = startOfMonth(now)
        break
      case 'lastMonth':
        start = startOfMonth(subMonths(now, 1))
        end = endOfMonth(subMonths(now, 1))
        break
      case 'last3Months':
        start = startOfMonth(subMonths(now, 2))
        break
      case 'last6Months':
        start = startOfMonth(subMonths(now, 5))
        break
      case 'thisYear':
        start = startOfYear(now)
        break
      default:
        start = startOfMonth(now)
    }

    const filtered = expenses.filter((e) => {
      const date = parseISO(e.date)
      return isWithinInterval(date, { start, end })
    })

    return { filteredExpenses: filtered, startDate: start, endDate: end }
  }, [expenses, dateRange])

  const periodRecurringIncome = sumRecurringIncomeOverDateRange(
    incomeSources,
    settings.baseCurrency,
    exchangeRates,
    startDate,
    endDate
  )
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amountInBaseCurrency, 0)
  const remittances = filteredExpenses
    .filter((e) => e.category === 'Remittance')
    .reduce((sum, e) => sum + e.amountInBaseCurrency, 0)
  const categoryData = useMemo(() => {
    const byCategory: Record<string, number> = {}
    for (const e of filteredExpenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amountInBaseCurrency
    }
    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredExpenses])

  const monthlyData = useMemo(() => {
    const monthStarts = eachMonthOfInterval({ start: startOfMonth(startDate), end: startOfMonth(endDate) })

    return monthStarts.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart)
      const monthLabel = format(monthStart, 'MMM yyyy')
      const income = calculateRecurringIncomeForCalendarMonth(
        incomeSources,
        settings.baseCurrency,
        exchangeRates,
        monthStart
      )
      let expenses = 0
      let savings = 0
      for (const e of filteredExpenses) {
        const d = parseISO(e.date)
        if (!isWithinInterval(d, { start: monthStart, end: monthEnd })) continue
        expenses += e.amountInBaseCurrency
        if (e.category === 'Savings') savings += e.amountInBaseCurrency
      }
      return { month: monthLabel, income, expenses, savings }
    })
  }, [filteredExpenses, incomeSources, settings.baseCurrency, exchangeRates, startDate, endDate])

  const methodBreakdown = getPaymentMethodBreakdown(filteredExpenses, paymentMethods)

  const largestExpense = filteredExpenses.length > 0
    ? filteredExpenses.reduce((max, e) => e.amountInBaseCurrency > max.amountInBaseCurrency ? e : max)
    : null
  const mostUsedMethod = methodBreakdown.length > 0
    ? methodBreakdown.reduce((max, m) => m.count > max.count ? m : max)
    : null

  const handleCopySummary = () => {
    const summary = `Period: ${format(startDate, 'd MMM')} – ${format(endDate, 'd MMM yyyy')}
Recurring income (period total): ${formatCurrency(periodRecurringIncome, settings.baseCurrency)}
Total Remittances: ${formatCurrency(remittances, settings.baseCurrency)}
Total Expenses: ${formatCurrency(totalExpenses, settings.baseCurrency)}
Net (recurring income − expenses): ${formatCurrency(periodRecurringIncome - totalExpenses, settings.baseCurrency)}
${largestExpense ? `Largest Expense: ${largestExpense.description} (${formatCurrency(largestExpense.amountInBaseCurrency, settings.baseCurrency)})` : ''}
${mostUsedMethod ? `Most Used Method: ${mostUsedMethod.name} (${mostUsedMethod.count} times)` : ''}`
    navigator.clipboard.writeText(summary)
  }

  const handleExportCSV = () => {
    const headers = 'Date,Description,Category,Amount,Currency,Base Amount\n'
    const rows = filteredExpenses
      .map((e) =>
        [
          escapeCsvField(e.date),
          escapeCsvField(e.description),
          escapeCsvField(e.category),
          escapeCsvField(e.amount),
          escapeCsvField(e.currency),
          escapeCsvField(e.amountInBaseCurrency),
        ].join(',')
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `buddget-report-${dateRange}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white">Reports</h1>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-5xl mx-auto">
        <ReportFilters selected={dateRange} onSelect={setDateRange} />

        {/* Summary Stats */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-4">
            Summary — {format(startDate, 'd MMM')} – {format(endDate, 'd MMM yyyy')}
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[var(--color-brand-text-muted)]">Recurring income (period)</p>
              <p className="text-lg font-bold font-mono-numbers text-[var(--color-brand-green)]">
                {formatCurrency(periodRecurringIncome, settings.baseCurrency)}
              </p>
              <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-0.5 max-w-[14rem]">
                Sum of monthly recurring sources for each calendar month in this range (sources count only after their start date).
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-brand-text-muted)]">Total Remittances</p>
              <p className="text-lg font-bold font-mono-numbers text-[var(--color-brand-amber)]">
                {formatCurrency(remittances, settings.baseCurrency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-brand-text-muted)]">Total Expenses</p>
              <p className="text-lg font-bold font-mono-numbers text-[var(--color-brand-red)]">
                {formatCurrency(totalExpenses, settings.baseCurrency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-brand-text-muted)]">Net (income − expenses)</p>
              <p className="text-lg font-bold font-mono-numbers text-white">
                {formatCurrency(periodRecurringIncome - totalExpenses, settings.baseCurrency)}
              </p>
            </div>
            {largestExpense && (
              <div>
                <p className="text-xs text-[var(--color-brand-text-muted)]">Largest Expense</p>
                <p className="text-sm font-medium text-white">
                  {largestExpense.description}
                  <span className="text-[var(--color-brand-text-secondary)] ml-1 font-mono-numbers">
                    ({formatCurrency(largestExpense.amountInBaseCurrency, settings.baseCurrency)})
                  </span>
                </p>
              </div>
            )}
            {mostUsedMethod && (
              <div>
                <p className="text-xs text-[var(--color-brand-text-muted)]">Most Used Method</p>
                <p className="text-sm font-medium text-white">
                  {mostUsedMethod.name}
                  <span className="text-[var(--color-brand-text-secondary)] ml-1">
                    ({mostUsedMethod.count} times)
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MonthlyChart data={monthlyData} currency={settings.baseCurrency} />
          <CategoryPieChart data={categoryData} currency={settings.baseCurrency} />
        </div>

        {/* Payment Method Breakdown */}
        {methodBreakdown.length > 0 && (
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-4">
              Payment Method Breakdown
            </h3>
            <div className="space-y-2">
              {methodBreakdown
                .sort((a, b) => b.total - a.total)
                .map((method) => (
                  <div key={method.name} className="flex items-center justify-between py-2 border-b border-[var(--color-brand-border)] last:border-0">
                    <span className="text-sm text-white">{method.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-[var(--color-brand-text-muted)]">
                        {method.count} transaction{method.count !== 1 ? 's' : ''}
                      </span>
                      <span className="text-sm font-mono-numbers text-white">
                        {formatCurrency(method.total, settings.baseCurrency)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Export Options */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy Summary
          </button>
        </div>
      </div>
    </div>
  )
}
