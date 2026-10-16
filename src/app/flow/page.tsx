'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSmsArmed } from '@/hooks/useSmsTracking'
import { SetupChecklist } from '@/components/features/setup/SetupChecklist'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { AMOUNT_MAX, AMOUNT_MIN, amountIsFiltered, ONE_TIME_INCOME, useExpenseFilterStore, type FlowSegment } from '@/lib/store/useExpenseFilterStore'
import type { IncomeSourceType } from '@/lib/store/types'
import { useHydrateDebts, useHydrateExpenses, useHydrateIncome, useHydrateIncomeEvents, useHydrateSavings } from '@/hooks/remote'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { navigate } from '@/lib/navigation/navigate'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { formatWhole, formatFixed2, formatSigned } from '@/lib/utils/formatters'
import { shortDate } from '@/lib/utils/shortDate'
import { useT } from '@/lib/i18n'
import { format } from 'date-fns'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { ExpenseFilters } from '@/components/expenses/ExpenseFilters'
import { FlowMonthRow } from '@/components/features/flow/FlowMonthRow'
import { FlowSummaryBand } from '@/components/features/flow/FlowSummaryBand'
import { FlowStickyStrip } from '@/components/features/flow/FlowStickyStrip'
import { FlowChipRow, type FlowChip } from '@/components/features/flow/FlowChipRow'
import { FlowLedger } from '@/components/features/flow/FlowLedger'
import { IncomePrompts } from '@/components/features/flow/IncomePrompts'
import { methodLabel, useFlowLedger } from '@/components/features/flow/useFlowLedger'
import { useFlowBand } from '@/components/features/flow/useFlowBand'

/** Past this scroll the band's stat row has left the viewport: collapse into the strip. */
const COLLAPSE_AT = 150

/**
 * Flow — money in and money out in one ledger (Expenses and Income collapsed into one tab).
 * The band follows the segment (All = budget, In = paydays, Out = spending) and the
 * filters; payday questions only surface on In, and only when they would change a number.
 */
