'use client'

import { intlTag } from '@/lib/i18n/dateFormat'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PageBody } from '@/components/layout/PageContainer'
import { IconButton } from '@/components/ui/IconButton'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useBudgetPageActions } from '@/hooks/useBudgetPageActions'
import { usePlanActions } from '@/hooks/usePlanActions'
import { History } from 'lucide-react'
import { summarizePlan } from '@/lib/budget/planSummary'
import { fallbackPlanId, selectActivePlan } from '@/lib/budget/activePlan'
import { useLocale } from '@/lib/i18n'
import { usePlanView } from '@/hooks/usePlanView'
import { navigate } from '@/lib/navigation/navigate'
import { findLineView } from '@/lib/budget/planView'
import type { LineView, PlanMode } from '@/lib/budget/planView.types'
import type { BudgetBlock } from '@/lib/store/types'
import { PlanBar } from './PlanBar'
import { LedgerList } from './LedgerList'
import { SegmentPage } from './SegmentPage'
import { useBudgetTakeover } from './useBudgetTakeover'
import { FlowStrip } from './FlowStrip'
import { UpgradeBanner } from './UpgradeBanner'
import { LineSheet } from './sheets/LineSheet'
import { AddLineSheet } from './sheets/AddLineSheet'
import { ActivateSheet } from './sheets/ActivateSheet'
import { ComparePlansSheet } from './sheets/ComparePlansSheet'
import { PlanDeck } from './PlanDeck'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { ManualBuilder } from './builder/ManualBuilder'
import { CreateChooser } from './builder/CreateChooser'
import { StudioPage } from './studio/StudioPage'
import { PlanFlow } from './PlanFlow'
import { AdjustSheet } from './sheets/AdjustSheet'
import { MonthCloseCard } from './MonthCloseCard'
import { cycleKeyOf } from '@/lib/budget/activations'
import { MonthCloseSheet } from './sheets/MonthCloseSheet'
import { useMonthClose } from '@/hooks/useMonthClose'
import { mergeClosedCycles, nextCloseMemory } from '@/lib/budget/closeMemory'
import { learnFromClose, learnFromLineEdit } from '@/lib/budget/learnHooks'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useBudgetDeckCopy } from './useDeckCopy'
import { useBudgetStudioCopy } from './useStudioCopy'

