'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format } from 'date-fns'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { amountIsFiltered, useExpenseFilterStore } from '@/lib/store/useExpenseFilterStore'
import { getMonthRange, recurringActiveForWindow } from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { buildOccurrences, isRealizedOccurrence } from '@/lib/utils/incomeOccurrences'
import { formatFixed2, formatSigned, formatWhole } from '@/lib/utils/formatters'
import { shortDate } from '@/lib/utils/shortDate'
import { totalDaysInMonth } from '@/lib/utils/spendingPace'
import { useIncomeResolution } from '@/components/features/flow/IncomePrompts'
import type { FlowSummaryBandProps } from '@/components/features/flow/FlowSummaryBand'
import type { FlowStickyStripProps } from '@/components/features/flow/FlowStickyStrip'
import type { FlowItem } from '@/components/features/flow/useFlowLedger'
import type { ResolvedRange } from '@/lib/expenses/dateRange'
import { useLocale, useT } from '@/lib/i18n'

type Sticky = Omit<FlowStickyStripProps, 'visible'>

export interface FlowBandModel {
  band: FlowSummaryBandProps
  sticky: Sticky
  /** Payday receipts this month in base — the In segment's figures, also used by Paydays. */
  monthName: string
}

/**
 * The band for the current segment and filters (BEHAVIOR.md → "Flow band by segment").
 * `items` is the filtered ledger; `all` is the unfiltered range, for Money in.
 */
