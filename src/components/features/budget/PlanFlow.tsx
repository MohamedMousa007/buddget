'use client'

import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, TriangleAlert } from 'lucide-react'
import { PageBody } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { useAlert } from '@/components/ui/dialog/DialogProvider'
import { useBudgetPageActions } from '@/hooks/useBudgetPageActions'
import { usePlanView } from '@/hooks/usePlanView'
import { BUDGET_BLOCKS } from '@/lib/budget/blocks'
import { draftToCategories } from '@/lib/budget/draftToPlan'
import { buildFactsFromStore } from '@/lib/budget/factsFromStore'
import { learnFromLineEdit } from '@/lib/budget/learnHooks'
import { findLineView } from '@/lib/budget/planView'
import { canActivate, flaggedBlocks, nextEmpty, nextFlagged, reviewSummary } from '@/lib/budget/reviewState'
import { templateDraft } from '@/lib/budget/templates'
import { useLocale } from '@/lib/i18n'
import type { BudgetBlock } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { formatCurrency } from '@/lib/utils/formatters'
import { SplitBar } from './BudgetHero'
import { monthKeyLabel } from './chromeFormat'
import { LedgerList } from './LedgerList'
import { SegmentPage } from './SegmentPage'
import type { SegmentMark } from './SegmentRail'
import { AddLineSheet } from './sheets/AddLineSheet'
import { AdjustSheet } from './sheets/AdjustSheet'
import { LineSheet } from './sheets/LineSheet'
import { useBudgetBlocksCopy } from './useBlocksCopy'
import { useBudgetBuilderCopy } from './useBuilderCopy'
import { useSegmentCopy } from './useSegmentCopy'

export interface PlanFlowProps {
  planId: string
  /** `review`: check a built plan before activating. `build`: fill a plan by hand, segment by segment. */
  mode: 'review' | 'build'
  /** A plan built by hand reviews its empty segments too. */
  flagEmpty?: boolean
  initialSkipped?: BudgetBlock[]
  /** Skip the "Use my data" start screen. */
  startEmpty?: boolean
  onClose: () => void
  onActivate: (planId: string) => void
  /** Build mode: done with every segment; the plan moves on to review. */
  onFinishBuild: (planId: string, skipped: BudgetBlock[]) => void
}

const newId = () => crypto.randomUUID()

