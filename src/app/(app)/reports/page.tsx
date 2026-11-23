'use client'

import { PageBody, PageDivider } from '@/components/layout/PageContainer'
import dynamic from 'next/dynamic'
import { ChartPlaceholder } from '@/components/reports/ChartPlaceholder'
import { ReportFilters } from '@/components/reports/ReportFilters'
import { ReportExpenseDebtFilter } from '@/components/reports/ReportExpenseDebtFilter'
import { useReportsPage } from '@/hooks/useReportsPage'
import { expenseAmountInBase } from '@/lib/utils/calculations'
import { ReportsSummaryPanel } from '@/components/features/reports/ReportsSummaryPanel'
import { ReportsPaymentMethodPanel } from '@/components/features/reports/ReportsPaymentMethodPanel'
import { ReportsExportBar } from '@/components/features/reports/ReportsExportBar'
import { SpendingPacePanel } from '@/components/reports/SpendingPacePanel'
import { ReportsSavingsPanel } from '@/components/reports/ReportsSavingsPanel'
import { ReportsNetWorthPanel } from '@/components/reports/ReportsNetWorthPanel'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { reportCycles } from '@/lib/reports/reportsPeriod'
import { useBillingStore } from '@/lib/billing/billingStore'
import { canSeeAdvancedInsights, FREE_RANGES } from '@/lib/insights/access'
import { useInsightSource, useInsights } from '@/lib/insights/useInsights'
import { InsightsHero } from '@/components/features/insights/InsightsHero'
import { InsightsFeed } from '@/components/features/insights/InsightsFeed'
import { InsightsLearning } from '@/components/features/insights/InsightsLearning'
import { InsightsAreas } from '@/components/features/insights/InsightsAreas'
import { navigate } from '@/lib/navigation/navigate'
import { useT } from '@/lib/i18n'
import { useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
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

export default function ReportsPage() {
  const r = useReportsPage()
  const t = useT()
  const { input, hero, insights } = useInsights()
  const advanced = canSeeAdvancedInsights(useBillingStore((b) => b.me))
  const lockedRanges = advanced ? [] : (['last6Months', 'thisYear'] as const).filter((x) => !FREE_RANGES.includes(x))
  const focusInsightId = useSettingsStore((s) => s.focusInsightId)
  useEffect(() => {
    if (!focusInsightId) return
    document.querySelector(`[data-insight-id="${CSS.escape(focusInsightId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    useSettingsStore.getState().setFocusInsightId(null)
  }, [focusInsightId, insights])
  const source = useInsightSource()
  const recap = useMemo(() => buildRecap(source, new Date()), [source])
  const openUpgrade = () => navigate('/settings/pro')
  const stats = useMonthlyStats()
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  // The pace panel reads the viewed month's stats, so it shows only when that month is the report's current cycle.
  const paceInRange = r.dateRange === 'thisMonth' && reportCycles('thisMonth', new Date(), r.settings.monthStartDay).at(-1) === monthFilter

  return (
    <div>
      <PageBody className="space-y-4 pt-3">
        <InsightsHero hero={hero} input={input} currency={r.settings.baseCurrency} />

        <section className="space-y-2">
          <h2 className="px-1 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-text-muted)]">{t.insights.feedTitle}</h2>
          {insights.length === 0 ? (
            <InsightsLearning daysMore={hero.daysMore} totalDays={input.cycle.totalDays} />
          ) : (
            <InsightsFeed insights={insights} currency={r.settings.baseCurrency} advanced={advanced} />
          )}
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-text-muted)]">{t.insights.whatIf.ahead}</h2>
          {input.debtPlan.monthly > 0 && input.debtPlan.remaining > 0 ? (
            <WhatIfCard plan={input.debtPlan} currency={r.settings.baseCurrency} locked={!advanced} onUnlock={openUpgrade} />
          ) : (
            <p className="px-1 text-[0.78125rem] text-[var(--color-brand-text-muted)]">{t.insights.whatIf.none}</p>
          )}
          <h3 className="px-1 pt-1 text-sm font-bold text-[var(--color-brand-text-primary)]">{t.insights.recap.title}</h3>
          <RecapCards recap={recap} currency={r.settings.baseCurrency} locked={!advanced} onUnlock={openUpgrade} />
          <Card padding="md" className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
              <BuddgyIcon size={26} mood="happy" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[0.9375rem] text-[var(--color-brand-text-primary)]">{t.insights.explain.title}</b>
              <span className="block text-xs text-[var(--color-brand-text-muted)]">{t.insights.explain.sub}</span>
            </span>
            <Button
              size="touch"
              variant={advanced ? 'default' : 'outline'}
              onClick={() => (advanced ? useSettingsStore.getState().openAiChatWithSeed(t.insights.explain.seed, true) : openUpgrade())}
            >
              {advanced ? t.insights.askBuddgy : t.insights.seePro}
            </Button>
          </Card>
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-text-muted)]">{t.insights.areasTitle}</h2>
          <InsightsAreas />
        </section>

        <PageDivider />

        <h2 className="px-1 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-text-muted)]">{t.insights.detailsTitle}</h2>
        <ReportsNetWorthPanel contained />
        <ReportFilters selected={r.dateRange} onSelect={r.setDateRange} lockedRanges={lockedRanges} onLocked={() => navigate('/settings/pro')} />

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
      </PageBody>
    </div>
  )
}
