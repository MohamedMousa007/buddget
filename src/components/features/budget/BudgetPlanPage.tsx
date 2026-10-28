'use client'

import { intlTag } from '@/lib/i18n/dateFormat'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PageBody } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useBudgetPageActions } from '@/hooks/useBudgetPageActions'
import { usePlanActions } from '@/hooks/usePlanActions'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { Gauge, History, Plus, Sparkles } from 'lucide-react'
import { summarizePlan } from '@/lib/budget/planSummary'
import { fallbackPlanId } from '@/lib/budget/activePlan'
import { useLocale } from '@/lib/i18n'
import { usePlanView } from '@/hooks/usePlanView'
import type { CreateIntent } from '@/lib/budget/templates'
import { navigate } from '@/lib/navigation/navigate'
import { formatCurrency } from '@/lib/utils/formatters'
import { BLOCK_CHAPTER } from '@/lib/budget/blocks'
import { findLineView } from '@/lib/budget/planView'
import type { LineAction } from '@/lib/budget/lineStatus'
import type { Insight } from '@/lib/budget/insights'
import type { LineView, PlanMode } from '@/lib/budget/planView.types'
import type { BudgetBlock } from '@/lib/store/types'
import { PlanBar } from './PlanBar'
import { FlowStrip } from './FlowStrip'
import { PlanChapters } from './PlanChapters'
import { InsightsChip } from './InsightsChip'
import { InsightsSheet } from './InsightsSheet'
import { EmptyPlan } from './EmptyPlan'
import { LearningNote } from './LearningNote'
import { UpgradeBanner } from './UpgradeBanner'
import { LineSheet } from './sheets/LineSheet'
import { AddLineSheet } from './sheets/AddLineSheet'
import { ActivateSheet } from './sheets/ActivateSheet'
import { ComparePlansSheet } from './sheets/ComparePlansSheet'
import { PlanDeck } from './PlanDeck'
import { ManualBuilder } from './builder/ManualBuilder'
import { CreateChooser } from './builder/CreateChooser'
import { StudioPage } from './studio/StudioPage'
import { ReviewPage } from './studio/ReviewPage'
import { AdjustSheet } from './sheets/AdjustSheet'
import { MonthCloseCard } from './MonthCloseCard'
import { PlanRail } from './PlanRail'
import { LINKED_ROUTE } from './chromeFormat'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { cycleKeyOf } from '@/lib/budget/activations'
import { StressTestSheet } from './sheets/StressTestSheet'
import { useBudgetStressCopy } from './useStressCopy'
import { MonthCloseSheet } from './sheets/MonthCloseSheet'
import { useMonthClose } from '@/hooks/useMonthClose'
import { mergeClosedCycles, nextCloseMemory } from '@/lib/budget/closeMemory'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useBudgetDeckCopy } from './useDeckCopy'
import { useBudgetStudioCopy } from './useStudioCopy'
import { useBudgetPageCopy } from './usePageCopy'
import type { ChapterView } from '@/lib/budget/planView.types'

