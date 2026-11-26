'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { SearchX, SlidersHorizontal, X, Receipt } from 'lucide-react'
import { useSmsArmed } from '@/hooks/useSmsTracking'
import { FlowSetupState } from '@/components/features/onboarding/FlowSetupState'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { AMOUNT_MAX, AMOUNT_MIN, amountIsFiltered, ONE_TIME_INCOME, useExpenseFilterStore, type FlowSegment } from '@/lib/store/useExpenseFilterStore'
import type { IncomeSourceType } from '@/lib/store/types'
import type { RangePreset } from '@/lib/expenses/dateRange'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { navigate } from '@/lib/navigation/navigate'
import { formatWhole, formatSigned } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { orderedCategories, categoryFilterIds } from '@/lib/budget/categoryOrder'
import { CategoryGlyph } from '@/components/dashboard/CategoryIcon'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { ExpenseFilters } from '@/components/expenses/ExpenseFilters'
import { FlowSummaryBand } from '@/components/features/flow/FlowSummaryBand'
import { FlowStickyStrip } from '@/components/features/flow/FlowStickyStrip'
import { FlowChipItem, type FlowChip } from '@/components/features/flow/FlowChipRow'
import { FlowLedger } from '@/components/features/flow/FlowLedger'
import { FlowSkeleton } from '@/components/features/flow/FlowSkeleton'
import { IncomePrompts } from '@/components/features/flow/IncomePrompts'
import { OwnTransferPrompts } from '@/components/features/flow/OwnTransferPrompts'
import { SmsFlagPrompts } from '@/components/features/flow/SmsFlagPrompts'
import { PrincipalDuplicatePrompts } from '@/components/features/flow/PrincipalDuplicatePrompts'
import { MerchantCategoryPrompt } from '@/components/features/flow/MerchantCategoryPrompt'
import { CarryStalePrompt } from '@/components/features/savings-v3/CarryStalePrompt'
import { FlowPendingRow } from '@/components/features/flow/FlowPendingRow'
import { methodLabel, useFlowLedger } from '@/components/features/flow/useFlowLedger'
import { useFlowBand } from '@/components/features/flow/useFlowBand'
import { PageGrid } from '@/components/layout/PageGrid'
import { selectFlowEmptyState } from '@/lib/flow/emptyState'

/** Past this scroll the hero has left the viewport: collapse into the strip. */
const COLLAPSE_AT = 150

/**
 * Flow — money in and money out in one ledger. The hero is this month's spending against the budget; below it the
 * All / In / Out segment and a filters button, then every month in one list. Filters narrow the list only; while any
 * apply, the removable chips and the result count sit under the segment.
 */
