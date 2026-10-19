'use client'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PageBody } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useBudgetPageActions } from '@/hooks/useBudgetPageActions'
import { usePlanActions } from '@/hooks/usePlanActions'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { History, Plus } from 'lucide-react'
import { summarizePlan } from '@/lib/budget/planSummary'
import { useLocale } from '@/lib/i18n'
import { usePlanView } from '@/hooks/usePlanView'
import { navigate } from '@/lib/navigation/navigate'
import { formatCurrency } from '@/lib/utils/formatters'
import { BUDGET_BLOCKS, BLOCK_CHAPTER } from '@/lib/budget/blocks'
import type { LineAction } from '@/lib/budget/lineStatus'
import type { Insight } from '@/lib/budget/insights'
import type { LineView, PlanMode } from '@/lib/budget/planView.types'
import type { BudgetBlock } from '@/lib/store/types'
import { PlanBar } from './PlanBar'
import { FlowStrip } from './FlowStrip'
import { ChapterCard } from './ChapterCard'
import { BlockShell } from './BlockShell'
import { InsightsChip } from './InsightsChip'
import { InsightsSheet } from './InsightsSheet'
import { EmptyPlan } from './EmptyPlan'
import { UpgradeBanner } from './UpgradeBanner'
import { BLOCK_BODIES } from './blocks'
import { LineSheet } from './sheets/LineSheet'
import { AddLineSheet } from './sheets/AddLineSheet'
import { ActivateSheet } from './sheets/ActivateSheet'
import { PlanDeck } from './PlanDeck'
import { useBudgetDeckCopy } from './useDeckCopy'
import { useBudgetPageCopy } from './usePageCopy'
import type { ChapterView } from '@/lib/budget/planView.types'

const LINKED_ROUTE: Partial<Record<BudgetBlock, string>> = {
  subscriptions: '/subscriptions',
  debts: '/debts',
  goals: '/goals',
  safety: '/wealth',
}

/** The Budget page: the active plan as chapters of blocks, with a This month overlay. */
export function BudgetPlanPage({ ready }: { ready: boolean }) {
  const t = useBudgetPageCopy()
  const planActions = usePlanActions()
  const deckCopy = useBudgetDeckCopy()
  const { locale } = useLocale()
  const [mode, setMode] = useState<PlanMode>('plan')
  const view = usePlanView(mode)
  const act = useBudgetPageActions(view)
  const [collapsed, setCollapsed] = useState<ReadonlySet<ChapterView['chapter']>>(new Set())
  const [lineId, setLineId] = useState<string | null>(null)
  const [addBlock, setAddBlock] = useState<BudgetBlock | null>(null)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [deckOpen, setDeckOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null)
  const [activateId, setActivateId] = useState<string | null>(null)
  const [upgradeLater, setUpgradeLater] = useState(false)

  const { plans, activeId, activations, rates } = useFinanceStore(
    useShallow((s) => ({
      plans: s.budgetPlans,
      activeId: s.activeBudgetPlanId,
      activations: s.budgetPlanActivations,
      rates: s.exchangeRates,
    })),
  )

  const selectedLine = useMemo<LineView | null>(() => {
    if (!view || !lineId) return null
    for (const block of BUDGET_BLOCKS) {
      const found = view.blocks[block].lines.find((l) => l.line.id === lineId)
      if (found) return found
    }
    return null
  }, [view, lineId])

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

  if (!view) {
    return (
      <PageBody className="space-y-4">
        <EmptyPlan onStarter={act.createStarterPlan} onBlank={act.createBlankPlan} />
      </PageBody>
    )
  }

  const base = view.base
  const summaries = Object.fromEntries(plans.map((p) => [p.id, summarizePlan(p, view.income, base, rates)]))
  const sinceKey = activations
    .filter((a) => a.planId === activeId)
    .map((a) => a.effectiveFrom.slice(0, 7))
    .sort()
    .pop()
  const activeSince = sinceKey
    ? new Date(Number(sinceKey.slice(0, 4)), Number(sinceKey.slice(5, 7)) - 1, 1).toLocaleDateString(locale, { month: 'short' })
    : null
  return (
    <PageBody className="space-y-4 lg:pb-6">
      <PlanBar
        planName={view.plan.name}
        mode={mode}
        onModeChange={setMode}
        expanded={deckOpen}
        onOpenPlans={() => {
          setSelectedPlanId(view.plan.id)
          setDeckOpen((v) => !v)
        }}
        onOpenMenu={setMenuAnchor}
      />
      {deckOpen ? (
        <PlanDeck
          plans={plans}
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
          onNew={planActions.createBlank}
        />
      ) : null}
      <FlowStrip view={view} onFix={onFix} onJump={jump} />
      <InsightsChip insights={view.insights} onOpen={() => setInsightsOpen(true)} />
      {view.needsUpgrade && view.plan.categories.length > 0 && !upgradeLater ? (
        <UpgradeBanner
          lineCount={view.plan.categories.length}
          onReview={act.groupLegacyLines}
          onLater={() => setUpgradeLater(true)}
        />
      ) : null}

      {view.chapters.map((chapter, i) => (
        <ChapterCard
          key={chapter.chapter}
          chapter={chapter}
          index={i + 1}
          mode={mode}
          base={base}
          expanded={!collapsed.has(chapter.chapter)}
          onToggle={() =>
            setCollapsed((prev) => {
              const next = new Set(prev)
              if (!next.delete(chapter.chapter)) next.add(chapter.chapter)
              return next
            })
          }
        >
          {chapter.blocks.map((block) => {
            const Body = BLOCK_BODIES[block.block]
            return (
              <BlockShell key={block.block} id={`block-${block.block}`} block={block} mode={mode} base={base}>
                <Body
                  view={view}
                  block={block}
                  mode={mode}
                  onOpenLine={setLineId}
                  onLineAction={onLineAction}
                  onAdd={setAddBlock}
                  onOpenLinked={(b) => {
                    const route = LINKED_ROUTE[b]
                    if (route) navigate(route)
                  }}
                />
              </BlockShell>
            )
          })}
        </ChapterCard>
      ))}

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
        monthLabel={new Date().toLocaleDateString(locale, { month: 'long' })}
        onConfirm={() => activateId && planActions.activate(activateId)}
        onClose={() => setActivateId(null)}
      />
      <CardActionMenu
        anchor={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        items={[
          { label: deckCopy.deck.history, icon: <History className="size-4" />, onSelect: () => navigate('/budget-history') },
          { label: deckCopy.deck.newPlan, icon: <Plus className="size-4" />, onSelect: planActions.createBlank },
        ]}
      />
    </PageBody>
  )
}
