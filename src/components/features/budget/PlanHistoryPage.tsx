'use client'

import { intlTag } from '@/lib/i18n/dateFormat'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useState } from 'react'
import { ArrowLeftRight, ChevronLeft, Copy, Eye, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { PageContainer } from '@/components/layout/PageContainer'
import { StatusBarCover } from '@/components/layout/StatusBarCover'
import { usePlanActions } from '@/hooks/usePlanActions'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useLocale } from '@/lib/i18n'
import { navigate } from '@/lib/navigation/navigate'
import { cycleKeyOf, planHistory, type PlanSpan } from '@/lib/budget/activations'
import { selectActivePlan } from '@/lib/budget/activePlan'
import { totalExpenseBudgetFromPlan } from '@/lib/budget/budgetPlans'
import { monthKeysBetween, monthResult, type MonthResult } from '@/lib/budget/historyResults'
import { blockTotals, planTotal } from '@/lib/budget/blocks'
import { summarizePlan } from '@/lib/budget/planSummary'
import { calculateTotalSpentExcludingSavings, filterExpensesByMonth, getMonthRange } from '@/lib/utils/calculations'
import { formatCurrency } from '@/lib/utils/formatters'
import { differenceInCalendarDays } from 'date-fns'
import { blockColor } from './chromeFormat'
import { PastPlanSheet } from './sheets/PastPlanSheet'
import { useBudgetDeckCopy } from './useDeckCopy'

