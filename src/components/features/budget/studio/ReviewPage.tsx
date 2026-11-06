'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, TriangleAlert } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { PageBody } from '@/components/layout/PageContainer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { usePlanView } from '@/hooks/usePlanView'
import { useBudgetPageActions } from '@/hooks/useBudgetPageActions'
import { BUDGET_BLOCKS } from '@/lib/budget/blocks'
import { findLineView } from '@/lib/budget/planView'
import { learnFromLineEdit } from '@/lib/budget/learnHooks'
import type { BudgetBlock } from '@/lib/store/types'
import { BlockStepper } from '../builder/BlockStepper'
import { BuilderBlockStep } from '../builder/BuilderBlockStep'
import { FreeCapsule } from '../builder/FreeCapsule'
import { StepFooter } from '../builder/StepFooter'
import { FlowStrip } from '../FlowStrip'
import { AddLineSheet } from '../sheets/AddLineSheet'
import { AdjustSheet } from '../sheets/AdjustSheet'
import { LineSheet } from '../sheets/LineSheet'
import { useBudgetBuilderCopy } from '../useBuilderCopy'
import { useBudgetStudioCopy } from '../useStudioCopy'

export interface ReviewPageProps {
  planId: string
  /** Buddgy's notes could not be added; the plan is the engine's own. */
  aiNote: boolean
  onClose: () => void
  onActivate: (planId: string) => void
}

const LAST = BUDGET_BLOCKS.length

/** The built plan, one page at a time like the manual builder: a short summary, then each block, then activate. */
export function ReviewPage({ planId, aiNote, onClose, onActivate }: ReviewPageProps) {
  const c = useBudgetStudioCopy().review
  const b = useBudgetBuilderCopy()
  const view = usePlanView('plan', planId)
  const act = useBudgetPageActions(view)
  const [page, setPage] = useState(0)
  const [risksOpen, setRisksOpen] = useState(false)
  const [lineId, setLineId] = useState<string | null>(null)
  const [addBlock, setAddBlock] = useState<BudgetBlock | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const activating = useRef(false)

  const selected = useMemo(() => (view && lineId ? findLineView(view, lineId) : null), [view, lineId])

  if (!view) return null
  const rationale = view.plan.rationale
  const estimated = view.plan.categories.filter((l) => l.confidence === 'estimated').length
  const reasons = rationale?.reasons ?? []
  const risks = rationale?.risks ?? []
  const block = page > 0 ? BUDGET_BLOCKS[page - 1] : null

  const activate = () => {
    if (activating.current) return
    activating.current = true
    onActivate(planId)
  }

  return (
    <PageBody className="space-y-4 lg:pb-6">
      <div className="flex items-center gap-2">
        <IconButton variant="outlined" aria-label={c.close} onClick={page === 0 ? onClose : () => setPage(page - 1)}>
          <ChevronLeft className="rtl:rotate-180" />
        </IconButton>
        <h1 className="flex-1 text-lg font-bold text-[var(--color-brand-text-primary)]">{c.title}</h1>
        {estimated > 0 ? <Badge variant="muted">{c.estimated(estimated)}</Badge> : null}
      </div>

      <BlockStepper current={page - 1} onSelect={(i) => setPage(i + 1)} note={b.linkedNote} />

      {block === null ? (
        <>
          <Card padding="md" className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <BuddgyIcon mood="happy" size={40} />
              <p className="min-w-0 flex-1 text-[0.9375rem] font-semibold leading-snug text-[var(--color-brand-text-primary)]">{reasons[0]}</p>
            </div>
            {reasons.slice(1, 3).map((r, i) => (
              <p key={`${i}-${r}`} className="flex gap-2 text-sm text-[var(--color-brand-text-secondary)]">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-brand-green)]" aria-hidden />
                {r}
              </p>
            ))}
            {aiNote ? <p className="text-xs text-[var(--color-brand-text-muted)]">{c.aiNote}</p> : null}
          </Card>

          <FlowStrip view={view} onFix={act.moveFreeToBuffer} onJump={(blk) => setPage(BUDGET_BLOCKS.indexOf(blk) + 1)} />

          {risks.length > 0 ? (
            <Card padding="none" className="overflow-hidden">
              <Button
                variant="ghost"
                size="touch"
                aria-expanded={risksOpen}
                onClick={() => setRisksOpen((v) => !v)}
                className="h-12 w-full justify-start gap-3 rounded-none px-4"
              >
                <TriangleAlert className="size-4 shrink-0 text-[var(--color-brand-amber)]" aria-hidden />
                <span className="flex-1 text-sm font-semibold text-[var(--color-brand-text-primary)]">{c.risks}</span>
                <Badge variant="muted">{risks.length}</Badge>
                <ChevronDown className={`size-4 text-[var(--color-brand-text-muted)] transition-transform ${risksOpen ? 'rotate-180' : ''}`} aria-hidden />
              </Button>
              {risksOpen ? (
                <ul className="flex flex-col gap-2 border-t border-[var(--color-brand-border)] px-4 py-3">
                  {risks.map((r, i) => (
                    <li key={`${i}-${r}`} className="text-sm text-[var(--color-brand-text-secondary)]">
                      {r}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}

          <Button size="touch" variant="outline" className="w-full" onClick={() => setAdjusting(true)}>
            <BuddgyIcon mood="idle" size={18} />
            {c.adjust}
          </Button>
          <StepFooter next={{ label: c.start, onClick: () => setPage(1) }} />
        </>
      ) : (
        <>
          <FreeCapsule view={view} onToBuffer={act.moveFreeToBuffer} />
          <BuilderBlockStep
            block={block}
            view={view.blocks[block]}
            base={view.base}
            planLines={view.plan.categories}
            suggestions={[]}
            onToggleSuggestion={() => undefined}
            onAmount={(l, amount) => {
              act.patchLine(l.line.id, { amount })
              learnFromLineEdit(planId, l.line.id, l.amount, amount)
            }}
            onRemove={(l) => act.deleteLine(l.line.id)}
            onOpenLine={setLineId}
            onAdd={() => setAddBlock(block)}
          />
          <StepFooter
            back={{ label: b.previous, onClick: () => setPage(page - 1) }}
            next={page < LAST ? { label: b.next, onClick: () => setPage(page + 1) } : { label: c.activate, onClick: activate, final: true }}
          />
        </>
      )}

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
        onClose={() => setAddBlock(null)}
        onAdd={(line) => {
          act.addLine({ ...line, currency: view.base })
          setAddBlock(null)
        }}
      />
      <AdjustSheet open={adjusting} view={view} onClose={() => setAdjusting(false)} />
    </PageBody>
  )
}
