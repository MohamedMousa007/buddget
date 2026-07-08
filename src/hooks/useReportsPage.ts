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
  actualIncomeForMonth,
  getPaymentMethodBreakdown,
  expenseAmountInBase,
} from '@/lib/utils/calculations'
import { useT } from '@/lib/i18n'
import type { DateRange } from '@/components/reports/ReportFilters'
import type { ExpenseDebtFilterMode } from '@/components/reports/ReportExpenseDebtFilter'
import type { Expense } from '@/lib/store/types'

function isDebtLinkedExpense(e: Expense): boolean {
  return e.category === 'Debt' || e.isDebtPayment === true || Boolean(e.linkedDebtId)
}

/**
 * Date range filtering, aggregates, and export actions for the reports screen.
 */
export function useReportsPage() {
  const t = useT()
  const { expenses, incomeSources, incomeEvents, paymentMethods, settings, exchangeRates, savingsTransactions } =
    useFinanceStore(
      useShallow((s) => ({
        expenses: s.expenses,
        incomeSources: s.incomeSources,
        incomeEvents: s.incomeEvents,
        paymentMethods: s.paymentMethods,
        settings: s.settings,
        exchangeRates: s.exchangeRates,
        savingsTransactions: s.savingsTransactions,
      }))
    )
  const [dateRange, setDateRange] = useState<DateRange>('thisMonth')
  const [expenseDebtFilter, setExpenseDebtFilter] = useState<ExpenseDebtFilterMode>('all')

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

    const inRange = expenses.filter((e) => {
      const date = parseISO(e.date)
      return isWithinInterval(date, { start, end })
    })

    const filtered =
      expenseDebtFilter === 'all'
        ? inRange
        : expenseDebtFilter === 'debt_only'
          ? inRange.filter(isDebtLinkedExpense)
          : inRange.filter((e) => !isDebtLinkedExpense(e))

    return { filteredExpenses: filtered, startDate: start, endDate: end }
  }, [expenses, dateRange, expenseDebtFilter])

  // Actual income received across the period (events + projected fallback), summed
  // over each calendar month the range touches.
  const periodRecurringIncome = eachMonthOfInterval({
    start: startOfMonth(startDate),
    end: startOfMonth(endDate),
  }).reduce(
    (sum, m) =>
      sum +
      actualIncomeForMonth(
        incomeSources,
        incomeEvents,
        settings.baseCurrency,
        exchangeRates,
        format(m, 'yyyy-MM'),
        1
      ),
    0
  )
  const totalExpenses = filteredExpenses.reduce(
    (sum, e) => sum + expenseAmountInBase(e, settings.baseCurrency, exchangeRates),
    0
  )
  const remittances = filteredExpenses
    .filter((e) => e.category === 'Remittance')
    .reduce((sum, e) => sum + expenseAmountInBase(e, settings.baseCurrency, exchangeRates), 0)

  const categoryData = useMemo(() => {
    const byCategory: Record<string, number> = {}
    for (const e of filteredExpenses) {
      if (e.category === 'Savings') continue
      byCategory[e.category] =
        (byCategory[e.category] || 0) + expenseAmountInBase(e, settings.baseCurrency, exchangeRates)
    }
    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredExpenses, settings.baseCurrency, exchangeRates])

  const monthlyData = useMemo(() => {
    const monthStarts = eachMonthOfInterval({ start: startOfMonth(startDate), end: startOfMonth(endDate) })

    return monthStarts.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart)
      const monthLabel = format(monthStart, 'MMM yyyy')
      const income = actualIncomeForMonth(
        incomeSources,
        incomeEvents,
        settings.baseCurrency,
        exchangeRates,
        format(monthStart, 'yyyy-MM'),
        1
      )
      let expSum = 0
      let savings = 0
      for (const e of filteredExpenses) {
        const d = parseISO(e.date)
        if (!isWithinInterval(d, { start: monthStart, end: monthEnd })) continue
        const inBase = expenseAmountInBase(e, settings.baseCurrency, exchangeRates)
        expSum += inBase
        if (e.category === 'Savings') savings += inBase
      }
      return { month: monthLabel, income, expenses: expSum, savings }
    })
  }, [filteredExpenses, incomeSources, incomeEvents, settings.baseCurrency, exchangeRates, startDate, endDate])

  const methodBreakdown = getPaymentMethodBreakdown(
    filteredExpenses,
    paymentMethods,
    settings.baseCurrency,
    exchangeRates
  )

  const largestExpense =
    filteredExpenses.length > 0
      ? filteredExpenses.reduce((max, e) =>
          expenseAmountInBase(e, settings.baseCurrency, exchangeRates) >
          expenseAmountInBase(max, settings.baseCurrency, exchangeRates)
            ? e
            : max
        )
      : null
  const mostUsedMethod =
    methodBreakdown.length > 0 ? methodBreakdown.reduce((max, m) => (m.count > max.count ? m : max)) : null

  const handleCopySummary = useCallback(() => {
    const summary = `${t.reports.summaryHeading(format(startDate, 'd MMM'), format(endDate, 'd MMM yyyy'))}
${t.reports.kpiTotalIn}: ${formatCurrency(periodRecurringIncome, settings.baseCurrency)}
${t.reports.kpiSentHome}: ${formatCurrency(remittances, settings.baseCurrency)}
${t.reports.kpiTotalOut}: ${formatCurrency(totalExpenses, settings.baseCurrency)}
${t.reports.kpiNetSaved}: ${formatCurrency(periodRecurringIncome - totalExpenses, settings.baseCurrency)}
${largestExpense ? `${t.reports.kpiBiggestPurchase}: ${largestExpense.description} (${formatCurrency(expenseAmountInBase(largestExpense, settings.baseCurrency, exchangeRates), settings.baseCurrency)})` : ''}
${mostUsedMethod ? `${t.reports.kpiGoToPayment}: ${mostUsedMethod.name} ${t.reports.timesUsed(mostUsedMethod.count)}` : ''}`
    void navigator.clipboard.writeText(summary)
  }, [
    endDate,
    exchangeRates,
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
          escapeCsvField(expenseAmountInBase(e, settings.baseCurrency, exchangeRates)),
        ].join(',')
      )
      .join('\n')
    const savHeader = '\n\nSavings ledger,Date,AccountId,Type,Amount,Currency,Notes\n'
    const savRows = savingsTransactions
      .filter((t) => {
        const d = parseISO(t.date.length > 10 ? t.date : `${t.date}T12:00:00`)
        return isWithinInterval(d, { start: startDate, end: endDate })
      })
      .map((t) =>
        [
          '',
          escapeCsvField(t.date),
          escapeCsvField(t.accountId),
          escapeCsvField(t.type),
          escapeCsvField(t.amount),
          escapeCsvField(t.currency),
          escapeCsvField(t.notes ?? ''),
        ].join(',')
      )
      .join('\n')
    const blob = new Blob([headers + rows + savHeader + savRows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `buddget-report-${dateRange}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [dateRange, filteredExpenses, savingsTransactions, startDate, endDate, settings.baseCurrency, exchangeRates])

  return {
    dateRange,
    setDateRange,
    expenseDebtFilter,
    setExpenseDebtFilter,
    settings,
    exchangeRates,
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
    savingsTransactions,
  }
}