const monthName = (key: string, locale: string, withYear = false) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(intlTag(locale), { month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}
const nextKey = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Which plan governed which months. Read only: past months never change. */
export function PlanHistoryPage() {
  const c = useBudgetDeckCopy().history
  const { locale } = useLocale()
  const actions = usePlanActions()
  const [viewId, setViewId] = useState<string | null>(null)
  const { dataReady, plans, activations, activeId, expenses, base, rates, startDay } = useFinanceStore(
    useShallow((s) => ({
      dataReady: s.dataReady,
      plans: s.budgetPlans,
      activations: s.budgetPlanActivations,
      activeId: s.activeBudgetPlanId,
      expenses: s.expenses,
      base: s.settings.baseCurrency,
      rates: s.exchangeRates,
      startDay: s.settings.monthStartDay,
    })),
  )

  const currentKey = cycleKeyOf(new Date(), startDay)
  const spans = useMemo<PlanSpan[]>(() => {
    const log = planHistory(plans, activations)
    if (log.length > 0) return log
    const active = selectActivePlan(plans, activeId)
    // No switch recorded yet: the active plan has covered every month since it was created.
    return active ? [{ plan: active, fromKey: cycleKeyOf(new Date(active.createdAt), 1), toKey: null }] : []
  }, [plans, activations, activeId])

  const spentByKey = useMemo(() => {
    const out = new Map<string, number>()
    for (const span of spans) {
      for (const key of monthKeysBetween(span.fromKey, span.toKey ?? currentKey)) {
        if (!out.has(key)) {
          out.set(key, calculateTotalSpentExcludingSavings(filterExpensesByMonth(expenses, key, startDay), base, rates))
        }
      }
    }
    return out
  }, [spans, currentKey, expenses, startDay, base, rates])

  const resultOf = (plan: PlanSpan['plan'], key: string): MonthResult | null =>
    monthResult(spentByKey.get(key) ?? 0, totalExpenseBudgetFromPlan(plan, base, rates))

  const range = getMonthRange(currentKey, startDay)
  const dayOf = Math.max(1, differenceInCalendarDays(new Date(), range.start) + 1)
  const daysIn = differenceInCalendarDays(range.end, range.start) + 1

  const header = (
    <div className="flex min-h-14 items-center gap-1 pe-2.5 ps-1.5 pt-1">
      <IconButton variant="ghost" size="md" aria-label={c.back} onClick={() => navigate('/budget-setup')}>
        <ChevronLeft className="size-5" strokeWidth={2} />
      </IconButton>
      <span className="flex-1 text-2xl font-bold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{c.title}</span>
      <Badge variant="muted">{c.readOnly}</Badge>
    </div>
  )

  const resultBadge = (r: MonthResult | null) =>
    r == null ? null : r.kind === 'over' ? (
      <Badge variant="negative">{c.over(formatCurrency(r.amount, base, false))}</Badge>
    ) : r.kind === 'kept' ? (
      <Badge variant="positive">{c.kept(r.percent)}</Badge>
    ) : (
      <Badge variant="muted">{c.onPlan}</Badge>
    )

  return (
    <PageContainer className="px-0">
      <StatusBarCover background="var(--color-brand-bg)" />
      {header}
      <div className="flex flex-col gap-3 px-4 pb-6 pt-1">
        {!dataReady ? (
          <SkeletonList rows={3} />
        ) : spans.length === 0 ? (
          <EmptyState icon={<History />} title={c.empty} description={c.emptySub} />
        ) : (
          <>
            <p className="flex items-start gap-2 text-sm text-[var(--color-brand-text-secondary)]">
              <History className="mt-0.5 size-4 shrink-0" aria-hidden />
              {c.intro}
            </p>
            {spans.map((span, i) => {
              const current = span.toKey === null
              const sum = summarizePlan(span.plan, planTotal(blockTotals(span.plan, base, rates)) || 1, base, rates)
              const months = monthKeysBetween(span.fromKey, span.toKey ?? currentKey)
              const older = spans[i + 1]
              return (
                <div key={`${span.plan.id}-${span.fromKey}`} className="flex flex-col gap-3">
                  <Card className={current ? 'border-[var(--color-brand-primary)]' : undefined} elevation={current ? 'md' : 'sm'}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-[var(--color-brand-text-primary)]">{span.plan.name}</p>
                        <p className="text-xs text-[var(--color-brand-text-secondary)]">
                          {current
                            ? c.appliesToEvery
                            : c.range(monthName(span.fromKey, locale, true), monthName(span.toKey as string, locale, true))}
                        </p>
                      </div>
                      <Badge variant={current ? 'positive' : 'muted'}>{current ? c.current : c.past}</Badge>
                    </div>
                    <div className="mt-3 flex h-3 gap-0.5">
                      {sum.flow.map((f) => (
                        <span key={f.block} className="block h-full rounded" style={{ width: `${f.percent}%`, background: blockColor(f.block) }} />
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">
                      {current ? c.monthsCovers : c.monthsCovered}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {months.slice(-6).map((key) => {
                        const isNow = key === currentKey
                        return (
                          <div key={key} className="min-w-[88px] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-2">
                            <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{monthName(key, locale)}</p>
                            <div className="mt-1">{isNow ? <Badge variant="brand">{c.dayOf(dayOf, daysIn)}</Badge> : resultBadge(resultOf(span.plan, key))}</div>
                          </div>
                        )
                      })}
                      {current ? (
                        <div className="min-w-[88px] rounded-xl border border-dashed border-[var(--color-brand-border-strong)] p-2">
                          <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{c.onward(monthName(nextKey(currentKey), locale))}</p>
                          <p className="text-xs text-[var(--color-brand-text-secondary)]">{c.untilYouSwitch}</p>
                        </div>
                      ) : null}
                    </div>
                    {!current ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button size="touch" variant="outline" onClick={() => setViewId(span.plan.id)}>
                          <Eye />
                          {c.view}
                        </Button>
                        <Button size="touch" variant="outline" onClick={() => actions.duplicate(span.plan.id)}>
                          <Copy />
                          {c.duplicate}
                        </Button>
                      </div>
                    ) : null}
                  </Card>
                  {older ? (
                    <div className="flex items-center gap-3 px-1">
                      <span className="flex size-9 items-center justify-center rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
                        <ArrowLeftRight className="size-4 text-[var(--color-brand-text-secondary)]" aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{c.switched(monthName(span.fromKey, locale, true))}</p>
                        <p className="text-xs text-[var(--color-brand-text-secondary)]">{c.switchedSub(older.plan.name, span.plan.name)}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="px-1 text-center text-xs text-[var(--color-brand-text-muted)]">{c.firstPlan(monthName(span.fromKey, locale, true))}</p>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
      <PastPlanSheet planId={viewId} onClose={() => setViewId(null)} />
    </PageContainer>
  )
}