export default function FlowPage() {
  const t = useT()
  const lt = useFlowLtCopy()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const hasHistory = useFinanceStore((s) => s.expenses.length + s.incomeEvents.length > 0)
  const smsArmed = useSmsArmed()
  const { paymentMethods, incomeSources, base } = useFinanceStore(
    useShallow((s) => ({ paymentMethods: s.paymentMethods, incomeSources: s.incomeSources, base: s.settings.baseCurrency })),
  )
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const filters = useExpenseFilterStore(
    useShallow((s) => ({
      segment: s.segment,
      cats: s.cats,
      methods: s.methods,
      incomeTypes: s.incomeTypes,
      amtMin: s.amtMin,
      amtMax: s.amtMax,
      rangePreset: s.range.preset,
      setRangePreset: s.setRangePreset,
      setSegment: s.setSegment,
      toggleCat: s.toggleCat,
      toggleMethod: s.toggleMethod,
      toggleIncomeType: s.toggleIncomeType,
      setAmtMin: s.setAmtMin,
      setAmtMax: s.setAmtMax,
      reset: s.reset,
    })),
  )
  const stats = useMonthlyStats()
  const { all, items, groups } = useFlowLedger()
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
  // The date range counts as a filter once it is narrower than all time.
  const rangeOn = filters.rangePreset !== 'all'
  const filterCount =
    (segment !== 'in' && filters.cats.length ? 1 : 0) +
    (segment === 'in' && filters.incomeTypes.length ? 1 : 0) +
    (filters.methods.length ? 1 : 0) +
    (amountOn ? 1 : 0) +
    (rangeOn ? 1 : 0)
  const methodName = useCallback(
    (id: string) => methodLabel(paymentMethods.find((m) => m.id === id)) ?? id,
    [paymentMethods],
  )

  const onSetBudget = useCallback(() => navigate('/budget-setup'), [])
  const { band, sticky, monthName } = useFlowBand({ loading: !dataReady, onSetBudget })

  const catLabel = useCallback((c: string) => t.expenseForm.categoryLabels[c] ?? c, [t])
  const incomeTypeLabel = useCallback(
    (f: string) => (f === ONE_TIME_INCOME ? t.flow.oneTime : incomeSourceTypeLabel(t.income, f as IncomeSourceType)),
    [t],
  )
  const rangeLabel: Record<RangePreset, string> = {
    all: lt.filters.allTime,
    today: t.common.today,
    yesterday: t.common.yesterday,
    week: t.expenses.periodThisWeek,
    month: t.expenses.periodThisMonth,
    lastMonth: lt.filters.lastMonth,
    custom: t.expenses.periodCustom,
  }
  // Category order and "% of budget" follow this month's budget, not the all-months list.
  const orderedCats = useMemo(
    () => orderedCategories({ caps: stats.categoryBudgetCaps, rowSpent: stats.categorySpending, spentByCategory: stats.categorySpending }),
    [stats.categoryBudgetCaps, stats.categorySpending],
  )

  // The applied filters, each removable with its ✕.
  const appliedChips: FlowChip[] = [
    ...(rangeOn ? [{ key: 'range', label: rangeLabel[filters.rangePreset], selected: true, onPress: () => filters.setRangePreset('all') }] : []),
    ...(segment !== 'in' ? filters.cats : []).map((c) => ({ key: `c-${c}`, label: catLabel(c), icon: <CategoryGlyph category={c} className="size-4" />, selected: true, onPress: () => filters.toggleCat(c) })),
    ...(segment === 'in' ? filters.incomeTypes : []).map((f) => ({ key: `i-${f}`, label: incomeTypeLabel(f), selected: true, onPress: () => filters.toggleIncomeType(f) })),
    ...filters.methods.map((m) => ({ key: `m-${m}`, label: methodName(m), selected: true, onPress: () => filters.toggleMethod(m) })),
    ...(amountOn
      ? [{ key: 'amt', label: `${formatWhole(filters.amtMin)}–${formatWhole(filters.amtMax)}`, selected: true, onPress: () => { filters.setAmtMin(AMOUNT_MIN); filters.setAmtMax(AMOUNT_MAX) } }]
      : []),
  ]

  const countSum = items.filter((i) => i.counted).reduce((s, i) => s + (i.dir === 'in' ? i.amountBase : -i.amountBase), 0)
  const empty = dataReady
    ? selectFlowEmptyState({
        allCount: all.length,
        itemsCount: items.length,
        filterCount,
        rangePreset: filters.rangePreset,
        segment,
        hasHistory,
      })
    : 'none'

  const categoryOptions = useMemo(() => {
    const seen = all.filter((i) => i.dir === 'out' && i.facet).map((i) => i.facet)
    return categoryFilterIds(orderedCats, seen).map((c) => ({ id: c, label: catLabel(c) }))
  }, [all, orderedCats, catLabel])
  // In: the income types present in the list, in Paydays order, then one-time.
  const incomeTypeOptions = useMemo(() => {
    const present = new Set(all.filter((i) => i.dir === 'in' && i.facet !== 'repayment').map((i) => i.facet))
    const order = [...incomeSources]
      .filter((s) => s.isRecurring)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((s) => s.sourceType ?? 'other')
    const facets = [...new Set([...order, ...present])].filter((f) => present.has(f) && f !== ONE_TIME_INCOME)
    if (present.has(ONE_TIME_INCOME)) facets.push(ONE_TIME_INCOME)
    return facets.map((f) => ({ id: f, label: incomeTypeLabel(f) }))
  }, [all, incomeSources, incomeTypeLabel])

  return (
    <div>
      <FlowStickyStrip visible={collapsed && dataReady} {...sticky} />
      {segment !== 'out' ? <IncomePrompts /> : null}
      <OwnTransferPrompts />
      <SmsFlagPrompts />
      <PrincipalDuplicatePrompts />
      <MerchantCategoryPrompt />
      <CarryStalePrompt />

      {/* One centred column on desktop too (the mockup is a single phone column): the narrow page width, not the wide shell. */}
      <PageGrid
        className="lg:max-w-[var(--page-max)]"
        primary={
          !dataReady ? (
            <FlowSkeleton />
          ) : (
            <div className="pb-6">
              <div className="mx-4 mt-4">
                <FlowSummaryBand {...band} />
              </div>

              <div className="mx-4 mt-4 flex items-center gap-2">
                <div className="min-w-0 flex-1">
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
                <span className="relative inline-flex shrink-0">
                  <IconButton
                    variant="outlined"
                    aria-label={filterCount > 0 ? t.flow.filtersCount(filterCount) : t.flow.openFilters}
                    aria-haspopup="dialog"
                    onClick={() => setSheetOpen(true)}
                  >
                    <SlidersHorizontal />
                  </IconButton>
                  {filterCount > 0 ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -end-1 -top-1 z-[2] flex size-[18px] items-center justify-center rounded-full bg-[var(--color-brand-primary)] font-mono-numbers text-[0.625rem] font-bold text-[var(--color-brand-on-primary)] ring-2 ring-[var(--color-brand-bg)]"
                    >
                      {filterCount > 9 ? '9+' : filterCount}
                    </span>
                  ) : null}
                </span>
              </div>

              {filterCount > 0 ? (
                <div className="mx-4 mt-2 flex flex-col gap-1">
                  {appliedChips.length ? (
                    <div className="hide-scrollbar -my-1 flex gap-2 overflow-x-auto py-1">
                      {appliedChips.map((c) => (
                        <FlowChipItem key={c.key} chip={c} />
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
                    <span>
                      <b dir="auto" className="font-mono-numbers text-[var(--color-brand-text-primary)]">{lt.page.results(items.length)}</b>
                      {' · '}
                      <span className="font-mono-numbers" dir="ltr">{formatSigned(countSum, 2)}</span>
                    </span>
                    <Button variant="link" size="touch" className="px-1.5" onClick={filters.reset}>
                      <X className="size-3.5" aria-hidden />
                      {t.expenses.clearFilters}
                    </Button>
                  </div>
                </div>
              ) : null}

              <FlowPendingRow />

              {empty === 'setup' ? (
                <FlowSetupState className="mx-4 mt-4" />
              ) : empty === 'emptyMonth' ? (
                <div className="mx-4 mt-6">
                  <EmptyState
                    variant="card"
                    icon={<Receipt />}
                    title={lt.page.emptyTitle(monthName)}
                    description={lt.page.emptyBody}
                    action={
                      <div className="flex w-full flex-col gap-1">
                        <Button size="cta-block" onClick={() => setActiveModal('addExpense')}>
                          {lt.page.addAnExpense}
                        </Button>
                        {smsArmed ? null : (
                          <Button variant="link" size="touch" className="font-semibold" onClick={() => navigate('/settings/sms')}>
                            {t.flow.turnOnSms}
                          </Button>
                        )}
                      </div>
                    }
                  />
                </div>
              ) : empty === 'emptySegment' ? (
                <div className="mx-4 mt-6">
                  <EmptyState
                    variant="card"
                    icon={<Receipt />}
                    title={segment === 'in' ? t.flow.emptySegmentInTitle(monthName) : t.flow.emptySegmentOutTitle(monthName)}
                    description={segment === 'in' ? t.flow.emptySegmentInBody : t.flow.emptySegmentOutBody}
                    action={
                      <div className="flex w-full flex-col gap-1">
                        <Button size="cta-block" onClick={() => setActiveModal(segment === 'in' ? 'addIncome' : 'addExpense')}>
                          {segment === 'in' ? t.flow.addIncome : t.flow.addExpense}
                        </Button>
                        <Button variant="link" size="touch" className="font-semibold" onClick={() => filters.setSegment('all')}>
                          {t.flow.viewAll}
                        </Button>
                      </div>
                    }
                  />
                </div>
              ) : empty === 'noMatch' ? (
                <div className="mx-4 mt-4">
                  <EmptyState
                    variant="card"
                    icon={<SearchX />}
                    iconTone="neutral"
                    title={t.flow.noMatchTitle}
                    description={lt.page.noMatchBody}
                    action={
                      <Button size="cta-block" onClick={filters.reset}>
                        {t.expenses.clearFilters}
                      </Button>
                    }
                  />
                </div>
              ) : (
                <FlowLedger look="card" groups={groups} fadeKey={`${segment}:${filters.rangePreset}:${filterCount}`} />
              )}
            </div>
          )
        }
      />

      <ExpenseFilters
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        segment={segment}
        categories={categoryOptions}
        incomeTypes={incomeTypeOptions}
        resultCount={items.length}
        currency={base}
      />
    </div>
  )
}
