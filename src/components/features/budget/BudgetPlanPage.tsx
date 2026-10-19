'use client'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PageBody } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useBudgetPageActions } from '@/hooks/useBudgetPageActions'
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
import { PlanListSheet } from './sheets/PlanListSheet'
import { useBudgetBlocksCopy } from './useBlocksCopy'
import { useBudgetPageCopy } from './usePageCopy'
import type { ChapterView } from '@/lib/budget/planView.types'

const LINKED_ROUTE: Partial<Record<BudgetBlock, string>> = {
  subscriptions: '/subscriptions',
  debts: '/debts',
  goals: '/goals',
  safety: '/wealth',
}

const newId = () => crypto.randomUUID()

/** The Budget page: the active plan as chapters of blocks, with a This month overlay. */
export function BudgetPlanPage({ ready }: { ready: boolean }) {
  const t = useBudgetPageCopy()
  const blocksCopy = useBudgetBlocksCopy()
  const confirm = useConfirm()
  const [mode, setMode] = useState<PlanMode>('plan')
  const view = usePlanView(mode)
  const act = useBudgetPageActions(view)
  const [collapsed, setCollapsed] = useState<ReadonlySet<ChapterView['chapter']>>(new Set())
  const [lineId, setLineId] = useState<string | null>(null)
  const [addBlock, setAddBlock] = useState<BudgetBlock | null>(null)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [plansOpen, setPlansOpen] = useState(false)
  const [upgradeLater, setUpgradeLater] = useState(false)

  const { plans, activeId } = useFinanceStore(useShallow((s) => ({ plans: s.budgetPlans, activeId: s.activeBudgetPlanId })))
  const store = useFinanceStore

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

  const duplicatePlan = useCallback(
    (id: string) => {
      const s = store.getState()
      const source = s.budgetPlans.find((p) => p.id === id)
      if (!source) return
      const copy = s.addBudgetPlan(t.planNames.copyOf(source.name), { status: 'draft', origin: 'clone', intent: source.intent })
      s.updateBudgetPlan(copy, {
        status: 'ready',
        categories: source.categories.map((c) => ({
          ...c,
          id: newId(),
          subcategories: c.subcategories.map((sc) => ({ ...sc, id: newId() })),
        })),
      })
    },
    [store, t],
  )

  const newBlankPlan = useCallback(() => {
    const s = store.getState()
    const id = s.addBudgetPlan(t.planNames.fresh, { status: 'draft', origin: 'manual' })
    s.updateBudgetPlan(id, { status: 'ready' })
  }, [store, t])

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
  return (
    <PageBody className="space-y-4 lg:pb-6">
      <PlanBar
        planName={view.plan.name}
        mode={mode}
        onModeChange={setMode}
        onOpenPlans={() => setPlansOpen(true)}
        onOpenMenu={() => setPlansOpen(true)}
      />
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
      <PlanListSheet
        open={plansOpen}
        plans={plans}
        activeId={activeId}
        onClose={() => setPlansOpen(false)}
        onActivate={(id) => store.getState().setActiveBudgetPlanId(id)}
        onRename={(id, name) => store.getState().updateBudgetPlan(id, { name })}
        onDuplicate={duplicatePlan}
        onDelete={(id) => store.getState().deleteBudgetPlan(id)}
        onNew={newBlankPlan}
      />
    </PageBody>
  )
}
