'use client'

import { PageBody, PageDivider } from '@/components/layout/PageContainer'
import dynamic from 'next/dynamic'
import { addMonths, parseISO } from 'date-fns'
import { ChartPlaceholder } from '@/components/reports/ChartPlaceholder'
import { ReportFilters } from '@/components/reports/ReportFilters'
import { ReportExpenseDebtFilter } from '@/components/reports/ReportExpenseDebtFilter'
import { useReportsPage } from '@/hooks/useReportsPage'
import { budgetMonthKeyFor, expenseAmountInBase, getMonthRange } from '@/lib/utils/calculations'
import { ReportsSummaryPanel } from '@/components/features/reports/ReportsSummaryPanel'
import { ReportsPaymentMethodPanel } from '@/components/features/reports/ReportsPaymentMethodPanel'
import { ReportsExportBar } from '@/components/features/reports/ReportsExportBar'
import { SpendingPacePanel } from '@/components/reports/SpendingPacePanel'
import { ReportsSavingsPanel } from '@/components/reports/ReportsSavingsPanel'
import { ReportsNetWorthPanel } from '@/components/reports/ReportsNetWorthPanel'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { reportCycles, type ReportRangePreset } from '@/lib/reports/reportsPeriod'
import { useBillingStore } from '@/lib/billing/billingStore'
import { canSeeAdvancedInsights, rangeIsFree } from '@/lib/insights/access'
import { useInsightSource, useInsights } from '@/lib/insights/useInsights'
import { heroTiles, heroVerdict, learningProgress, paceVerdict, type PlanFigures } from '@/lib/insights/analysis'
import { buildInsightCharts, categorySlices, cumulative } from '@/lib/insights/charts'
import { composeRead } from '@/lib/insights/narrative'
import { InsightsHero } from '@/components/features/insights/InsightsHero'
import { InsightsFeed } from '@/components/features/insights/InsightsFeed'
import { InsightsLearning } from '@/components/features/insights/InsightsLearning'
import { InsightsAreas } from '@/components/features/insights/InsightsAreas'
import { BuddgyReadCard, ExplainMonthCard } from '@/components/features/insights/BuddgyRead'
import { PaceChart } from '@/components/features/insights/PaceChart'
import { WhereItWent } from '@/components/features/insights/WhereItWent'
import { MonthByMonth } from '@/components/features/insights/MonthByMonth'
import { PatternsSection } from '@/components/features/insights/PatternsSection'
import { LockedFindingSheet, type LockedFinding } from '@/components/features/insights/LockedFindingSheet'
import { navigate } from '@/lib/navigation/navigate'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useInsightsLtCopy } from '@/lib/i18n/insightsLtCopy'
import { useEffect, useMemo, useState } from 'react'
import { InsightsFold } from '@/components/features/insights/InsightsFold'
import { insightsSignature } from '@/lib/insights/useInsightsDot'
import { track } from '@/lib/analytics/events'
import { WhatIfCard } from '@/components/features/insights/WhatIfCard'
import { RecapCards } from '@/components/features/insights/RecapCards'
import { buildRecap } from '@/lib/insights/recap'

const MonthlyChart = dynamic(
  () => import('@/components/reports/MonthlyChart').then((m) => ({ default: m.MonthlyChart })),
  { ssr: false, loading: () => <ChartPlaceholder /> }
)

const CategoryPieChart = dynamic(
  () => import('@/components/reports/CategoryPieChart').then((m) => ({ default: m.CategoryPieChart })),
  { ssr: false, loading: () => <ChartPlaceholder /> }
)

const RANGES: readonly ReportRangePreset[] = ['thisMonth', 'lastMonth', 'last3Months', 'last6Months', 'thisYear']
const SECTION_HEAD = 'px-1 pt-2 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-text-muted)]'

