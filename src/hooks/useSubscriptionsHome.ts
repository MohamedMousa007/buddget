'use client'

import { useMemo } from 'react'
import { parseISO } from 'date-fns'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { localTodayISO } from '@/lib/utils/localDate'
import { convertCurrency } from '@/lib/utils/currency'
import { heroNumbers } from '@/lib/subscriptions/subscriptionForecast'
import { buildHomeLists, buildRow, type RowModel, type Segment } from '@/lib/subscriptions/subscriptionRows'
import { pickNudge, railInsights, thirtyDayStrip } from '@/lib/subscriptions/subscriptionNudges'

/** Everything the Subscriptions home renders, derived from the store for one segment. */
export function useSubscriptionsHome(segment: Segment) {
  const { subscriptions, expenses, base, rates } = useFinanceStore(
    useShallow((s) => ({
      subscriptions: s.subscriptions,
      expenses: s.expenses,
      base: s.settings.baseCurrency,
      rates: s.exchangeRates,
    })),
  )
  const dismissed = useSettingsStore((s) => s.dismissedBanners)
  const todayKey = localTodayISO()

  return useMemo(() => {
    const today = parseISO(todayKey)
    const rows: RowModel[] = subscriptions.map((s) => buildRow(s, expenses, today, base, rates))
    const toBase = (r: RowModel) => convertCurrency(r.amount, r.approx ? base : r.sub.currency, base, rates)
    return {
      today,
      rows,
      hero: heroNumbers(subscriptions, expenses, today, base, rates),
      lists: buildHomeLists(segment, rows, toBase),
      nudge: pickNudge(rows, today, new Set(dismissed)),
      strip: thirtyDayStrip(rows, today),
      insights: railInsights(rows),
      base,
    }
  }, [subscriptions, expenses, base, rates, segment, dismissed, todayKey])
}
