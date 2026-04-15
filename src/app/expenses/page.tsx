'use client'

import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { filterExpensesByMonth, expenseAmountInBase } from '@/lib/utils/calculations'
import { escapeCsvField } from '@/lib/utils/formatters'
import { FilterBar } from '@/components/expenses/FilterBar'
import { ExpenseTable } from '@/components/expenses/ExpenseTable'

import { MonthNavigationControl } from '@/components/layout/MonthNavigationControl'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { Receipt } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useHydrateExpenses } from '@/hooks/remote'

export default function ExpensesPage() {
  useHydrateExpenses()
  const { expenses, settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({
      expenses: s.expenses,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
    }))
  )
  const { monthFilter, setMonthFilter, setActiveModal } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const t = useT()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('All')
  const [methodFilter, setMethodFilter] = useState(() => {
    if (typeof window === 'undefined') return 'All'
    const q = new URLSearchParams(window.location.search).get('pm')
    return q || 'All'
  })

  const filteredExpenses = useMemo(() => {
    let result = filterExpensesByMonth(expenses, monthFilter, settings.monthStartDay)

    if (categoryFilter !== 'All') {
      result = result.filter((e) => e.category === categoryFilter)
    }

    if (methodFilter !== 'All') {
      result = result.filter((e) => e.paymentMethodId === methodFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.notes?.toLowerCase().includes(q)
      )
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [expenses, monthFilter, settings.monthStartDay, categoryFilter, methodFilter, search])

  const totalAmount = filteredExpenses.reduce(
    (sum, e) => sum + expenseAmountInBase(e, settings.baseCurrency, exchangeRates),
    0
  )

  const handleExport = () => {
    const headers = 'Date,Description,Category,Amount,Currency,Payment Method\n'
    const rows = filteredExpenses
      .map((e) =>
        [
          escapeCsvField(e.date),
          escapeCsvField(e.description),
          escapeCsvField(e.category),
          escapeCsvField(e.amount),
          escapeCsvField(e.currency),
          escapeCsvField(e.paymentMethodId),
        ].join(',')
      )
      .join('\n')

    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `buddget-expenses-${monthFilter}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)] flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[var(--color-brand-red)]" />
            {t.expenses.pageTitle}
          </h1>
          <MonthNavigationControl monthFilter={monthFilter} onChange={setMonthFilter} />
        </PageHeaderContent>
      </PageHeader>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        methodFilter={methodFilter}
        onMethodChange={setMethodFilter}
        onExport={handleExport}
      />

      <ExpenseTable
        expenses={filteredExpenses}
        totalAmount={totalAmount}
        currency={settings.baseCurrency}
        onAddExpense={() =>
          requireAuth(
            () => setActiveModal('addExpense'),
            t.expenses.requireAuth
          )
        }
      />
    </div>
  )
}
