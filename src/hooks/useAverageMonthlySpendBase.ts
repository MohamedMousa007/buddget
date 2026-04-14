'use client'

import { useMemo } from 'react'
import { subMonths } from 'date-fns'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { expenseAmountInBase, filterExpensesByMonth } from '@/lib/utils/calculations'

function monthStrFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Rolling average of total spending (all expenses, base currency) over the last 3 calendar months ending at `monthFilter`.
 */
export function useAverageMonthlySpendBase(): number {
  const { expenses, settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({
      expenses: s.expenses,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
    }))
  )
  const monthFilter = useSettingsStore((s) => s.monthFilter)

  return useMemo(() => {
    const [y, m] = monthFilter.split('-').map(Number)
    const anchor = new Date(y, m - 1, 1)
    let total = 0
    for (let i = 0; i < 3; i++) {
      const d = subMonths(anchor, i)
      const ms = monthStrFromDate(d)
      const list = filterExpensesByMonth(expenses, ms, settings.monthStartDay)
      total += list.reduce(
        (s, e) => s + expenseAmountInBase(e, settings.baseCurrency, exchangeRates),
        0
      )
    }
    return total / 3
  }, [expenses, exchangeRates, monthFilter, settings.baseCurrency, settings.monthStartDay])
}