export function useFlowBand({
  items,
  all,
  resolved,
  filterNames,
  filterCount,
  loading,
  onSetBudget,
}: {
  items: FlowItem[]
  all: FlowItem[]
  resolved: ResolvedRange
  filterNames: string[]
  filterCount: number
  loading: boolean
  onSetBudget: () => void
}): FlowBandModel {
  const t = useT()
  const { locale } = useLocale()
  const stats = useMonthlyStats()
  const { netWorth } = useNetWorth()
  const { incomeSources, incomeEvents, rates, base, monthStartDay } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      rates: s.exchangeRates,
      base: s.settings.baseCurrency,
      monthStartDay: s.settings.monthStartDay,
    })),
  )
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const { segment, cats, methods, amtMin, amtMax, rangePreset } = useExpenseFilterStore(
    useShallow((s) => ({
      segment: s.segment,
      cats: s.cats,
      methods: s.methods,
      amtMin: s.amtMin,
      amtMax: s.amtMax,
      rangePreset: s.range.preset,
    })),
  )
  const { matches, late } = useIncomeResolution()

  // Recurring paydays this month: expected vs what has actually been recorded.
  const paydays = useMemo(() => {
    const { start, end } = getMonthRange(monthFilter, monthStartDay)
    let expected = 0
    let received = 0
    let open = 0
    let total = 0
    for (const s of incomeSources) {
      if (!s.isRecurring || !recurringActiveForWindow(s, start, end)) continue
      for (const o of buildOccurrences(s, incomeEvents, monthFilter, monthStartDay)) {
        total++
        expected += convertCurrency(s.amount, s.currency, base, rates)
        if (isRealizedOccurrence(o)) received += convertCurrency(o.amount, o.currency, base, rates)
        else if (!o.eventId) open++
      }
    }
    return { expected, received, open, total }
  }, [incomeSources, incomeEvents, monthFilter, monthStartDay, base, rates])

  return useMemo(() => {
    const monthDate = new Date(`${monthFilter}-01T00:00:00`)
    const monthName = new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-US', { month: 'long' }).format(monthDate)
    const startLabel = shortDate(format(resolved.start, 'yyyy-MM-dd'))
    const endLabel = shortDate(format(resolved.end, 'yyyy-MM-dd'))
    const moneyIn = all.filter((i) => i.dir === 'in' && i.counted).reduce((s, i) => s + i.amountBase, 0)
    const spent = stats.totalSpentExcludingSavings
    const budget = stats.totalExpenseBudget
    const totalDays = totalDaysInMonth(monthFilter, monthStartDay)
    const tick = (Math.min(stats.daysElapsed, totalDays) / totalDays) * 100
    const allStats = (v?: string) => [
      { label: t.flow.moneyIn, value: v ?? formatSigned(moneyIn) },
      { label: t.flow.moneyOut, value: v ?? formatSigned(-spent) },
      { label: t.flow.netWorth, value: v ?? formatWhole(netWorth) },
    ]

    if (loading) {
      return {
        monthName,
        band: { variant: 'loading', label: t.flow.leftToSpend(monthName), stats: allStats('—') },
        sticky: { primary: '', secondary: '', right: [] },
      }
    }

    const out = items.filter((i) => i.dir === 'out' && i.counted)
    const outSum = out.reduce((s, i) => s + i.amountBase, 0)
    const onlyCat = cats.length === 1 && !methods.length && !amountIsFiltered(amtMin, amtMax) && rangePreset === 'month'
    const cap = onlyCat ? stats.categoryBudgetCaps[cats[0]] : undefined

    // One category, from the chip row or the sheet: that category's budget.
    if (segment !== 'in' && onlyCat && cap && cap > 0) {
      const over = outSum > cap
      const gap = formatWhole(Math.abs(cap - outSum))
      return {
        monthName,
        band: {
          variant: 'filtered',
          label: t.flow.categoryMonth(cats[0], monthName),
          status: over ? { label: t.flow.overBy(gap), icon: 'alert' } : { label: t.flow.onTrack, icon: 'check' },
          big: formatFixed2(outSum),
          of: t.flow.ofBudget(formatWhole(cap)),
          side: String(out.length),
          sideSub: t.flow.transactions,
          bar: { pct: (outSum / cap) * 100, tick },
          scale: [startLabel, over ? t.flow.scaleOverBy(gap) : t.flow.scaleLeft(gap), endLabel],
          stats: [
            { label: t.flow.statSpent, value: formatWhole(outSum) },
            { label: t.flow.statBudget, value: formatWhole(cap) },
            { label: over ? t.flow.statOverBy : t.flow.statLeft, value: gap },
          ],
        },
        sticky: { primary: formatFixed2(outSum), secondary: cats[0], right: [t.flow.stickyResults(out.length)] },
      }
    }

    // Several filters on spending.
    if (segment !== 'in' && filterCount > 0) {
      const names = filterNames.join(' · ')
      const soleCap = cats.length === 1 ? stats.categoryBudgetCaps[cats[0]] : undefined
      const withBudget = out.length > 0 && soleCap && soleCap > 0
      const over = withBudget ? outSum > soleCap : false
      const gap = withBudget ? formatWhole(Math.abs(soleCap - outSum)) : ''
      return {
        monthName,
        band: {
          variant: 'filtered',
          label: t.flow.spentFilters(filterCount),
          status: over ? { label: t.flow.overBy(gap), icon: 'alert' } : undefined,
          big: formatFixed2(outSum),
          of: names,
          side: String(out.length),
          sideSub: t.flow.transactions,
          bar: withBudget ? { pct: (outSum / soleCap) * 100 } : undefined,
          scale: withBudget ? ['0', t.flow.categoryBudget(cats[0], formatWhole(soleCap)), ''] : undefined,
          stats: withBudget
            ? [
                { label: t.flow.statSpent, value: formatWhole(outSum) },
                { label: t.flow.statBudget, value: formatWhole(soleCap) },
                { label: over ? t.flow.statOverBy : t.flow.statLeft, value: gap },
              ]
            : [
                { label: t.flow.statSpent, value: formatWhole(outSum) },
                { label: t.flow.statTransactions, value: String(out.length) },
                { label: t.flow.statPeriod, value: periodText(resolved) },
              ],
        },
        sticky: { primary: formatFixed2(outSum), secondary: names, right: [t.flow.stickyResults(out.length)] },
      }
    }

    if (segment === 'in') {
      const oneTime = all.filter((i) => i.dir === 'in' && i.counted && i.facet === 'one-time').reduce((s, i) => s + i.amountBase, 0)
      const toCome = Math.max(0, paydays.expected - paydays.received)
      const resolve = matches.length + late.length
      const pct = paydays.expected > 0 ? Math.round((paydays.received / paydays.expected) * 100) : 0
      return {
        monthName,
        band: {
          variant: 'received',
          label: t.flow.received(monthName),
          status: resolve
            ? { label: t.flow.toResolve(resolve), icon: 'alert' }
            : paydays.total > 0 && paydays.open === 0
              ? { label: t.flow.allIn, icon: 'check' }
              : undefined,
          big: formatFixed2(paydays.received),
          of: t.flow.ofExpected(formatWhole(paydays.expected)),
          side: `${pct}%`,
          sideSub: t.flow.receivedWord,
          bar: { pct: paydays.expected > 0 ? (paydays.received / paydays.expected) * 100 : 0 },
          scale: [startLabel, paydays.open ? t.flow.paydaysOpen(paydays.open) : t.flow.allPaydaysIn(paydays.total), endLabel],
          stats: [
            { label: t.flow.expected, value: formatWhole(paydays.expected) },
            { label: t.flow.toCome, value: formatWhole(toCome) },
            { label: t.flow.oneTime, value: formatSigned(oneTime) },
          ],
        },
        sticky: {
          primary: formatFixed2(paydays.received),
          secondary: t.flow.of(formatWhole(paydays.expected)),
          right: [t.flow.stickyToCome(formatWhole(toCome))],
        },
      }
    }

    const perDaySpent = formatWhole(spent / Math.max(1, stats.daysElapsed))

    if (budget <= 0) {
      return {
        monthName,
        band: {
          variant: 'noBudget',
          label: t.flow.spent(monthName),
          big: formatFixed2(spent),
          of: base,
          side: t.flow.perDay(perDaySpent),
          sideSub: t.flow.averageSoFar,
          noBudgetLine: t.flow.noBudgetLine,
          setBudgetLabel: t.flow.setBudget,
          onSetBudget,
          stats: allStats(),
        },
        sticky: { primary: formatFixed2(spent), secondary: t.flow.stickySpent, right: [formatSigned(moneyIn), formatSigned(-spent)] },
      }
    }

    const left = budget - spent
    const status =
      stats.paceStatus === 'over'
        ? { label: t.flow.over, icon: 'alert' as const }
        : stats.paceStatus === 'warning'
          ? { label: t.flow.close, icon: 'clock' as const }
          : { label: t.flow.onTrack, icon: 'check' as const }

    if (segment === 'out') {
      return {
        monthName,
        band: {
          variant: 'spent',
          label: t.flow.spent(monthName),
          big: formatFixed2(spent),
          of: t.flow.ofBudget(formatWhole(budget)),
          side: t.flow.perDay(perDaySpent),
          sideSub: t.flow.average,
          bar: { pct: (spent / budget) * 100, tick },
          scale: [startLabel, t.flow.scaleLeft(formatWhole(left)), endLabel],
          stats: [
            { label: t.flow.statSpent, value: formatWhole(spent) },
            { label: t.flow.statPerDay, value: perDaySpent },
            { label: t.flow.statLeft, value: formatWhole(left) },
          ],
        },
        sticky: { primary: formatFixed2(spent), secondary: t.flow.stickySpent, right: [t.flow.perDay(perDaySpent)] },
      }
    }

    // All: left to spend. With nothing logged yet, the daily figure spreads over the month.
    const empty = all.length === 0
    const days = empty ? totalDays : Math.max(1, stats.daysLeft)
    return {
      monthName,
      band: {
        variant: 'budget',
        label: t.flow.leftToSpend(monthName),
        status,
        big: formatFixed2(left),
        of: t.flow.of(formatWhole(budget)),
        side: t.flow.perDay(formatWhole(Math.max(0, left) / Math.max(1, days))),
        sideSub: empty ? t.flow.forDays(days) : t.flow.untilDate(endLabel),
        bar: { pct: (spent / budget) * 100, tick },
        scale: [startLabel, t.flow.scaleSpent(formatWhole(spent)), endLabel],
        stats: allStats(),
      },
      sticky: {
        primary: formatFixed2(left),
        secondary: t.flow.stickyLeft(formatWhole(budget)),
        right: [formatSigned(moneyIn), formatSigned(-spent)],
      },
    }
  }, [
    t, locale, monthFilter, monthStartDay, resolved, all, items, stats, netWorth, loading, cats, methods, amtMin, amtMax, rangePreset,
    segment, filterCount, filterNames, paydays, matches, late, base, onSetBudget,
  ])
}

/** "Sep 5–28" or "Sep 28 – Oct 3". */
export function periodText({ start, end }: ResolvedRange): string {
  const s = shortDate(format(start, 'yyyy-MM-dd'))
  return start.getMonth() === end.getMonth() ? `${s}–${format(end, 'd')}` : `${s} – ${shortDate(format(end, 'yyyy-MM-dd'))}`
}
