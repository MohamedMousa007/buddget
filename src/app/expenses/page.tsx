'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Plus, Download } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useExpenseFilterStore, amountIsFiltered } from '@/lib/store/useExpenseFilterStore'
import { filterExpensesByMonth, expenseAmountInBase } from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency, escapeCsvField } from '@/lib/utils/formatters'
import { ExpenseFilters } from '@/components/expenses/ExpenseFilters'
import { ExpenseDayList } from '@/components/expenses/ExpenseDayList'
import { MonthNavigationControl } from '@/components/layout/MonthNavigationControl'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useT } from '@/lib/i18n'
import { useHydrateExpenses } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'

function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ExpensesPage() {
  useHydrateExpenses()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const { expenses, settings, exchangeRates, paymentMethods } = useFinanceStore(
    useShallow((s) => ({
      expenses: s.expenses,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      paymentMethods: s.paymentMethods,
    })),
  )
  const { monthFilter, setMonthFilter, setActiveModal } = useSettingsStore()
  const { cats, methods, amtMin, amtMax } = useExpenseFilterStore(
    useShallow((s) => ({ cats: s.cats, methods: s.methods, amtMin: s.amtMin, amtMax: s.amtMax })),
  )
  const requireAuth = useRequireAuthAction()
  const t = useT()
  const base = settings.baseCurrency
  const secondary = settings.secondaryCurrency
  const showSecondary = settings.showSecondaryCurrency && secondary

  const monthExpenses = useMemo(
    () => filterExpensesByMonth(expenses, monthFilter, settings.monthStartDay),
    [expenses, monthFilter, settings.monthStartDay],
  )

  // Category options derived from the month's actual data (multi-select source).
  const categoryOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: { id: string; label: string }[] = []
    for (const e of monthExpenses) {
      if (e.category && !seen.has(e.category)) {
        seen.add(e.category)
        out.push({ id: e.category, label: e.category })
      }
    }
    return out
  }, [monthExpenses])

  const methodOptions = useMemo(
    () => paymentMethods.map((m) => ({ id: m.id, label: m.name, color: m.color || 'var(--color-brand-text-muted)' })),
    [paymentMethods],
  )

  const filteredExpenses = useMemo(() => {
    let result = monthExpenses
    if (cats.length) result = result.filter((e) => cats.includes(e.category))
    if (methods.length) result = result.filter((e) => methods.includes(e.paymentMethodId))
    // Only constrain by amount when the range was actually narrowed — otherwise
    // the default 0–10,000 cap would hide larger expenses (e.g. rent).
    if (amountIsFiltered(amtMin, amtMax)) {
      result = result.filter((e) => {
        const v = expenseAmountInBase(e, base, exchangeRates)
        return v >= amtMin && v <= amtMax
      })
    }
    return [...result].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [monthExpenses, cats, methods, amtMin, amtMax, base, exchangeRates])

  const totalAmount = filteredExpenses.reduce(
    (sum, e) => sum + expenseAmountInBase(e, base, exchangeRates),
    0,
  )
  const totalUsd = showSecondary && secondary
    ? formatCurrency(convertCurrency(totalAmount, base, secondary, exchangeRates), secondary)
    : null

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
        ].join(','),
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

  const addExpense = () =>
    requireAuth(() => setActiveModal('quickAdd'), t.expenses.requireAuth)

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  return (
    <div className="px-4 pb-[130px] pt-[14px]">
      {/* Header row: month switcher · export */}
      <div className="mb-[13px] flex items-center justify-between gap-2">
        <MonthNavigationControl monthFilter={monthFilter} onChange={setMonthFilter} compact />
        <button
          type="button"
          onClick={handleExport}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)]"
          aria-label={t.expenses.downloadData}
        >
          <Download className="h-[17px] w-[17px]" />
        </button>
      </div>

      {/* Stats card */}
      <div className="mb-[14px] rounded-[20px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-[16px_18px] dark:bg-[linear-gradient(150deg,#15151d,#101017)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-brand-text-muted)]">
              {t.expenses.spentThisMonth}
            </p>
            <p className="font-mono-numbers mt-[6px] text-[27px] font-bold leading-none tracking-[-0.5px] text-[var(--color-brand-text-primary)]">
              {fmtNum(totalAmount)}{' '}
              <span className="text-[13px] font-medium text-[var(--color-brand-text-muted)]">{base}</span>
            </p>
            {totalUsd ? (
              <p className="font-mono-numbers mt-1 text-[12px] text-[var(--color-brand-text-muted)]">≈ {totalUsd}</p>
            ) : null}
          </div>
          <div className="text-end">
            <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-brand-text-muted)]">
              {t.expenses.entries}
            </p>
            <p className="font-mono-numbers mt-[6px] text-[18px] font-bold text-[var(--color-brand-text-secondary)]">
              {filteredExpenses.length}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={addExpense}
          className="mt-[15px] flex h-[42px] w-full items-center justify-center gap-[7px] rounded-[13px] bg-[var(--color-brand-red)] text-[14px] font-bold text-white hover:bg-[var(--color-brand-red-hover)]"
        >
          <Plus className="h-[17px] w-[17px]" strokeWidth={2.4} />
          {t.expenses.addExpenseCta}
        </button>
      </div>

      <ExpenseFilters categories={categoryOptions} methods={methodOptions} resultCount={filteredExpenses.length} />

      <ExpenseDayList expenses={filteredExpenses} />
    </div>
  )
}
