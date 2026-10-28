'use client'

import { intlTag } from '@/lib/i18n/dateFormat'
import { capForCategory, sharedBudgetKey } from '@/lib/budget/budgetPlans'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format } from 'date-fns'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { amountIsFiltered, useExpenseFilterStore } from '@/lib/store/useExpenseFilterStore'
import { formatFixed2, formatSigned, formatWhole } from '@/lib/utils/formatters'
import { shortDate } from '@/lib/utils/shortDate'
import { budgetHero } from '@/components/features/flow/budgetHero'
import { getMonthRange } from '@/lib/utils/calculations'
import { totalDaysInMonth } from '@/lib/utils/spendingPace'
import type { FlowSummaryBandProps } from '@/components/features/flow/FlowSummaryBand'
import type { FlowStickyStripProps } from '@/components/features/flow/FlowStickyStrip'
import type { FlowItem } from '@/components/features/flow/useFlowLedger'
import type { ResolvedRange } from '@/lib/expenses/dateRange'
import { useLocale, useT } from '@/lib/i18n'

type Sticky = Omit<FlowStickyStripProps, 'visible'>

export interface FlowBandModel {
  band: FlowSummaryBandProps
  sticky: Sticky
  monthName: string
}

/**
 * The band. One hero for All, In and Out — the month's budget, pace and in/out/net worth —
 * so switching segment never changes the headline. Only filters narrow it: one category
 * shows that category's budget, several filters show the filtered spend.
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
  const { base, monthStartDay } = useFinanceStore(
    useShallow((s) => ({ base: s.settings.baseCurrency, monthStartDay: s.settings.monthStartDay })),
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

  return useMemo(() => {
    const monthDate = new Date(`${monthFilter}-01T00:00:00`)
    const monthName = new Intl.DateTimeFormat(intlTag(locale), { month: 'long' }).format(monthDate)
    const startLabel = shortDate(format(resolved.start, 'yyyy-MM-dd'))
    const endLabel = shortDate(format(resolved.end, 'yyyy-MM-dd'))
    const cycle = getMonthRange(monthFilter, monthStartDay)
    const cycleStartLabel = shortDate(format(cycle.start, 'yyyy-MM-dd'))
    const cycleEndLabel = shortDate(format(cycle.end, 'yyyy-MM-dd'))
    // Received money on the cycle basis; a week or custom range shows that range's income rows, like the list below.
    const moneyIn =
      rangePreset === 'month'
        ? stats.receivedIncome
        : all.filter((i) => i.dir === 'in').reduce((s, i) => s + i.amountBase, 0)
    const spent = stats.totalSpentExcludingSavings
    const budget = stats.totalExpenseBudget
    const totalDays = totalDaysInMonth(monthFilter, monthStartDay)
    const tick = (Math.min(stats.daysElapsed, totalDays) / totalDays) * 100
    const allStats = (v?: string) => [
      { label: t.flow.moneyIn, value: v ?? formatSigned(moneyIn), dir: 'in' as const },
      { label: t.flow.moneyOut, value: v ?? formatSigned(-spent), dir: 'out' as const },
      { label: t.flow.netWorth, value: v ?? formatWhole(netWorth) },
    ]

    if (loading) {
      return {
        monthName,
        band: {
          variant: 'loading',
          label: t.flow.leftToSpend,
          bar: { pct: 0, ghost: true },
          scale: ['', '', ''],
          stats: allStats('—'),
        },
        sticky: { primary: '', secondary: '', right: [] },
      }
    }

    // Category and filter heroes narrow spending, so they apply where spending shows.
    const narrowing = segment !== 'in'
    const out = items.filter((i) => i.dir === 'out' && i.counted)
    const outSum = out.reduce((s, i) => s + i.amountBase, 0)
    // A chip filters a budget row plus the categories it absorbs (Food + Groceries): one category here.
    const budgetKey = sharedBudgetKey(cats, Object.keys(stats.categoryBudgetCaps))
    const catName = budgetKey ?? cats[0]
    const onlyCat = (cats.length === 1 || budgetKey != null) && !methods.length && !amountIsFiltered(amtMin, amtMax) && rangePreset === 'month'
    const cap = onlyCat ? (budgetKey ? stats.categoryBudgetCaps[budgetKey] : capForCategory(cats[0], stats.categoryBudgetCaps)) : undefined
    const allOut = all.filter((i) => i.dir === 'out' && i.counted).reduce((s, i) => s + i.amountBase, 0)
    const share = allOut > 0 ? `${Math.round((outSum / allOut) * 100)}%` : '0%'
    const dayScale: [string, string, string] = [t.flow.dayN(Math.min(stats.daysElapsed, totalDays)), '', t.flow.setBudgetHint]

    // One category, from the chip row or the sheet: that category's budget.
    if (narrowing && onlyCat && cap && cap > 0) {
      const over = outSum > cap
      const gap = formatWhole(Math.abs(cap - outSum))
      return {
        monthName,
        band: {
          variant: 'filtered',
          label: catName,
          status: over ? { label: t.flow.overBy(gap), icon: 'alert' } : { label: t.flow.onTrack, icon: 'check' },
          big: formatFixed2(outSum),
          of: t.flow.ofBudget(formatWhole(cap)),
          side: String(out.length),
          sideSub: t.flow.transactions,
          bar: { pct: (outSum / cap) * 100, tick },
          scale: [startLabel, over ? t.flow.scaleOverBy(gap) : t.flow.scaleLeft(gap), endLabel],
          stats: [
            { label: t.flow.statSpent, value: formatWhole(outSum) },
            { label: over ? t.flow.statOverBy : t.flow.statLeft, value: gap },
            { label: t.flow.statShareOfOut, value: share },
          ],
        },
        sticky: { primary: formatFixed2(outSum), secondary: catName, right: [t.flow.stickyResults(out.length)] },
      }
    }

    // One category with no budget: a ghost track and a Set budget pill, scoped to it.
    if (narrowing && onlyCat) {
      return {
        monthName,
        band: {
          variant: 'filtered',
          label: t.flow.noCategoryBudget(catName),
          setBudget: { label: t.flow.setBudget, onPress: onSetBudget },
          big: formatFixed2(outSum),
          of: base,
          side: String(out.length),
          sideSub: t.flow.transactions,
          bar: { pct: 0, tick, ghost: true },
          scale: dayScale,
          stats: [
            { label: t.flow.statSpent, value: formatWhole(outSum) },
            { label: t.flow.statShareOfOut, value: share },
            { label: t.flow.statAvgPerTx, value: formatWhole(out.length ? outSum / out.length : 0) },
          ],
        },
        sticky: { primary: formatFixed2(outSum), secondary: catName, right: [t.flow.stickyResults(out.length)] },
      }
    }

    // Several filters on spending.
    if (narrowing && filterCount > 0) {
      const names = filterNames.join(' · ')
      const soleCap = cats.length === 1 || budgetKey != null ? cap : undefined
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
          bar: withBudget ? { pct: (outSum / soleCap) * 100 } : { pct: 0, ghost: true },
          scale: withBudget ? ['0', t.flow.categoryBudget(catName, formatWhole(soleCap)), ''] : [startLabel, '', t.flow.noSingleBudget],
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

    if (budget <= 0) {
      return {
        monthName,
        band: {
          variant: 'noBudget',
          label: t.flow.spent,
          big: formatFixed2(spent),
          of: base,
          side: t.flow.perDay(formatWhole(spent / Math.max(1, stats.daysElapsed))),
          sideSub: t.flow.averageSoFar,
          setBudget: { label: t.flow.setBudget, onPress: onSetBudget },
          bar: { pct: 0, tick, ghost: true },
          scale: dayScale,
          stats: allStats(),
        },
        sticky: { primary: formatFixed2(spent), secondary: t.flow.stickySpent, right: [formatSigned(moneyIn), formatSigned(-spent)] },
      }
    }

    // Left to spend. With nothing logged yet, the daily figure spreads over the month.
    const hero = budgetHero(budget, spent)
    const isOver = hero.kind === 'over'
    const left = budget - spent
    const empty = all.length === 0
    const closedCycle = stats.daysLeft <= 0
    const days = empty ? totalDays : Math.max(1, stats.daysLeft)
    return {
      monthName,
      band: {
        variant: 'budget',
        label: isOver ? t.flow.overBudgetBy : t.flow.leftToSpend,
        status: isOver
          ? { label: t.flow.overBudget, icon: 'alert' }
          : stats.paceStatus === 'over'
            ? { label: t.flow.over, icon: 'alert' }
            : stats.paceStatus === 'warning'
              ? { label: t.flow.close, icon: 'clock' }
              : { label: t.flow.onTrack, icon: 'check' },
        big: formatFixed2(hero.amount),
        of: t.flow.of(formatWhole(budget)),
        side: t.flow.perDay(formatWhole(closedCycle ? spent / totalDays : Math.max(0, left) / Math.max(1, days))),
        sideSub: closedCycle ? t.flow.averageSoFar : isOver ? t.flow.budgetUsedUp : empty ? t.flow.forDays(days) : t.flow.untilDate(cycleEndLabel),
        bar: { pct: (spent / budget) * 100, tick },
        scale: [cycleStartLabel, isOver ? t.flow.scaleOverBy(formatWhole(hero.amount)) : t.flow.scaleSpent(formatWhole(spent)), cycleEndLabel],
        stats: allStats(),
      },
      sticky: {
        primary: formatFixed2(hero.amount),
        secondary: isOver ? t.flow.stickyOver(formatWhole(budget)) : t.flow.stickyLeft(formatWhole(budget)),
        right: [formatSigned(moneyIn), formatSigned(-spent)],
      },
    }
  }, [
    t, locale, monthFilter, monthStartDay, resolved, all, items, stats, netWorth, loading, cats, methods, amtMin, amtMax,
    rangePreset, segment, filterCount, filterNames, base, onSetBudget,
  ])
}

/** "Sep 5–28" or "Sep 28 – Oct 3". */
export function periodText({ start, end }: ResolvedRange): string {
  const s = shortDate(format(start, 'yyyy-MM-dd'))
  if (start.toDateString() === end.toDateString()) return s
  return start.getMonth() === end.getMonth() ? `${s}–${format(end, 'd')}` : `${s} – ${shortDate(format(end, 'yyyy-MM-dd'))}`
}
