'use client'

import { useState, useMemo, useCallback } from 'react'
import { format, isWithinInterval, parseISO } from 'date-fns'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { formatCurrency, escapeCsvField } from '@/lib/utils/formatters'
import {
  actualIncomeForMonth,
  cashSavingsDepositsInBaseForMonth,
  filterExpensesByRange,
  getMonthRange,
  getPaymentMethodBreakdown,
  expenseAmountInBase,
} from '@/lib/utils/calculations'
import { reportCycles, reportRange, reportSpendRows } from '@/lib/reports/reportsPeriod'
import { isNonSpendExpense } from '@/lib/constants/categoryMeta'
import { downloadOrShareFile } from '@/lib/utils/exportFile'
import { useActionToast } from '@/components/ui/ActionToast'
import { useGoldQuote } from '@/hooks/useGoldQuote'
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
  const { expenses, incomeSources, incomeEvents, paymentMethods, settings, exchangeRates, savingsTransactions, savingsAccounts } =
    useFinanceStore(
      useShallow((s) => ({
        expenses: s.expenses,
        incomeSources: s.incomeSources,
        incomeEvents: s.incomeEvents,
        paymentMethods: s.paymentMethods,
        settings: s.settings,
        exchangeRates: s.exchangeRates,
        savingsTransactions: s.savingsTransactions,
        savingsAccounts: s.savingsAccounts,
      }))
    )
  const [dateRange, setDateRange] = useState<DateRange>('thisMonth')
  const [expenseDebtFilter, setExpenseDebtFilter] = useState<ExpenseDebtFilterMode>('all')
  const toast = useActionToast()
  const gold = useGoldQuote()
  const { monthStartDay, baseCurrency } = settings

  const { inPeriod, startDate, endDate, cycles } = useMemo(() => {
    const now = new Date()
    const { start, end } = reportRange(dateRange, now, monthStartDay)
    const inRange = filterExpensesByRange(expenses, { start, end })

    const filtered =
      expenseDebtFilter === 'all'
        ? inRange
        : expenseDebtFilter === 'debt_only'
          ? inRange.filter(isDebtLinkedExpense)
          : inRange.filter((e) => !isDebtLinkedExpense(e))

    return { inPeriod: filtered, startDate: start, endDate: end, cycles: reportCycles(dateRange, now, monthStartDay) }
  }, [expenses, dateRange, expenseDebtFilter, monthStartDay])
  // Spending leaves out money movements and rows the user marked not counted, like the Flow hero; the CSV keeps every logged row.
  const filteredExpenses = useMemo(() => reportSpendRows(inPeriod), [inPeriod])

  const incomeForCycle = useCallback(
    (cycle: string, realizedOnly: boolean) =>
      actualIncomeForMonth(incomeSources, incomeEvents, baseCurrency, exchangeRates, cycle, monthStartDay, realizedOnly),
    [incomeSources, incomeEvents, baseCurrency, exchangeRates, monthStartDay]
  )
  const { periodRecurringIncome, periodReceivedIncome } = useMemo(
    () => ({
      periodRecurringIncome: cycles.reduce((sum, c) => sum + incomeForCycle(c, false), 0),
      periodReceivedIncome: cycles.reduce((sum, c) => sum + incomeForCycle(c, true), 0),
    }),
    [cycles, incomeForCycle],
  )
  const { totalExpenses, remittances } = useMemo(() => {
    let total = 0
    let remit = 0
    for (const e of filteredExpenses) {
      const amount = expenseAmountInBase(e, baseCurrency, exchangeRates)
      total += amount
      if (e.category === 'Remittance') remit += amount
    }
    return { totalExpenses: total, remittances: remit }
  }, [filteredExpenses, baseCurrency, exchangeRates])

  const categoryData = useMemo(() => {
    const byCategory: Record<string, number> = {}
    for (const e of filteredExpenses) {
      byCategory[e.category] =
        (byCategory[e.category] || 0) + expenseAmountInBase(e, baseCurrency, exchangeRates)
    }
    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredExpenses, baseCurrency, exchangeRates])

  const monthlyData = useMemo(() => {
    return cycles.map((cycle) => {
      const window = getMonthRange(cycle, monthStartDay)
      const expSum = filterExpensesByRange(filteredExpenses, window).reduce(
        (sum, e) => sum + expenseAmountInBase(e, baseCurrency, exchangeRates),
        0
      )
      return {
        month: format(window.start, 'MMM yyyy'),
        income: incomeForCycle(cycle, false),
        expenses: expSum,
        savings: cashSavingsDepositsInBaseForMonth(savingsTransactions, cycle, monthStartDay, baseCurrency, exchangeRates, gold),
      }
    })
  }, [cycles, filteredExpenses, incomeForCycle, monthStartDay, baseCurrency, exchangeRates, savingsTransactions, gold])

  const methodBreakdown = useMemo(
    () => getPaymentMethodBreakdown(filteredExpenses, paymentMethods, baseCurrency, exchangeRates),
    [filteredExpenses, paymentMethods, baseCurrency, exchangeRates],
  )

  const largestExpense = useMemo(
    () =>
      filteredExpenses.length > 0
        ? filteredExpenses.reduce((max, e) =>
            expenseAmountInBase(e, baseCurrency, exchangeRates) >
            expenseAmountInBase(max, baseCurrency, exchangeRates)
              ? e
              : max
          )
        : null,
    [filteredExpenses, baseCurrency, exchangeRates],
  )
  const mostUsedMethod =
    methodBreakdown.length > 0 ? methodBreakdown.reduce((max, m) => (m.count > max.count ? m : max)) : null

  const handleCopySummary = useCallback(async () => {
    const summary = `${t.reports.summaryHeading(format(startDate, 'd MMM'), format(endDate, 'd MMM yyyy'))}
${t.reports.kpiTotalInExpected}: ${formatCurrency(periodRecurringIncome, baseCurrency)}
${t.reports.kpiReceivedSoFar(formatCurrency(periodReceivedIncome, baseCurrency))}
${t.reports.kpiSentHome}: ${formatCurrency(remittances, baseCurrency)}
${t.reports.kpiTotalOut}: ${formatCurrency(totalExpenses, baseCurrency)}
${t.reports.kpiNetCashFlow}: ${formatCurrency(periodRecurringIncome - totalExpenses, baseCurrency)}
${largestExpense ? `${t.reports.kpiBiggestPurchase}: ${largestExpense.description} (${formatCurrency(expenseAmountInBase(largestExpense, baseCurrency, exchangeRates), baseCurrency)})` : ''}
${mostUsedMethod ? `${t.reports.kpiGoToPayment}: ${mostUsedMethod.name} ${t.reports.timesUsed(mostUsedMethod.count)}` : ''}`
    try {
      await navigator.clipboard.writeText(summary)
      toast(t.reports.summaryCopied)
    } catch {
      toast(t.reports.summaryCopyFailed)
    }
  }, [
    endDate,
    exchangeRates,
    largestExpense,
    mostUsedMethod,
    periodRecurringIncome,
    periodReceivedIncome,
    remittances,
    baseCurrency,
    startDate,
    t,
    toast,
    totalExpenses,
  ])

  const handleExportCSV = useCallback(async () => {
    const accountNames = new Map(savingsAccounts.map((a) => [a.id, a.name]))
    const headers = 'Date,Description,Category,Amount,Currency,Base Amount,Counted in spending\n'
    const rows = inPeriod
      .map((e) =>
        [
          escapeCsvField(e.date),
          escapeCsvField(e.description),
          escapeCsvField(e.category),
          escapeCsvField(e.amount),
          escapeCsvField(e.currency),
          escapeCsvField(expenseAmountInBase(e, baseCurrency, exchangeRates)),
          escapeCsvField(isNonSpendExpense(e) ? 'no' : 'yes'),
        ].join(',')
      )
      .join('\n')
    const savHeader = '\n\nSavings ledger,Date,Account,Type,Amount,Currency,Notes\n'
    const savRows = savingsTransactions
      .filter((tx) => {
        const d = parseISO(tx.date.length > 10 ? tx.date : `${tx.date}T12:00:00`)
        return isWithinInterval(d, { start: startDate, end: endDate })
      })
      .map((tx) =>
        [
          '',
          escapeCsvField(tx.date),
          escapeCsvField(accountNames.get(tx.accountId) ?? ''),
          escapeCsvField(tx.type),
          escapeCsvField(tx.amount),
          escapeCsvField(tx.currency),
          escapeCsvField(tx.notes ?? ''),
        ].join(',')
      )
      .join('\n')
    const result = await downloadOrShareFile(`buddget-report-${dateRange}.csv`, headers + rows + savHeader + savRows, 'text/csv')
    if (result === 'saved') toast(t.expenses.fileSaved)
  }, [dateRange, inPeriod, savingsTransactions, savingsAccounts, startDate, endDate, baseCurrency, exchangeRates, toast, t])

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
    periodReceivedIncome,
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