export default function ReportsPage() {
  const r = useReportsPage()
  const t = useT()
  const lt = useInsightsLtCopy()
  const { locale } = useLocale()
  const { input, hero, insights, stats } = useInsights()
  const advanced = canSeeAdvancedInsights(useBillingStore((b) => b.me))
  // Free keeps every range up to 6 months; only what `FREE_RANGES` leaves out is locked.
  const lockedRanges = advanced ? [] : RANGES.filter((x) => !rangeIsFree(x))
  const { dateRange, setDateRange } = r
  // Billing loads after the page: a Pro range picked while it was unknown falls back once the plan says Free.
  useEffect(() => {
    if (!advanced && !rangeIsFree(dateRange)) setDateRange('thisMonth')
  }, [advanced, dateRange, setDateRange])
  const focusInsightId = useSettingsStore((s) => s.focusInsightId)
  useEffect(() => {
    if (!focusInsightId) return
    document.querySelector(`[data-insight-id="${CSS.escape(focusInsightId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    useSettingsStore.getState().setFocusInsightId(null)
  }, [focusInsightId, insights])
  const source = useInsightSource()
  const recap = useMemo(() => buildRecap(source, new Date()), [source])
  const charts = useMemo(() => buildInsightCharts(source, new Date()), [source])
  const [lockSheet, setLockSheet] = useState<LockedFinding | null>(null)
  const openLocked = (finding: LockedFinding = {}) => {
    track('insights.locked_open', { finding: finding.tag ?? 'pro' })
    setLockSheet(finding)
  }
  const openUpgrade = () => {
    track('insights.paywall_open', { source: lockSheet?.tag ? 'finding' : 'page' })
    setLockSheet(null)
    navigate('/settings/pro')
  }
  const signature = insightsSignature(insights)
  useEffect(() => {
    track('insights.opened', { findings: insights.length, advanced })
    // once per visit: the count is read at open time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (signature) useSettingsStore.getState().setInsightsSeen(signature)
  }, [signature])
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  // The pace panel reads the viewed month's stats, so it shows only when that month is the report's current cycle.
  const paceInRange = r.dateRange === 'thisMonth' && reportCycles('thisMonth', new Date(), r.settings.monthStartDay).at(-1) === monthFilter

  const startDay = r.settings.monthStartDay
  const cycleKey = budgetMonthKeyFor(new Date(), startDay)
  const cycleFirst = parseISO(`${cycleKey}-01`)
  const monthName = (d: Date) => formatLocalized(d, 'MMMM', locale)
  const month = monthName(cycleFirst)
  const plan: PlanFigures = {
    budget: stats.totalExpenseBudget,
    projected: stats.projectedSpend,
    dailyRate: stats.dailyRate,
    landDaily: stats.suggestedDaily,
    status: stats.paceStatus,
  }
  const verdict = heroVerdict(input, hero, plan)
  const tiles = heroTiles(insights, advanced)
  // The chart and the read follow spending even with no income; only the hero waits for it.
  const pace = paceVerdict(input, hero, plan)
  const read = advanced ? composeRead(pace, insights) : null
  const slices = categorySlices(charts.categories)
  // The learning page is for a member with no spending history yet; an established one early in a cycle gets the hero's early state.
  const learning = hero.state === 'learning' && charts.months.slice(0, -1).every((m) => m.spent === 0)
  const addIncome = () => useSettingsStore.getState().setActiveModal('addIncome')
  const projected = pace.kind === 'budget' || pace.kind === 'usual' || pace.kind === 'projection' ? pace.projected : null

  const feed = (
    <section className="space-y-2">
      <h2 className={SECTION_HEAD}>{lt.changed.title}</h2>
      <InsightsFeed insights={insights} currency={r.settings.baseCurrency} advanced={advanced} onLocked={openLocked} />
    </section>
  )

  const folds = (
    <>
      {input.debtPlan.monthly > 0 && input.debtPlan.remaining > 0 ? (
        <InsightsFold title={lt.lookingAhead}>
          <WhatIfCard plan={input.debtPlan} locked={!advanced} onUnlock={() => openLocked()} />
        </InsightsFold>
      ) : null}

      <InsightsFold title={t.insights.areasTitle}>
        <InsightsAreas />
      </InsightsFold>

      <InsightsFold title={lt.more}>
        <ReportsNetWorthPanel contained />
        <ReportFilters selected={r.dateRange} onSelect={r.setDateRange} lockedRanges={lockedRanges} onLocked={() => openLocked()} />

        <ReportExpenseDebtFilter value={r.expenseDebtFilter} onChange={r.setExpenseDebtFilter} />

        <div>
        <ReportsSummaryPanel
          startDate={r.startDate}
          endDate={r.endDate}
          baseCurrency={r.settings.baseCurrency}
          periodRecurringIncome={r.periodRecurringIncome}
          periodReceivedIncome={r.periodReceivedIncome}
          remittances={r.remittances}
          totalExpenses={r.totalExpenses}
          largestExpense={r.largestExpense}
          largestExpenseInPrimary={
            r.largestExpense
              ? expenseAmountInBase(r.largestExpense, r.settings.baseCurrency, r.exchangeRates)
              : null
          }
          mostUsedMethod={r.mostUsedMethod}
        />
        </div>

        <PageDivider />

        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        {paceInRange && stats.monthClosed === false && (
        <SpendingPacePanel
          dailyRate={stats.dailyRate}
          projectedSpend={stats.projectedSpend}
          totalExpenseBudget={stats.totalExpenseBudget}
          paceStatus={stats.paceStatus}
          suggestedDaily={stats.suggestedDaily}
          overBudgetCategories={stats.overBudgetCategories}
          currency={stats.baseCurrency}
        />
        )}

        <ReportsSavingsPanel
          transactions={r.savingsTransactions}
          startDate={r.startDate}
          endDate={r.endDate}
          baseCurrency={r.settings.baseCurrency}
          exchangeRates={r.exchangeRates}
        />
        </div>

        <PageDivider />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MonthlyChart data={r.monthlyData} currency={r.settings.baseCurrency} />
          <CategoryPieChart data={r.categoryData} currency={r.settings.baseCurrency} />
        </div>

        <ReportsPaymentMethodPanel methods={r.methodBreakdown} baseCurrency={r.settings.baseCurrency} />

        <ReportsExportBar onExportCsv={r.handleExportCSV} onCopySummary={r.handleCopySummary} />
      </InsightsFold>
    </>
  )

  return (
    <div>
      {/* One centred column on desktop, the width /flow uses. */}
      <PageBody narrow className="space-y-3 pt-3 pb-6">
        {learning ? (
          <>
            <InsightsLearning progress={learningProgress(input)} />
            {insights.length > 0 ? feed : null}
          </>
        ) : (
          <>
            <InsightsHero
              verdict={verdict}
              tiles={tiles}
              dayLabel={lt.hero.dayOf(month, input.cycle.daysElapsed, input.cycle.totalDays)}
              month={month}
              lockedCount={tiles.filter((x) => x.locked).length}
              onSeePro={() => openLocked()}
              onAddIncome={addIncome}
              onSetBudget={plan.budget > 0 ? undefined : () => navigate('/budget-setup')}
            />

            {advanced ? read && <BuddgyReadCard read={read} month={month} /> : <ExplainMonthCard onSeePro={() => openLocked()} />}

            {charts.daily.length > 0 ? (
              <PaceChart cumulative={cumulative(charts.daily)} totalDays={input.cycle.totalDays} start={getMonthRange(cycleKey, startDay).start} budget={plan.budget} projected={projected} />
            ) : null}

            {slices.length > 0 ? (
              <WhereItWent slices={slices} currency={r.settings.baseCurrency} lastMonth={monthName(addMonths(cycleFirst, -1))} days={input.cycle.daysElapsed} />
            ) : null}

            <MonthByMonth
              months={charts.months}
              yearKeys={reportCycles('thisYear', new Date(), startDay)}
              budget={plan.budget}
              yearLocked={!advanced}
              onLocked={() => openLocked()}
            />

            <PatternsSection input={input} insights={insights} locked={!advanced} onLocked={() => openLocked()} />

            {insights.length > 0 ? feed : null}

            <RecapCards
              recap={recap}
              month={recap ? monthName(parseISO(`${recap.cycle}-01`)) : monthName(addMonths(cycleFirst, -1))}
              locked={!advanced}
              onUnlock={() => openLocked()}
            />
          </>
        )}

        {folds}
      </PageBody>
      <LockedFindingSheet finding={lockSheet} onSeePro={openUpgrade} onClose={() => setLockSheet(null)} />
    </div>
  )
}
