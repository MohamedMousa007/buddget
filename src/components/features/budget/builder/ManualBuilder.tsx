'use client'

import { useMemo, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { PageBody } from '@/components/layout/PageContainer'
import { useAlert } from '@/components/ui/dialog/DialogProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { usePlanView } from '@/hooks/usePlanView'
import { useBudgetPageActions } from '@/hooks/useBudgetPageActions'
import { buildFactsFromStore } from '@/lib/budget/factsFromStore'
import { draftToCategories } from '@/lib/budget/draftToPlan'
import { BUDGET_BLOCKS } from '@/lib/budget/blocks'
import { findLineView } from '@/lib/budget/planView'
import { BUILD_TEMPLATES, suggestionToCategory, suggestionsByBlock, templateDraft, type BuildTemplate } from '@/lib/budget/templates'
import type { DraftLine } from '@/lib/budget/facts'
import type { LineView } from '@/lib/budget/planView.types'
import { AddLineSheet } from '../sheets/AddLineSheet'
import { LineSheet } from '../sheets/LineSheet'
import { useBudgetBuilderCopy } from '../useBuilderCopy'
import { BlockStepper } from './BlockStepper'
import { BuilderBlockStep } from './BuilderBlockStep'
import { StepFooter } from './StepFooter'
import { FreeCapsule } from './FreeCapsule'

const newId = () => crypto.randomUUID()
const LAST = BUDGET_BLOCKS.length - 1

export interface ManualBuilderProps {
  planId: string
  /** Skip the template picker and start on an empty first block. */
  startEmpty?: boolean
  onExit: () => void
  onFinish: (planId: string) => void
}

/** Block-by-block plan builder over a draft plan. Every edit lands in the store immediately. */
export function ManualBuilder({ planId, startEmpty = false, onExit, onFinish }: ManualBuilderProps) {
  const c = useBudgetBuilderCopy()
  const alert = useAlert()
  const view = usePlanView('plan', planId)
  const act = useBudgetPageActions(view)
  const store = useFinanceStore
  const [step, setStep] = useState(0)
  const [started, setStarted] = useState(() => startEmpty || (view?.plan.categories.length ?? 0) > 0)
  const [lineId, setLineId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const finishing = useRef(false)

  const facts = useMemo(() => buildFactsFromStore(store.getState(), new Date()), [store])
  const suggestions = useMemo(() => suggestionsByBlock(templateDraft(facts, 'mine')), [facts])

  if (!view) return null
  const base = view.base
  const block = BUDGET_BLOCKS[step]
  const selectedLine = lineId ? findLineView(view, lineId) : null

  const apply = async (t: BuildTemplate | null) => {
    if (t) {
      if (!(facts.monthlyIncome > 0)) {
        await alert({ title: c.start.title, body: c.needIncome, okLabel: c.back })
        return
      }
      store.getState().replaceBudgetPlanCategories(planId, draftToCategories(templateDraft(facts, t), newId, base))
    }
    setStarted(true)
  }

  const toggle = (s: DraftLine, added: LineView['line'] | undefined) => {
    if (added) act.deleteLine(added.id)
    else act.addLine(suggestionToCategory(s, newId(), base))
  }

  const finish = () => {
    if (finishing.current) return
    finishing.current = true
    store.getState().updateBudgetPlan(planId, { status: 'ready' })
    onFinish(planId)
  }

  return (
    <PageBody className="space-y-4 lg:pb-6">
      <div className="flex items-center gap-2">
        <IconButton variant="outlined" aria-label={c.close} onClick={onExit}>
          <ChevronLeft className="rtl:rotate-180" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight text-[var(--color-brand-text-primary)]">{c.title}</h1>
          <p className="truncate text-xs text-[var(--color-brand-text-secondary)]">{c.subtitle(view.plan.name)}</p>
        </div>
        <Button size="touch" variant="ghost" onClick={onExit}>
          {c.saveDraft}
        </Button>
      </div>

      {!started ? (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-base font-semibold text-[var(--color-brand-text-primary)]">{c.start.title}</p>
            <p className="text-sm text-[var(--color-brand-text-secondary)]">{c.start.sub}</p>
          </div>
          {BUILD_TEMPLATES.map((t) => (
            <Button key={t} variant="outline" className="h-auto w-full justify-start py-3 text-start" onClick={() => apply(t)}>
              <span className="flex min-w-0 flex-col">
                <span className="text-[0.9375rem] font-semibold">{c.start.templates[t].name}</span>
                <span className="whitespace-normal text-xs font-normal text-[var(--color-brand-text-secondary)]">{c.start.templates[t].sub}</span>
              </span>
            </Button>
          ))}
          <Button size="touch" variant="ghost" onClick={() => apply(null)}>
            {c.start.blank}
          </Button>
        </div>
      ) : (
        <>
          <BlockStepper current={step} onSelect={setStep} note={c.linkedNote} />

          <FreeCapsule view={view} onToBuffer={act.moveFreeToBuffer} />

          <BuilderBlockStep
            block={block}
            view={view.blocks[block]}
            base={base}
            planLines={view.plan.categories}
            suggestions={suggestions[block]}
            onToggleSuggestion={toggle}
            onAmount={(l, amount) => act.patchLine(l.line.id, { amount })}
            onRemove={(l) => act.deleteLine(l.line.id)}
            onOpenLine={setLineId}
            onAdd={() => setAdding(true)}
          />

          <StepFooter
            back={step > 0 ? { label: c.previous, onClick: () => setStep(step - 1) } : undefined}
            next={step < LAST ? { label: c.next, onClick: () => setStep(step + 1) } : { label: c.finish, onClick: finish, final: true }}
          />
        </>
      )}

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
        open={adding}
        block={block}
        suggestions={[]}
        onClose={() => setAdding(false)}
        onAdd={(line) => {
          act.addLine({ ...line, currency: base })
          setAdding(false)
        }}
      />
    </PageBody>
  )
}
