'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, subMonths, format } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useExpenseFilterStore, amountIsFiltered } from '@/lib/store/useExpenseFilterStore'
import { filterExpensesByMonth, expenseAmountInBase } from '@/lib/utils/calculations'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { ExpenseFilters } from '@/components/expenses/ExpenseFilters'
import { ExpenseDayList } from '@/components/expenses/ExpenseDayList'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useT } from '@/lib/i18n'
import { useHydrateExpenses } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'

function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseLocalMonth(yyyyMm: string): Date {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

/** Days counted toward the Avg / day figure: elapsed days for the current month, full length otherwise. */
// ponytail: ignores a non-1 monthStartDay offset — exact enough for the KPI.
function daysElapsed(yyyyMm: string): number {
  const [y, m] = yyyyMm.split('-').map(Number)
  const now = new Date()
  const isCurrent = now.getFullYear() === y && now.getMonth() === m - 1
  return isCurrent ? now.getDate() : new Date(y, m, 0).getDate()
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

  const totalAmount = filteredExpenses
    .filter((e) => !isNonSpendCategory(e.category))
    .reduce((sum, e) => sum + expenseAmountInBase(e, base, exchangeRates), 0)
  const totalUsd = showSecondary && secondary
    ? formatCurrency(convertCurrency(totalAmount, base, secondary, exchangeRates), secondary)
    : null

  const days = daysElapsed(monthFilter)
  const avgPerDay = days > 0 ? totalAmount / days : 0

  const prevMonth = () => setMonthFilter(format(subMonths(parseLocalMonth(monthFilter), 1), 'yyyy-MM'))
  const nextMonth = () => setMonthFilter(format(addMonths(parseLocalMonth(monthFilter), 1), 'yyyy-MM'))

  const addExpense = () =>
    requireAuth(() => setActiveModal('addExpense'), t.expenses.requireAuth)

  const navBtn =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] transition-colors hover:text-[var(--color-brand-text-primary)] active:translate-y-px'

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  return (
    <div className="pb-24 pt-2">
      {/* Month selector row */}
      <div className="flex items-center justify-between gap-2 px-[18px] pb-3 pt-2">
        <MonthYearPicker monthFilter={monthFilter} onChange={setMonthFilter} heroLabel />
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={prevMonth} className={navBtn} aria-label="Previous month">
            <ChevronLeft className="h-[17px] w-[17px]" />
          </button>
          <button type="button" onClick={nextMonth} className={navBtn} aria-label="Next month">
            <ChevronRight className="h-[17px] w-[17px]" />
          </button>
        </div>
      </div>

      {/* Summary (hero) card */}
      <div className="mx-4 rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-[18px] dark:bg-[linear-gradient(150deg,#1d1416,#121017)]">
        <div className="flex items-start justify-between gap-4">
          {/* Left: spent this month */}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
              {t.expenses.spentThisMonth}
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="font-mono-numbers text-[34px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-brand-text-primary)]">
                {fmtNum(totalAmount)}
              </span>
              <span className="text-sm font-medium text-[var(--color-brand-text-muted)]">{base}</span>
            </p>
            {totalUsd ? (
              <p className="font-mono-numbers mt-[5px] text-[13px] font-medium text-[var(--color-brand-text-muted)]">≈ {totalUsd}</p>
            ) : null}
          </div>
          {/* Right: avg / day + spending rate */}
          <div className="shrink-0 text-end">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
              {t.expenses.avgPerDay}
            </p>
            <p className="font-mono-numbers mt-2 text-base font-medium tabular-nums text-[var(--color-brand-text-secondary)]">
              {fmtNum(avgPerDay)}
            </p>
            <p className="mt-[3px] whitespace-nowrap text-[11px] font-medium text-[var(--color-brand-text-muted)]">
              {base} · {t.expenses.daysCount.replace('{n}', String(days))}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={addExpense}
          className="mt-4 h-11 w-full rounded-xl bg-[var(--color-brand-red)] text-[15px] font-semibold tracking-[-0.005em] text-white shadow-[0_10px_24px_-10px_rgba(229,9,20,0.55)] transition-transform hover:bg-[var(--color-brand-red-hover)] active:translate-y-px"
        >
          {t.expenses.addExpenseCta}
        </button>
      </div>

      <div className="mt-3.5 px-[18px]">
        <ExpenseFilters categories={categoryOptions} methods={methodOptions} resultCount={filteredExpenses.length} />
      </div>

      <ExpenseDayList expenses={filteredExpenses} />
    </div>
  )
}
