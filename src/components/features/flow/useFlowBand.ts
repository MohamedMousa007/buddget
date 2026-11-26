'use client'

import { intlTag } from '@/lib/i18n/dateFormat'
import { createElement as h, useMemo, type ReactNode } from 'react'
import { format } from 'date-fns'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { formatFixed2 as fixed2, formatSignedAuto, formatWhole as whole } from '@/lib/utils/formatters'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { shortDate } from '@/lib/utils/shortDate'
import { budgetHero } from '@/components/features/flow/budgetHero'
import { getMonthRange } from '@/lib/utils/calculations'
import { totalDaysInMonth } from '@/lib/utils/spendingPace'
import type { FlowSummaryBandProps } from '@/components/features/flow/FlowSummaryBand'
import type { FlowStickyStripProps } from '@/components/features/flow/FlowStickyStrip'
import { useLocale, useT } from '@/lib/i18n'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'

type Sticky = Omit<FlowStickyStripProps, 'visible'>

export interface FlowBandModel {
  band: FlowSummaryBandProps
  sticky: Sticky
  monthName: string
}

/** "↓ +35,500 in   ↑ −16,253 out" under the bar. */
function inOutNote(inText: string, outText: string, inWord: string, outWord: string): ReactNode {
  const part = (Icon: typeof ArrowDown, value: string, word: string) =>
    h('span', { className: 'inline-flex items-center gap-1' },
      h(Icon, { className: 'size-3.5', 'aria-hidden': true }),
      h('b', { dir: 'ltr', className: 'font-mono-numbers font-semibold text-[var(--flow-band-fg)]' }, value),
      word)
  return h('span', { className: 'flex gap-4' }, part(ArrowDown, inText, inWord), part(ArrowUp, outText, outWord))
}

/**
 * Flow's hero: what was spent this month against the budget, with the pace tick, what is left and money in / out.
 * It always reads the current month (`useMonthlyStats`); the list below can span every month and the filters
 * narrow only the list, never the hero.
 */
export function useFlowBand({ loading, onSetBudget }: { loading: boolean; onSetBudget: () => void }): FlowBandModel {
  const t = useT()
  const lt = useFlowLtCopy()
  const { locale } = useLocale()
  const stats = useMonthlyStats()
  const hidden = useMask('hero')
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)
  const monthFilter = useSettingsStore((s) => s.monthFilter)

  return useMemo(() => {
    const formatWhole = (n: number) => (hidden ? MASK : whole(n))
    const formatFixed2 = (n: number) => (hidden ? MASK : fixed2(n))
    const signed = (n: number) => (hidden ? MASK : formatSignedAuto(n))
    const monthDate = new Date(`${monthFilter}-01T00:00:00`)
    const monthName = new Intl.DateTimeFormat(intlTag(locale), { month: 'long' }).format(monthDate)
    const cycle = getMonthRange(monthFilter, monthStartDay)
    // Someone on a pay cycle sees its start date at the bar's start; everyone else the month.
    const startLabel = monthStartDay > 1 ? shortDate(format(cycle.start, 'yyyy-MM-dd'), locale) : monthName
    const cycleEndLabel = shortDate(format(cycle.end, 'yyyy-MM-dd'), locale)
    const moneyIn = stats.receivedIncome
    const spent = stats.totalSpentExcludingSavings
    const budget = stats.totalExpenseBudget
    const totalDays = totalDaysInMonth(monthFilter, monthStartDay)
    const tick = (Math.min(stats.daysElapsed, totalDays) / totalDays) * 100
    const note = inOutNote(signed(moneyIn), signed(-spent), lt.page.heroIn, lt.page.heroOut)
    const sticky: Sticky = { primary: formatFixed2(spent), secondary: t.flow.stickySpent, right: [signed(moneyIn), signed(-spent)] }

    if (loading) {
      return {
        monthName,
        band: { variant: 'loading', label: t.flow.spent, bar: { pct: 0, ghost: true }, scale: ['', '', ''], contained: true },
        sticky: { primary: '', secondary: '', right: [] },
      }
    }

    if (budget <= 0) {
      return {
        monthName,
        band: {
          variant: 'noBudget',
          label: t.flow.spent,
          big: formatFixed2(spent),
          side: t.flow.perDay(formatWhole(spent / Math.max(1, stats.daysElapsed))),
          sideSub: t.flow.averageSoFar,
          setBudget: { label: t.flow.setBudget, onPress: onSetBudget },
          bar: { pct: 0, tick, ghost: true },
          scale: [startLabel, '', t.flow.setBudgetHint],
          note,
          contained: true,
        },
        sticky,
      }
    }

    // The daily figure is what is left spread over the days left; with the cycle closed, the average spent.
    const hero = budgetHero(budget, spent)
    const isOver = hero.kind === 'over'
    const left = budget - spent
    const closedCycle = stats.daysLeft <= 0
    const days = Math.max(1, stats.daysLeft)
    return {
      monthName,
      band: {
        variant: 'budget',
        label: t.flow.spent,
        status: isOver
          ? { label: t.flow.overBudget, icon: 'alert' }
          : stats.paceStatus === 'over'
            ? { label: t.flow.over, icon: 'alert' }
            : stats.paceStatus === 'warning'
              ? { label: t.flow.close, icon: 'clock' }
              : { label: t.flow.onTrack, icon: 'check' },
        big: formatFixed2(spent),
        side: t.flow.perDay(formatWhole(closedCycle ? spent / totalDays : Math.max(0, left) / days)),
        sideSub: closedCycle ? t.flow.averageSoFar : isOver ? t.flow.budgetUsedUp : t.flow.untilDate(cycleEndLabel),
        bar: { pct: (spent / budget) * 100, tick },
        scale: [startLabel, isOver ? t.flow.scaleOverBy(formatWhole(hero.amount)) : lt.page.left(formatWhole(hero.amount)), formatWhole(budget)],
        note,
        contained: true,
      },
      sticky: { ...sticky, secondary: t.flow.of(formatWhole(budget)) },
    }
  }, [t, lt, locale, monthFilter, monthStartDay, stats, loading, onSetBudget, hidden])
}
