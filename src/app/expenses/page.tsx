'use client'

import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, subMonths, format } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useExpenseFilterStore, amountIsFiltered } from '@/lib/store/useExpenseFilterStore'
import { daysInRange, formatCustomRange, resolveRange } from '@/lib/expenses/dateRange'
import { useRangeLabel } from '@/lib/expenses/useRangeLabel'
import { filterExpensesByRange, expenseAmountInBase } from '@/lib/utils/calculations'
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
  const { cats, methods, amtMin, amtMax, range, pruneCats } = useExpenseFilterStore(
    useShallow((s) => ({
      cats: s.cats,
      methods: s.methods,
      amtMin: s.amtMin,
      amtMax: s.amtMax,
      range: s.range,
      pruneCats: s.pruneCats,
    })),
  )
  const requireAuth = useRequireAuthAction()
  const t = useT()
  const base = settings.baseCurrency
  const secondary = settings.secondaryCurrency
  const showSecondary = settings.showSecondaryCurrency && secondary

  const resolved = useMemo(
    () => resolveRange(range, monthFilter, settings.monthStartDay),
    [range, monthFilter, settings.monthStartDay],
  )

  const monthExpenses = useMemo(
    () => filterExpensesByRange(expenses, resolved),
    [expenses, resolved],
  )

  // Category options derived from the range's actual data (multi-select source).
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

  // Narrowing the range shrinks the category options; a selection that survives but no
  // longer exists would zero the list with no visible chip explaining why.
  useEffect(() => {
    pruneCats(categoryOptions.map((c) => c.id))
  }, [categoryOptions, pruneCats])

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

  const days = daysInRange(resolved)
  const avgPerDay = totalAmount / days

  // The label must follow the range — "Spent this month" was hardcoded, so it read wrong
  // even today when paging back a month. Custom dates render separately, in mono, so an
  // Arabic label with Latin digits can't bidi-scramble.
  const heroLabel =
    range.preset === 'today'
      ? t.expenses.spentToday
      : range.preset === 'yesterday'
        ? t.expenses.spentYesterday
        : range.preset === 'week'
          ? t.expenses.spentThisWeek
          : range.preset === 'custom'
            ? t.expenses.spentRange
            : t.expenses.spentThisMonth
  const heroDates = range.preset === 'custom' ? formatCustomRange(resolved) : null
  const rangeChipLabel = useRangeLabel(range, resolved)

  const prevMonth = () => setMonthFilter(format(subMonths(parseLocalMonth(monthFilter), 1), 'yyyy-MM'))
  const nextMonth = () => setMonthFilter(format(addMonths(parseLocalMonth(monthFilter), 1), 'yyyy-MM'))

  const addExpense = () =>
    requireAuth(() => setActiveModal('addExpense'), t.expenses.requireAuth)

  const navBtn =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] transition-colors hover:text-[var(--color-brand-text-primary)] active:translate-y-px'

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  return (
    <div className="pb-24 pt-2">
      {/* Month selector row — only meaningful for the month preset; a Today/week/custom
          range has no month to page through, and the range chip owns the label there. */}
      {range.preset === 'month' ? (
        <div className="flex items-center justify-between gap-2 px-[18px] pb-3 pt-2">
          <MonthYearPicker monthFilter={monthFilter} onChange={setMonthFilter} heroLabel />
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={prevMonth} className={navBtn} aria-label={t.common.previousMonth}>
              <ChevronLeft className="h-[17px] w-[17px]" />
            </button>
            <button type="button" onClick={nextMonth} className={navBtn} aria-label={t.common.nextMonth}>
              <ChevronRight className="h-[17px] w-[17px]" />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-[18px] pb-3 pt-2">
          <span className="text-[21px] font-bold leading-none tracking-[-0.015em] text-[var(--color-brand-text-primary)]">
            {rangeChipLabel}
          </span>
        </div>
      )}

      {/* Summary (hero) card */}
      <div className="mx-4 rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-[18px] dark:bg-[linear-gradient(150deg,#1d1416,#121017)]">
        <div className="flex items-start justify-between gap-4">
          {/* Left: spent this month */}
          <div className="min-w-0">
            {/* min-h-[2em]: the label wraps to 2 lines in Arabic / for custom ranges, and
                the left column is min-w-0 — without this the amount's baseline shifts. */}
            <p className="flex min-h-[2em] flex-wrap items-start gap-x-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
              <span>{heroLabel}</span>
              {heroDates ? <span className="font-mono-numbers normal-case">{heroDates}</span> : null}
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
              {base} · {days === 1 ? t.expenses.daysCountOne : t.expenses.daysCount.replace('{n}', String(days))}
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
        <ExpenseFilters
          categories={categoryOptions}
          methods={methodOptions}
          resultCount={filteredExpenses.length}
          rangeLabel={rangeChipLabel}
        />
      </div>

      <ExpenseDayList expenses={filteredExpenses} />
    </div>
  )
}