/** The Budget page: the active plan as chapters of blocks, with a This month overlay. */
export function BudgetPlanPage({ ready }: { ready: boolean }) {
  const t = useBudgetPageCopy()
  const planActions = usePlanActions()
  const store = useFinanceStore
  const deckCopy = useBudgetDeckCopy()
  const studioCopy = useBudgetStudioCopy()
  const { locale } = useLocale()
  const [mode, setMode] = useState<PlanMode>('plan')
  // Drafts and archived plans are still the user's plans: with no live one, the first plan stands in so the chrome never vanishes.
  const standInPlanId = useFinanceStore((s) => fallbackPlanId(s.budgetPlans, s.activeBudgetPlanId))
  const view = usePlanView(mode, standInPlanId)
  const act = useBudgetPageActions(view)
  const [collapsed, setCollapsed] = useState<ReadonlySet<ChapterView['chapter']>>(new Set())
  const [lineId, setLineId] = useState<string | null>(null)
  const [addBlock, setAddBlock] = useState<BudgetBlock | null>(null)
  const [insightsOpen, setInsightsOpen] = useState(false)
  // With more than one plan the switcher starts open; the user's own toggle wins afterwards.
  const [deckToggled, setDeckToggled] = useState<boolean | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null)
  const [activateId, setActivateId] = useState<string | null>(null)
  const [compare, setCompare] = useState<{ a: string; b: string } | null>(null)
  const [upgradeLater, setUpgradeLater] = useState(false)
  const [building, setBuilding] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [studio, setStudio] = useState<{ intent: CreateIntent | null } | null>(null)
  // Buddgy's chat can start the guided setup; the request is honoured once, here, and cleared.
  const studioRequested = useSettingsStore((s) => s.budgetStudioRequested)
  useEffect(() => {
    if (!studioRequested) return
    useSettingsStore.getState().clearBudgetStudioRequest()
    setStudio({ intent: null })
  }, [studioRequested])
  const [review, setReview] = useState<{ id: string; aiNote: boolean } | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const accountClosedCycles = useFinanceStore((st) => st.profile.financialProfile?.closedCycles)
  useEffect(() => {
    const local = useSettingsStore.getState().budgetClosedCycles
    const merged = mergeClosedCycles(local, accountClosedCycles)
    if (merged !== local) useSettingsStore.setState({ budgetClosedCycles: merged })
  }, [accountClosedCycles])
  const monthClose = useMonthClose()
  const [closeOpen, setCloseOpen] = useState(false)
  const [stressOpen, setStressOpen] = useState(false)
  const stressCopy = useBudgetStressCopy()
  const [buildEmpty, setBuildEmpty] = useState(false)
  const openBuilder = useCallback((id: string, empty = false) => {
    setCreating(false)
    setBuildEmpty(empty)
    setBuilding(id)
  }, [])
  const startBuild = useCallback(() => setCreating(true), [])
  // Leaving the builder with nothing in the draft removes it, so empty drafts do not pile up.
  const exitBuilder = useCallback(() => {
    const id = building
    setBuilding(null)
    const s = store.getState()
    const draft = id ? s.budgetPlans.find((p) => p.id === id) : undefined
    if (draft && draft.status === 'draft' && draft.categories.length === 0) s.deleteBudgetPlan(draft.id)
  }, [building, store])
  // The takeover screens are state, not routes: the hardware back steps out one level instead of leaving the tab.
  useEffect(() => {
    if (!building && !studio && !review && !creating) return
    return registerBackGuard(() => {
      if (building) exitBuilder()
      else if (studio) {
        setStudio(null)
        setCreating(true)
      } else if (review) setReview(null)
      else setCreating(false)
      return true
    })
  }, [building, studio, review, creating, exitBuilder])
  const finishBuild = useCallback(
    (id: string) => {
      setBuilding(null)
      if (store.getState().activeBudgetPlanId) setActivateId(id)
      else planActions.activate(id)
    },
    [planActions, store],
  )

  const { plans, activeId, activations, rates } = useFinanceStore(
    useShallow((s) => ({
      plans: s.budgetPlans,
      activeId: s.activeBudgetPlanId,
      activations: s.budgetPlanActivations,
      rates: s.exchangeRates,
    })),
  )
  const deckOpen = deckToggled ?? plans.length > 1

  const selectedLine = useMemo<LineView | null>(() => (view && lineId ? findLineView(view, lineId) : null), [view, lineId])

  const jump = useCallback(
    (block: BudgetBlock) => {
      setCollapsed((prev) => {
        const next = new Set(prev)
        next.delete(BLOCK_CHAPTER[block])
        return next
      })
      requestAnimationFrame(() => document.getElementById(`block-${block}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    },
    [],
  )

  const onLineAction = useCallback(
    (line: LineView, action: LineAction) => {
      if (action === 'update') act.syncLive(line)
      else if (action === 'addLine') setAddBlock('everyday')
      else if (action !== 'none') setLineId(line.line.id)
    },
    [act],
  )

  const onInsightAction = useCallback(
    (insight: Insight) => {
      setInsightsOpen(false)
      switch (insight.action) {
        case 'moveBuffer':
          act.moveFreeToBuffer()
          break
        case 'update':
          act.syncAllLive()
          break
        case 'addLine':
          setAddBlock('everyday')
          break
        case 'raise': {
          const avg = Number(insight.params.avg3)
          if (insight.lineId && Number.isFinite(avg)) act.patchLine(insight.lineId, { amount: Math.round(avg) })
          break
        }
        default:
          if (insight.lineId) setLineId(insight.lineId)
      }
    },
    [act],
  )

  const onFix = useCallback(() => {
    if (!view) return
    if (view.free > 0) act.moveFreeToBuffer()
    else jump('everyday')
  }, [act, jump, view])

  if (!ready) {
    return (
      <PageBody className="space-y-4">
        <SkeletonList rows={4} />
      </PageBody>
    )
  }

  if (building) return <ManualBuilder planId={building} startEmpty={buildEmpty} onExit={exitBuilder} onFinish={finishBuild} />

  if (studio) {
    return (
      <StudioPage
        intent={studio.intent}
        onClose={() => setStudio(null)}
        onBuilt={(id, aiNote) => {
          setStudio(null)
          setReview({ id, aiNote })
        }}
      />
    )
  }

  if (review) {
    return (
      <ReviewPage
        planId={review.id}
        aiNote={review.aiNote}
        onClose={() => setReview(null)}
        onEdit={(id) => {
          setReview(null)
          openBuilder(id)
        }}
        onActivate={(id) => {
          setReview(null)
          store.getState().updateBudgetPlan(id, { status: 'ready' })
          finishBuild(id)
        }}
      />
    )
  }

  if (creating) {
    return (
      <CreateChooser
        plans={plans}
        drafts={plans.filter((p) => p.status === 'draft')}
        onIntent={(intent) => {
          setCreating(false)
          setStudio({ intent })
        }}
        onBlank={() => openBuilder(planActions.createDraft(), true)}
        onTemplate={() => openBuilder(planActions.createDraft())}
        onCopy={(id) => {
          const copy = planActions.duplicate(id)
          if (copy) openBuilder(copy)
        }}
        onContinue={openBuilder}
        onClose={() => setCreating(false)}
      />
    )
  }

  if (!view) {
    return (
      <PageBody className="space-y-4">
        <EmptyPlan onBuildWithBuddgy={() => setStudio({ intent: null })} onManual={startBuild} />
      </PageBody>
    )
  }

  const base = view.base
  // The month the activation really takes over from follows the pay cycle, not the calendar.
  const cycleKey = cycleKeyOf(new Date(), store.getState().settings.monthStartDay)
  const cycleMonthLabel = new Date(Number(cycleKey.slice(0, 4)), Number(cycleKey.slice(5, 7)) - 1, 1).toLocaleDateString(intlTag(locale), { month: 'long' })
  const closeMonth = monthClose
    ? new Date(Number(monthClose.cycleKey.slice(0, 4)), Number(monthClose.cycleKey.slice(5, 7)) - 1, 1).toLocaleDateString(intlTag(locale), { month: 'long' })
    : ''
  const summaries = Object.fromEntries(plans.map((p) => [p.id, summarizePlan(p, view.income, base, rates)]))
  const sinceKey = activations
    .filter((a) => a.planId === activeId)
    .map((a) => a.effectiveFrom.slice(0, 7))
    .sort()
    .pop()
  const activeSince = sinceKey
    ? new Date(Number(sinceKey.slice(0, 4)), Number(sinceKey.slice(5, 7)) - 1, 1).toLocaleDateString(intlTag(locale), { month: 'short' })
    : null
  return (
    <PageBody className="space-y-4 lg:pb-6">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-6">
      <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
      <PlanBar
        planName={view.plan.name}
        mode={mode}
        onModeChange={setMode}
        expanded={deckOpen}
        onOpenPlans={() => {
          setSelectedPlanId(view.plan.id)
          setDeckToggled(!deckOpen)
        }}
        onOpenMenu={setMenuAnchor}
      />
      {deckOpen ? (
        <PlanDeck
          plans={[...plans].sort((x, y) => Number(y.id === activeId) - Number(x.id === activeId))}
          activeId={activeId}
          selectedId={selectedPlanId ?? view.plan.id}
          summaries={summaries}
          income={view.income}
          base={base}
          activeSince={activeSince}
          onSelect={setSelectedPlanId}
          onActivate={setActivateId}
          onDuplicate={planActions.duplicate}
          onRename={planActions.rename}
          onDelete={planActions.remove}
          onHistory={() => navigate('/budget-history')}
          onCompare={(id) => setCompare({ a: view.plan.id, b: id === view.plan.id ? (plans.find((p) => p.id !== id)?.id ?? id) : id })}
          onNew={startBuild}
          onContinue={(id) => openBuilder(id)}
        />
      ) : null}
      {mode === 'plan' && monthClose ? <MonthCloseCard month={closeMonth} onOpen={() => setCloseOpen(true)} /> : null}
      </div>
      <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-h-lg)+1.25rem)] lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <FlowStrip view={view} onFix={onFix} onJump={jump} />
        <InsightsChip insights={view.insights} onOpen={() => setInsightsOpen(true)} />
        <PlanRail
          plans={plans}
          activeId={activeId}
          onActivate={setActivateId}
          onContinue={(id) => openBuilder(id)}
          onCompare={() => setCompare({ a: view.plan.id, b: plans.find((p) => p.id !== view.plan.id)?.id ?? view.plan.id })}
          onNew={startBuild}
          onHistory={() => navigate('/budget-history')}
        />
      </aside>
      <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-2">
      {view.learning ? <LearningNote /> : null}
      {view.needsUpgrade && view.plan.categories.length > 0 && !upgradeLater ? (
        <UpgradeBanner
          lineCount={view.plan.categories.length}
          onReview={act.groupLegacyLines}
          onLater={() => setUpgradeLater(true)}
        />
      ) : null}

      <PlanChapters
        view={view}
        mode={mode}
        collapsed={collapsed}
        onToggle={(chapter) =>
          setCollapsed((prev) => {
            const next = new Set(prev)
            if (!next.delete(chapter)) next.add(chapter)
            return next
          })
        }
        onOpenLine={setLineId}
        onLineAction={onLineAction}
        onAdd={setAddBlock}
        onOpenLinked={(b) => {
          const route = LINKED_ROUTE[b]
          if (route) navigate(route)
        }}
      />

      {mode === 'month' && view.unassignedSpend > 0 ? (
        <Card className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
              {t.unassigned.title(formatCurrency(view.unassignedSpend, base, false))}
            </p>
            <p className="text-xs text-[var(--color-brand-text-secondary)]">{t.unassigned.body}</p>
          </div>
          <Button size="touch" onClick={() => setAddBlock('everyday')}>
            {t.unassigned.cta}
          </Button>
        </Card>
      ) : null}
      </div>
      </div>

      <InsightsSheet
        open={insightsOpen}
        insights={view.insights}
        base={base}
        onClose={() => setInsightsOpen(false)}
        onInsightAction={onInsightAction}
      />
      <LineSheet
        open={selectedLine != null}
        line={selectedLine}
        view={view}
        onClose={() => setLineId(null)}
        onSave={(patch) => selectedLine && act.patchLine(selectedLine.line.id, patch)}
        onDelete={act.deleteLine}
        onSyncLive={() => selectedLine && act.syncLive(selectedLine)}
      />
      <AddLineSheet
        open={addBlock != null}
        block={addBlock ?? 'everyday'}
        suggestions={[]}
        onClose={() => setAddBlock(null)}
        onAdd={(line) => {
          act.addLine({ ...line, currency: base })
          setAddBlock(null)
        }}
      />
      <ActivateSheet
        open={activateId != null}
        plan={plans.find((p) => p.id === activateId) ?? null}
        current={view.plan}
        next={activateId ? summaries[activateId] ?? null : null}
        now={summaries[view.plan.id] ?? null}
        base={base}
        monthLabel={cycleMonthLabel}
        onConfirm={() => activateId && planActions.activate(activateId)}
        onClose={() => setActivateId(null)}
      />
      <ComparePlansSheet
        open={compare != null && plans.length > 1}
        plans={plans}
        aId={compare?.a ?? null}
        bId={compare?.b ?? null}
        base={base}
        rates={rates}
        onChange={(a, b) => setCompare({ a, b })}
        onClose={() => setCompare(null)}
      />
      <AdjustSheet open={adjusting} view={view} onClose={() => setAdjusting(false)} />
      <StressTestSheet open={stressOpen} view={view} onClose={() => setStressOpen(false)} />
      <MonthCloseSheet
        open={closeOpen}
        close={monthClose}
        base={base}
        month={closeMonth}
        onApply={(p) => act.patchLine(p.lineId, { amount: p.to })}
        onDismiss={() => setCloseOpen(false)}
        onFinish={(appliedIds) => {
          setCloseOpen(false)
          if (!monthClose) return
          useSettingsStore.getState().closeBudgetCycle(monthClose.cycleKey)
          const { profile, updateProfile } = store.getState()
          const closeMemory = nextCloseMemory(profile.financialProfile?.closeMemory, monthClose.proposals, appliedIds, monthClose.cycleKey)
          const closedCycles = mergeClosedCycles(useSettingsStore.getState().budgetClosedCycles, profile.financialProfile?.closedCycles)
          updateProfile({ financialProfile: { ...profile.financialProfile, closeMemory, closedCycles } })
        }}
      />
      <CardActionMenu
        anchor={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        items={[
          { label: deckCopy.deck.history, icon: <History className="size-4" />, onSelect: () => navigate('/budget-history') },
          { label: studioCopy.adjust.title, icon: <Sparkles className="size-4" />, onSelect: () => setAdjusting(true) },
          { label: stressCopy.menu, icon: <Gauge className="size-4" />, onSelect: () => setStressOpen(true) },
          { label: deckCopy.deck.newPlan, icon: <Plus className="size-4" />, onSelect: startBuild },
        ]}
      />
    </PageBody>
  )
}