/** The overview and the segment page in review or build mode; one workspace so both flows look and flag the same. */
export function PlanFlow({ planId, mode, flagEmpty = false, initialSkipped = [], startEmpty = false, onClose, onActivate, onFinishBuild }: PlanFlowProps) {
  const t = useSegmentCopy()
  const b = useBudgetBuilderCopy()
  const names = useBudgetBlocksCopy().blockName
  const { locale } = useLocale()
  const alert = useAlert()
  const view = usePlanView('plan', planId)
  const act = useBudgetPageActions(view)
  const [segment, setSegment] = useState<BudgetBlock | null>(null)
  const [lineId, setLineId] = useState<string | null>(null)
  const [addBlock, setAddBlock] = useState<BudgetBlock | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const [reviewed, setReviewed] = useState<ReadonlySet<BudgetBlock>>(new Set())
  const [skipped, setSkipped] = useState<ReadonlySet<BudgetBlock>>(new Set(initialSkipped))
  const [started, setStarted] = useState(startEmpty)
  const busy = useRef(false)
  const build = mode === 'build'
  const selected = useMemo(() => (view && lineId ? findLineView(view, lineId) : null), [view, lineId])

  if (!view) return null
  const money = (n: number) => formatCurrency(n, view.base, false)
  const flagMarks = { reviewed, skipped, flagEmpty: build || flagEmpty }
  const flagged = flaggedBlocks(view.plan, flagMarks)
  const summary = reviewSummary(view, flagged)
  const firstEmpty = build ? nextEmpty(view.plan, skipped, null) : null
  const toggleSkip = (blk: BudgetBlock, on: boolean) =>
    setSkipped((prev) => {
      const next = new Set(prev)
      if (on) next.add(blk)
      else next.delete(blk)
      return next
    })
  const marks = (blk: BudgetBlock): SegmentMark | undefined => {
    if (build) return view.blocks[blk].lines.length > 0 ? 'checked' : undefined
    return flagged.includes(blk) ? 'flag' : reviewed.has(blk) ? 'checked' : undefined
  }

  const useMyData = async () => {
    const facts = buildFactsFromStore(useFinanceStore.getState(), new Date())
    if (!(facts.monthlyIncome > 0)) {
      await alert({ title: b.start.title, body: b.needIncome, okLabel: b.back })
      return
    }
    useFinanceStore.getState().replaceBudgetPlanCategories(planId, draftToCategories(templateDraft(facts, 'mine'), newId, view.base))
    setStarted(true)
  }

  const activate = () => {
    if (busy.current || !canActivate(view, flagged)) return
    busy.current = true
    useFinanceStore.getState().updateBudgetPlan(planId, { status: 'ready' })
    onActivate(planId)
  }

  const lookRight = (blk: BudgetBlock) => {
    const after = new Set(reviewed).add(blk)
    setReviewed(after)
    const left = flaggedBlocks(view.plan, { ...flagMarks, reviewed: after })
    setSegment(nextFlagged(left, blk))
  }

  const sheets = (
    <>
      <LineSheet
        open={selected != null}
        line={selected}
        view={view}
        onClose={() => setLineId(null)}
        onSave={(patch) => {
          if (!selected) return
          act.patchLine(selected.line.id, patch)
          if (patch.amount !== undefined) learnFromLineEdit(planId, selected.line.id, selected.amount, patch.amount)
        }}
        onDelete={act.deleteLine}
        onSyncLive={() => selected && act.syncLive(selected)}
      />
      <AddLineSheet
        open={addBlock != null}
        block={addBlock ?? 'everyday'}
        suggestions={[]}
        addAnotherLabel={build ? t.build.saveAndAdd : undefined}
        onClose={() => setAddBlock(null)}
        onAdd={(line) => act.addLine({ ...line, currency: view.base })}
      />
      <AdjustSheet open={adjusting} view={view} onClose={() => setAdjusting(false)} />
    </>
  )

  if (build && !started && view.plan.categories.length === 0) {
    return (
      <PageBody className="space-y-4 lg:pb-6">
        <div className="flex items-center gap-2">
          <IconButton variant="outlined" aria-label={b.close} onClick={onClose}>
            <ChevronLeft className="rtl:rotate-180" />
          </IconButton>
          <h1 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{b.title}</h1>
        </div>
        <Card padding="md" className="flex flex-col gap-3">
          <p className="text-base font-semibold text-[var(--color-brand-text-primary)]">{t.build.useMyData}</p>
          <p className="text-sm text-[var(--color-brand-text-secondary)]">{t.build.useMyDataSub}</p>
          <Button size="cta-block" onClick={useMyData}>{t.build.useMyData}</Button>
          <Button size="touch" variant="ghost" onClick={() => setStarted(true)}>{t.build.startBlank}</Button>
        </Card>
      </PageBody>
    )
  }

  if (segment) {
    const nextName = build ? nextEmpty(view.plan, skipped, segment) : null
    const next = nextName && nextName !== segment ? nextName : null
    return (
      <PageBody className="space-y-4 lg:pb-6">
        <SegmentPage
          view={view}
          block={segment}
          marks={marks}
          onBack={() => setSegment(null)}
          onSelect={setSegment}
          onOpenLine={setLineId}
          onAdd={setAddBlock}
          review={build ? undefined : { flagged: flagged.includes(segment), onLooksRight: () => lookRight(segment) }}
          build={
            build
              ? {
                  skipped: skipped.has(segment),
                  nextName: next ? names[next] : null,
                  onSkip: () => { toggleSkip(segment, true); setSegment(next) },
                  onUnskip: () => toggleSkip(segment, false),
                  onDone: () => setSegment(next),
                }
              : undefined
          }
        />
        {sheets}
      </PageBody>
    )
  }

  const headline = summary.headline
  const headlineText = headline.kind === 'check' ? t.review.headline.check(headline.n) : headline.kind === 'ready' ? t.review.headline.ready : t.review.headline.over(money(headline.amount))
  const fact = summary.fact
  const factText = !fact ? null : fact.kind === 'unknown' ? t.review.fact.unknown : fact.kind === 'by' ? t.review.fact.by(monthKeyLabel(fact.month, locale)) : t.review.fact.around(monthKeyLabel(fact.month, locale))
  const total = BUDGET_BLOCKS.reduce((s, blk) => s + view.totals[blk], 0)
  const blocked = !canActivate(view, flagged)

  return (
    <PageBody className="space-y-4 lg:pb-6">
      <div className="flex items-center gap-2">
        <IconButton variant="outlined" aria-label={b.close} onClick={onClose}>
          <ChevronLeft className="rtl:rotate-180" />
        </IconButton>
        <h1 className="flex-1 truncate text-lg font-bold text-[var(--color-brand-text-primary)]">{view.plan.name}</h1>
      </div>

      <Card padding="md" className="flex flex-col gap-3">
        {build ? (
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-brand-text-secondary)]">{t.build.plannedSoFar}</span>
              <span className="font-mono-numbers text-[32px] font-semibold leading-none text-[var(--color-brand-text-primary)]">{money(total)}</span>
            </div>
            {view.income > 0 ? <span className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">{t.hero.share(`${Math.round((total / view.income) * 100)}%`)}</span> : null}
          </div>
        ) : (
          <>
            <p className={'flex items-center gap-1.5 text-base font-semibold ' + (headline.kind === 'over' ? 'text-[var(--color-brand-red-text)]' : 'text-[var(--color-brand-text-primary)]')} role={headline.kind === 'over' ? 'alert' : undefined}>
              {headline.kind === 'over' ? <TriangleAlert className="size-4 shrink-0" aria-hidden /> : null}
              {headlineText}
            </p>
            {factText ? <p className="text-sm text-[var(--color-brand-text-secondary)]">{factText}</p> : null}
          </>
        )}
        <SplitBar view={view} />
        {build ? null : (
          <Button variant="link" size="touch" className="self-start" onClick={() => setAdjusting(true)}>
            {t.review.askBuddgy}
          </Button>
        )}
      </Card>

      <LedgerList
        view={view}
        review={!build}
        onOpen={setSegment}
        rowExtras={
          build
            ? (blk) => ({
                tag: firstEmpty === blk ? t.build.startHere : undefined,
                statusOverride: view.blocks[blk].lines.length === 0 ? (skipped.has(blk) ? t.build.skipped : t.build.emptyRow) : undefined,
              })
            : undefined
        }
      />

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-10 -mx-4 bg-[var(--color-brand-bg)] px-4 pb-3 pt-2 lg:bottom-4 lg:pe-24">
        {build ? (
          <Button size="cta-block" disabled={view.plan.categories.length === 0} onClick={() => onFinishBuild(planId, [...skipped])}>
            {t.build.finish}
          </Button>
        ) : flagged.length > 0 ? (
          <Button size="cta-block" onClick={() => setSegment(nextFlagged(flagged, null))}>
            {t.review.checkFlagged(flagged.length)}
          </Button>
        ) : (
          <Button size="cta-block" disabled={blocked} onClick={activate}>
            {t.review.activate}
          </Button>
        )}
      </div>
      {sheets}
    </PageBody>
  )
}