export default function FlowPage() {
  useHydrateExpenses()
  useHydrateIncome()
  useHydrateIncomeEvents()
  useHydrateDebts()
  useHydrateSavings()
  const t = useT()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const hasHistory = useFinanceStore((s) => s.expenses.length + s.incomeEvents.length > 0)
  const smsArmed = useSmsArmed()
  const { paymentMethods, incomeSources, base } = useFinanceStore(
    useShallow((s) => ({ paymentMethods: s.paymentMethods, incomeSources: s.incomeSources, base: s.settings.baseCurrency })),
  )
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const filters = useExpenseFilterStore(
    useShallow((s) => ({
      segment: s.segment,
      cats: s.cats,
      methods: s.methods,
      incomeTypes: s.incomeTypes,
      amtMin: s.amtMin,
      amtMax: s.amtMax,
      rangePreset: s.range.preset,
      setSegment: s.setSegment,
      selectCat: s.selectCat,
      toggleCat: s.toggleCat,
      toggleMethod: s.toggleMethod,
      toggleIncomeType: s.toggleIncomeType,
      setAmtMin: s.setAmtMin,
      setAmtMax: s.setAmtMax,
      reset: s.reset,
    })),
  )
  const stats = useMonthlyStats()
  const { all, items, groups, resolved } = useFlowLedger()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > COLLAPSE_AT)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const { segment } = filters
  const amountOn = amountIsFiltered(filters.amtMin, filters.amtMax)
  const amountLabel = `${formatWhole(filters.amtMin)}–${formatWhole(filters.amtMax)}`
  // Filters are the dimensions that narrow the list; the date range is the period, like the month.
  const filterCount =
    (segment !== 'in' && filters.cats.length ? 1 : 0) +
    (segment === 'in' && filters.incomeTypes.length ? 1 : 0) +
    (filters.methods.length ? 1 : 0) +
    (amountOn ? 1 : 0)
  const methodName = useCallback(
    (id: string) => methodLabel(paymentMethods.find((m) => m.id === id)) ?? id,
    [paymentMethods],
  )
  const filterNames = useMemo(
    () => [...(segment !== 'in' ? filters.cats : []), ...filters.methods.map(methodName), ...(amountOn ? [amountLabel] : [])],
    [segment, filters.cats, filters.methods, methodName, amountOn, amountLabel],
  )

  const onSetBudget = useCallback(() => navigate('/budget-setup'), [])
  const { band, sticky, monthName } = useFlowBand({
    items,
    all,
    resolved,
    filterNames,
    filterCount,
    loading: !dataReady,
    onSetBudget,
  })

  // Category quick filters: every budgeted category (ring + %, most-spent-against-cap first),
  // then every other category spent in this range (by spend). Tap = only that category,
  // inside the segment; tap again = all.
  const budgetChips = useMemo<FlowChip[]>(() => {
    const budgeted = Object.entries(stats.categoryBudgetCaps)
      .filter(([, cap]) => cap > 0)
      .map(([cat, cap]) => ({ cat, pct: (stats.categorySpending[cat] ?? 0) / cap }))
      .sort((a, b) => b.pct - a.pct)
    const spentBy = new Map<string, number>()
    for (const i of all) if (i.dir === 'out' && i.counted) spentBy.set(i.facet, (spentBy.get(i.facet) ?? 0) + i.amountBase)
    const unbudgeted = [...spentBy.entries()]
      .filter(([cat]) => !(stats.categoryBudgetCaps[cat] > 0))
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => ({ cat, pct: undefined as number | undefined }))
    return [...budgeted, ...unbudgeted].map(({ cat, pct }) => {
      const on = filters.cats.length === 1 && filters.cats[0] === cat
      return {
        key: `b-${cat}`,
        label: cat,
        selected: on,
        budget: pct === undefined ? undefined : { pct, over: pct > 1 },
        onPress: () => filters.selectCat(on ? null : cat),
      }
    })
  }, [stats.categoryBudgetCaps, stats.categorySpending, all, filters])

  // In: the income types present this month, in Paydays order, then one-time.
  const incomeChips = useMemo<FlowChip[]>(() => {
    const present = new Set(all.filter((i) => i.dir === 'in').map((i) => i.facet))
    const order = [...incomeSources]
      .filter((s) => s.isRecurring)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((s) => s.sourceType ?? 'other')
    const facets = [...new Set([...order, ...present])].filter((f) => present.has(f) && f !== ONE_TIME_INCOME)
    if (present.has(ONE_TIME_INCOME)) facets.push(ONE_TIME_INCOME)
    return facets.map((f) => ({
      key: `in-${f}`,
      label: f === ONE_TIME_INCOME ? t.flow.oneTime : incomeSourceTypeLabel(t.income, f as IncomeSourceType),
      selected: filters.incomeTypes.includes(f),
      onPress: () => filters.toggleIncomeType(f),
    }))
  }, [all, incomeSources, filters, t])

  const chipRowCatOnly = filterCount === 1 && filters.cats.length === 1 && budgetChips.some((c) => c.selected)
  const chips: FlowChip[] =
    segment === 'in'
      ? incomeChips
      : filterCount === 0 || chipRowCatOnly
        ? budgetChips
        : [
            ...filters.cats.map((c) => ({ key: `c-${c}`, label: c, selected: true, onPress: () => filters.toggleCat(c) })),
            ...filters.methods.map((m) => ({ key: `m-${m}`, label: methodName(m), selected: true, onPress: () => filters.toggleMethod(m) })),
            ...(amountOn
              ? [{ key: 'amt', label: amountLabel, selected: true, onPress: () => { filters.setAmtMin(AMOUNT_MIN); filters.setAmtMax(AMOUNT_MAX) } }]
              : []),
          ]

  const countSum = items.filter((i) => i.counted).reduce((s, i) => s + (i.dir === 'in' ? i.amountBase : -i.amountBase), 0)
  const showCount = filterCount > 0
  const noMatch = dataReady && items.length === 0 && (filterCount > 0 || filters.rangePreset !== 'month')
  const emptyMonth = dataReady && items.length === 0 && !noMatch

  const noMatchBody = (() => {
    const cats = segment !== 'in' ? filters.cats : []
    const what = cats.length ? `${cats.join(', ')} ${t.flow.noMatchSpending}` : t.flow.noMatchTransactions
    const paid = filters.methods.length ? ` ${t.flow.noMatchPaidWith(filters.methods.map(methodName).join(', '))}` : ''
    const from = shortDate(format(resolved.start, 'yyyy-MM-dd'))
    const to = resolved.start.getMonth() === resolved.end.getMonth() ? format(resolved.end, 'd') : shortDate(format(resolved.end, 'yyyy-MM-dd'))
    const when = filters.rangePreset === 'month' ? t.flow.noMatchIn(monthName) : t.flow.noMatchBetween(from, to)
    return `${t.flow.noMatchNo} ${what}${paid} ${when}.`
  })()

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const i of all) if (i.dir === 'out' && i.facet) seen.add(i.facet)
    return [...seen].map((c) => ({ id: c, label: c }))
  }, [all])
  const incomeTypeOptions = useMemo(() => incomeChips.map((c) => ({ id: c.key.slice(3), label: c.label })), [incomeChips])
  const resultCount = items.length

  return (
    <div className="pb-6 lg:mx-auto lg:max-w-screen-sm">
      <FlowStickyStrip visible={collapsed && dataReady} {...sticky} />
      {segment === 'in' ? <IncomePrompts /> : null}

      <FlowSummaryBand {...band} header={<FlowMonthRow />} />

      <div className="mx-4 mt-2.5">
        <SegmentedControl<FlowSegment>
          ariaLabel={t.flow.segmentAria}
          value={segment}
          onChange={filters.setSegment}
          options={[
            { value: 'all', label: t.flow.segAll },
            { value: 'in', label: t.flow.segIn },
            { value: 'out', label: t.flow.segOut },
          ]}
        />
      </div>

      <FlowChipRow filterCount={filterCount} onOpenFilters={() => setSheetOpen(true)} chips={chips} />

      {showCount ? (
        <div className="mx-4 mt-2 flex items-center justify-between gap-2">
          <span className="whitespace-nowrap text-[13px] text-[var(--color-brand-text-secondary)]">
            <b className="font-mono-numbers text-[var(--color-brand-text-primary)]">{resultCount}</b> {t.flow.resultsWord(resultCount)} ·{' '}
            <span className="font-mono-numbers">{segment === 'in' ? formatSigned(countSum, 2) : `−${formatFixed2(Math.abs(countSum))}`}</span>
          </span>
          <Button variant="link" size="touch" onClick={filters.reset}>
            {t.expenses.clearFilters}
          </Button>
        </div>
      ) : null}

      {!dataReady ? (
        <div className="mx-4 mt-3.5">
          <SkeletonList rows={7} />
        </div>
      ) : emptyMonth && !hasHistory ? (
        <SetupChecklist className="mx-4 mt-4" />
      ) : emptyMonth ? (
        <div className="mx-4 mt-7">
          <EmptyState
            title={t.flow.emptyMonthTitle(monthName)}
            description={t.flow.emptyMonthBody}
            action={
              smsArmed ? undefined : (
                <Button size="cta" onClick={() => navigate('/settings/sms')}>
                  {t.flow.turnOnSms}
                </Button>
              )
            }
          />
        </div>
      ) : noMatch ? (
        <div className="mx-4 mt-7">
          <EmptyState
            title={t.flow.noMatchTitle}
            description={noMatchBody}
            action={
              <Button size="cta" onClick={filters.reset}>
                {t.expenses.clearFilters}
              </Button>
            }
          />
        </div>
      ) : (
        <FlowLedger groups={groups} fadeKey={`${segment}:${monthFilter}:${filterNames.join('|')}`} />
      )}

      <ExpenseFilters
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        segment={segment}
        categories={categoryOptions}
        incomeTypes={incomeTypeOptions}
        resultCount={resultCount}
        currency={base}
      />
    </div>
  )
}
