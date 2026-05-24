'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { isNative } from '@/lib/native/isNative'
import { updateWidgetData, type WidgetSnapshot } from '@/lib/native/widgetBridge'

const DEBOUNCE_MS = 600

/**
 * Mirrors the most relevant dashboard figures into the OS-shared keystore so
 * iOS WidgetKit / Android Glance can render an up-to-date widget. Runs only
 * inside the Capacitor shell.
 */
export function WidgetSync() {
  const { expenses, baseCurrency, language, monthlyBudgetTotal, monthlyBudgetCurrency } =
    useFinanceStore(
      useShallow((s) => ({
        expenses: s.expenses,
        baseCurrency: s.settings.baseCurrency,
        language: s.settings.language,
        monthlyBudgetTotal: sumBudget(s.budgetCategories),
        monthlyBudgetCurrency: s.settings.baseCurrency,
      })),
    )
  const monthFilter = useSettingsStore((s) => s.monthFilter)

  const snapshot = useMemo<WidgetSnapshot>(() => {
    const monthExpenses = expenses.filter((e) => e.date.startsWith(monthFilter))
    const spentThisMonth = monthExpenses.reduce((sum, e) => sum + (e.amountInBaseCurrency || 0), 0)

    const byCategory = new Map<string, number>()
    for (const e of monthExpenses) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + (e.amountInBaseCurrency || 0))
    }
    const topCategories = Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)

    const latest = [...monthExpenses].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
    const locale = language === 'ar' ? 'ar-EG' : 'en-EG'

    return {
      currency: baseCurrency || 'EGP',
      spentThisMonth: Math.round(spentThisMonth * 100) / 100,
      monthlyBudget: Math.round(monthlyBudgetTotal * 100) / 100,
      topCategories,
      latestExpense: latest
        ? {
            description: latest.description,
            amount: latest.amount,
            currency: latest.currency,
            date: latest.date,
          }
        : null,
      locale,
      updatedAt: new Date().toISOString(),
    }
  }, [expenses, monthFilter, baseCurrency, language, monthlyBudgetTotal])

  // We intentionally don't use the cross-currency value but keep the field
  // present in the union for future expansion.
  void monthlyBudgetCurrency

  const lastSnapshotRef = useRef<string>('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isNative()) return
    const json = JSON.stringify(snapshot)
    if (json === lastSnapshotRef.current) return
    lastSnapshotRef.current = json
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void updateWidgetData(snapshot)
    }, DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [snapshot])

  return null
}

function sumBudget(rows: Array<{ budgetedAmount: number; category: string }>): number {
  return rows
    .filter((r) => r.category !== 'Savings' && r.category !== 'Debt' && r.category !== 'Remittance')
    .reduce((sum, r) => sum + (r.budgetedAmount || 0), 0)
}
