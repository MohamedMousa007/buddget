'use client'

import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { filterExpensesByMonth } from '@/lib/utils/calculations'
import { escapeCsvField } from '@/lib/utils/formatters'
import { addMonths, subMonths } from 'date-fns'
import { FilterBar } from '@/components/expenses/FilterBar'
import { ExpenseTable } from '@/components/expenses/ExpenseTable'
import { QuickAddFAB } from '@/components/modals/QuickAddFAB'
import type { ExpenseCategory } from '@/lib/store/types'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'

export default function ExpensesPage() {
  const { expenses, settings } = useFinanceStore(
    useShallow((s) => ({ expenses: s.expenses, settings: s.settings }))
  )
  const { monthFilter, setMonthFilter, setActiveModal } = useSettingsStore()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'All'>('All')
  const [methodFilter, setMethodFilter] = useState('All')

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

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amountInBaseCurrency, 0)

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
          <h1 className="text-xl font-bold text-white">Expenses</h1>
          <div className="flex items-center gap-2">
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
        onAddExpense={() => setActiveModal('addExpense')}
      />

      <QuickAddFAB />
    </div>
  )
}
