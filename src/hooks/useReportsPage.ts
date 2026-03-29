'use client'

import { useState, useMemo, useCallback } from 'react'
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
import { useT } from '@/lib/i18n'
import type { DateRange } from '@/components/reports/ReportFilters'

/**
 * Date range filtering, aggregates, and export actions for the reports screen.
 */
export function useReportsPage() {
  const t = useT()
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
      let expSum = 0
      let savings = 0
      for (const e of filteredExpenses) {
        const d = parseISO(e.date)
        if (!isWithinInterval(d, { start: monthStart, end: monthEnd })) continue
        expSum += e.amountInBaseCurrency
        if (e.category === 'Savings') savings += e.amountInBaseCurrency
      }
      return { month: monthLabel, income, expenses: expSum, savings }
    })
  }, [filteredExpenses, incomeSources, settings.baseCurrency, exchangeRates, startDate, endDate])

  const methodBreakdown = getPaymentMethodBreakdown(filteredExpenses, paymentMethods)

  const largestExpense =
    filteredExpenses.length > 0
      ? filteredExpenses.reduce((max, e) => (e.amountInBaseCurrency > max.amountInBaseCurrency ? e : max))
      : null
  const mostUsedMethod =
    methodBreakdown.length > 0 ? methodBreakdown.reduce((max, m) => (m.count > max.count ? m : max)) : null

  const handleCopySummary = useCallback(() => {
    const summary = `${t.reports.summaryHeading(format(startDate, 'd MMM'), format(endDate, 'd MMM yyyy'))}
${t.reports.kpiTotalIn}: ${formatCurrency(periodRecurringIncome, settings.baseCurrency)}
${t.reports.kpiSentHome}: ${formatCurrency(remittances, settings.baseCurrency)}
${t.reports.kpiTotalOut}: ${formatCurrency(totalExpenses, settings.baseCurrency)}
${t.reports.kpiNetSaved}: ${formatCurrency(periodRecurringIncome - totalExpenses, settings.baseCurrency)}
${largestExpense ? `${t.reports.kpiBiggestPurchase}: ${largestExpense.description} (${formatCurrency(largestExpense.amountInBaseCurrency, settings.baseCurrency)})` : ''}
${mostUsedMethod ? `${t.reports.kpiGoToPayment}: ${mostUsedMethod.name} ${t.reports.timesUsed(mostUsedMethod.count)}` : ''}`
    void navigator.clipboard.writeText(summary)
  }, [
    endDate,
    largestExpense,
    mostUsedMethod,
    periodRecurringIncome,
    remittances,
    settings.baseCurrency,
    startDate,
    t,
    totalExpenses,
  ])

  const handleExportCSV = useCallback(() => {
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
  }, [dateRange, filteredExpenses])

  return {
    dateRange,
    setDateRange,
    settings,
    filteredExpenses,
    startDate,
    endDate,
    periodRecurringIncome,
    totalExpenses,
    remittances,
    categoryData,
    monthlyData,
    methodBreakdown,
    largestExpense,
    mostUsedMethod,
    handleCopySummary,
    handleExportCSV,
  }
}