/** The Budget page: the active plan as chapters of blocks, with a This month overlay. */
export function BudgetPlanPage({ ready }: { ready: boolean }) {
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
  const [lineId, setLineId] = useState<string | null>(null)
  const [addBlock, setAddBlock] = useState<BudgetBlock | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [activateId, setActivateId] = useState<string | null>(null)
  const [compare, setCompare] = useState<{ a: string; b: string } | null>(null)
  const [upgradeLater, setUpgradeLater] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const accountClosedCycles = useFinanceStore((st) => st.profile.financialProfile?.closedCycles)
  useEffect(() => {
    const local = useSettingsStore.getState().budgetClosedCycles
    const merged = mergeClosedCycles(local, accountClosedCycles)
    if (merged !== local) useSettingsStore.setState({ budgetClosedCycles: merged })
  }, [accountClosedCycles])
  const monthClose = useMonthClose()
  const [closeOpen, setCloseOpen] = useState(false)
  const onActivate = useCallback(
    (id: string) => {
      if (store.getState().activeBudgetPlanId) setActivateId(id)
      else planActions.activate(id)
    },
    [planActions, store],
  )
  const { segment, setSegment, building, setBuilding, buildEmpty, creating, setCreating, studio, setStudio, review, setReview, openBuilder, startBuild, exitBuilder, finishBuild } =
    useBudgetTakeover(onActivate)

  const { plans, activeId, activations, rates } = useFinanceStore(
    useShallow((s) => ({
      plans: s.budgetPlans,
      activeId: s.activeBudgetPlanId,
      activations: s.budgetPlanActivations,
      rates: s.exchangeRates,
    })),
  )

  const selectedLine = useMemo<LineView | null>(() => (view && lineId ? findLineView(view, lineId) : null), [view, lineId])

  if (!ready) {
    return (
      <PageBody className="space-y-4">
        <SkeletonList rows={4} />
      </PageBody>
    )
  }

  if (building) {
    // The old stepper stays reachable behind a flag until the new builder has been verified on a device.
    if (process.env.NEXT_PUBLIC_LEGACY_BUDGET_BUILDER === '1') return <ManualBuilder planId={building} startEmpty={buildEmpty} onExit={exitBuilder} onFinish={finishBuild} />
    return (
      <PlanFlow
        planId={building}
        mode="build"
        startEmpty={buildEmpty}
        onClose={exitBuilder}
        onActivate={finishBuild}
        onFinishBuild={(id, skipped) => {
          setBuilding(null)
          setReview({ id, aiNote: false, flagEmpty: true, skipped })
        }}
      />
    )
  }

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
      <PlanFlow
        planId={review.id}
        mode="review"
        flagEmpty={review.flagEmpty}
        initialSkipped={review.skipped}
        onClose={() => setReview(null)}
        onActivate={(id) => {
          setReview(null)
          finishBuild(id)
        }}
        onFinishBuild={() => undefined}
      />
    )
  }

  const chooser = (onClose?: () => void) => (
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
      onClose={onClose}
    />
  )

  if (creating) return chooser(() => setCreating(false))

  // With no budget yet the chooser is the page: nothing to close.
  if (!view) return chooser()

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
  const deckActions = {
    plans: [...plans].sort((x, y) => Number(y.id === activeId) - Number(x.id === activeId)),
    onDuplicate: planActions.duplicate,
    onRename: planActions.rename,
    onDelete: planActions.remove,
    onCompare: (id: string) => setCompare({ a: view.plan.id, b: id === view.plan.id ? (plans.find((p) => p.id !== id)?.id ?? id) : id }),
  }
  const hero = (
    <>
      <PlanBar
        planName={view.plan.name}
        state={view.plan.id === selectActivePlan(plans, activeId)?.id ? 'active' : view.plan.status === 'draft' ? 'draft' : 'ready'}
        mode={mode}
        onModeChange={setMode}
        expanded={switcherOpen}
        onOpenPlans={() => {
          setSelectedPlanId(view.plan.id)
          setSwitcherOpen(true)
        }}
      />
      {mode === 'plan' && monthClose ? <MonthCloseCard month={closeMonth} onOpen={() => setCloseOpen(true)} /> : null}
      <FlowStrip view={view} variant="hero" />
      {view.needsUpgrade && view.plan.categories.length > 0 && !upgradeLater ? (
        <UpgradeBanner lineCount={view.plan.categories.length} onReview={act.groupLegacyLines} onLater={() => setUpgradeLater(true)} />
      ) : null}
      <LedgerList view={view} onOpen={setSegment} />
    </>
  )
  return (
    <PageBody className="space-y-4 lg:pb-6">
      {segment ? (
        <SegmentPage view={view} block={segment} onBack={() => setSegment(null)} onSelect={setSegment} onOpenLine={setLineId} onAdd={setAddBlock} />
      ) : (
        <div className="flex flex-col gap-3">{hero}</div>
      )}

      <LineSheet
        open={selectedLine != null}
        line={selectedLine}
        view={view}
        onClose={() => setLineId(null)}
        onSave={(patch) => {
          if (!selectedLine) return
          act.patchLine(selectedLine.line.id, patch)
          if (patch.amount !== undefined) learnFromLineEdit(view.plan.id, selectedLine.line.id, selectedLine.amount, patch.amount)
        }}
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
          learnFromClose(monthClose.proposals)
          const closeMemory = nextCloseMemory(profile.financialProfile?.closeMemory, monthClose.proposals, appliedIds, monthClose.cycleKey)
          const closedCycles = mergeClosedCycles(useSettingsStore.getState().budgetClosedCycles, profile.financialProfile?.closedCycles)
          updateProfile({ financialProfile: { ...profile.financialProfile, closeMemory, closedCycles } })
        }}
      />
      <ModalShell open={switcherOpen} onBackdropClick={() => setSwitcherOpen(false)} padContent>
        <V3SheetHeader
          title={deckCopy.deck.title}
          onClose={() => setSwitcherOpen(false)}
          extra={
            <IconButton variant="tinted" size="sm" shape="round" aria-label={deckCopy.deck.history} onClick={() => { setSwitcherOpen(false); navigate('/budget-history') }}>
              <History />
            </IconButton>
          }
        />
        <PlanDeck
          {...deckActions}
          onAdjust={() => { setSwitcherOpen(false); setAdjusting(true) }}
          adjustLabel={studioCopy.review.adjust}
          activeId={activeId}
          selectedId={selectedPlanId ?? view.plan.id}
          summaries={summaries}
          income={view.income}
          base={base}
          activeSince={activeSince}
          renamingId={renameId}
          onRenaming={setRenameId}
          onSelect={setSelectedPlanId}
          onActivate={(id) => {
            setSwitcherOpen(false)
            setActivateId(id)
          }}
          onDuplicate={(id) => {
            setSwitcherOpen(false)
            planActions.duplicate(id)
          }}
          onNew={() => {
            setSwitcherOpen(false)
            startBuild()
          }}
          onContinue={(id) => {
            setSwitcherOpen(false)
            openBuilder(id)
          }}
        />
      </ModalShell>
    </PageBody>
  )
}
