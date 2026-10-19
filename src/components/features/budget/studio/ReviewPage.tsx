'use client'

import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, Pencil, TriangleAlert } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { PageBody } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { usePlanView } from '@/hooks/usePlanView'
import { useBudgetPageActions } from '@/hooks/useBudgetPageActions'
import type { BudgetChapter } from '@/lib/budget/blocks'
import { findLineView } from '@/lib/budget/planView'
import type { BudgetBlock } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { navigate } from '@/lib/navigation/navigate'
import { LINKED_ROUTE } from '../chromeFormat'
import { FlowStrip } from '../FlowStrip'
import { PlanChapters } from '../PlanChapters'
import { AddLineSheet } from '../sheets/AddLineSheet'
import { AdjustSheet } from '../sheets/AdjustSheet'
import { LineSheet } from '../sheets/LineSheet'
import { useBudgetStudioCopy } from '../useStudioCopy'

export interface ReviewPageProps {
  planId: string
  /** Buddgy's notes could not be added; the plan is the engine's own. */
  aiNote: boolean
  onClose: () => void
  onEdit: (planId: string) => void
  onActivate: (planId: string) => void
}

/** The built plan as a document: why, risks, every block with its reasons, then adjust / edit / activate. */
export function ReviewPage({ planId, aiNote, onClose, onEdit, onActivate }: ReviewPageProps) {
  const c = useBudgetStudioCopy().review
  const view = usePlanView('plan', planId)
  const act = useBudgetPageActions(view)
  const [collapsed, setCollapsed] = useState<ReadonlySet<BudgetChapter>>(new Set())
  const [lineId, setLineId] = useState<string | null>(null)
  const [addBlock, setAddBlock] = useState<BudgetBlock | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const activating = useRef(false)

  const selected = useMemo(() => (view && lineId ? findLineView(view, lineId) : null), [view, lineId])

  if (!view) return null
  const rationale = view.plan.rationale
  const estimated = view.plan.categories.filter((l) => l.confidence === 'estimated').length

  return (
    <PageBody className="space-y-4 lg:pb-6">
      <div className="flex items-center gap-2">
        <IconButton variant="outlined" aria-label={c.close} onClick={onClose}>
          <ChevronLeft className="rtl:rotate-180" />
        </IconButton>
        <h1 className="flex-1 text-lg font-bold text-[var(--color-brand-text-primary)]">{c.title}</h1>
      </div>

      <Card padding="md" className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <BuddgyIcon mood="happy" size={36} />
          <span className={microClassName}>{c.why}</span>
        </div>
        {aiNote ? <p className="text-xs text-[var(--color-brand-text-secondary)]">{c.aiNote}</p> : null}
        <ol className="flex flex-col gap-2">
          {rationale?.reasons.map((r, i) => (
            <li key={r} className="flex gap-2.5 text-sm text-[var(--color-brand-text-primary)]">
              <span className="font-mono-numbers text-[var(--color-brand-text-muted)]">{i + 1}</span>
              {r}
            </li>
          ))}
        </ol>
        {rationale?.risks?.length ? (
          <div className="flex flex-col gap-1.5 border-t border-[var(--color-brand-border)] pt-3">
            <span className={microClassName}>{c.risks}</span>
            {rationale.risks.map((r) => (
              <p key={r} className="flex gap-2 text-sm text-[var(--color-brand-text-secondary)]">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--color-brand-amber)]" aria-hidden />
                {r}
              </p>
            ))}
          </div>
        ) : null}
        {estimated > 0 ? <p className="text-xs text-[var(--color-brand-amber)]">{c.estimated(estimated)}</p> : null}
      </Card>

      <FlowStrip
        view={view}
        onFix={act.moveFreeToBuffer}
        onJump={(b) => {
          setCollapsed(new Set())
          requestAnimationFrame(() => document.getElementById(`block-${b}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
        }}
      />

      <PlanChapters
        view={view}
        mode="plan"
        collapsed={collapsed}
        onToggle={(ch) =>
          setCollapsed((prev) => {
            const next = new Set(prev)
            if (!next.delete(ch)) next.add(ch)
            return next
          })
        }
        onOpenLine={setLineId}
        onLineAction={(l) => setLineId(l.line.id)}
        onAdd={setAddBlock}
        onOpenLinked={(b) => {
          const route = LINKED_ROUTE[b]
          if (route) navigate(route)
        }}
      />

      <Card padding="md" className="flex flex-col gap-2">
        <Button size="cta" className="w-full" onClick={() => {
            if (activating.current) return
            activating.current = true
            onActivate(planId)
          }}>
          {c.activate}
        </Button>
        <div className="flex gap-2">
          <Button size="touch" variant="outline" className="flex-1" onClick={() => setAdjusting(true)}>
            <BuddgyIcon mood="idle" size={18} />
            {c.adjust}
          </Button>
          <Button size="touch" variant="outline" onClick={() => onEdit(planId)}>
            <Pencil aria-hidden />
            {c.edit}
          </Button>
        </div>
      </Card>

      <LineSheet
        open={selected != null}
        line={selected}
        view={view}
        onClose={() => setLineId(null)}
        onSave={(patch) => selected && act.patchLine(selected.line.id, patch)}
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
