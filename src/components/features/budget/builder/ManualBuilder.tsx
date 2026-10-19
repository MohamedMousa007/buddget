'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { PageBody } from '@/components/layout/PageContainer'
import { useAlert } from '@/components/ui/dialog/DialogProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { usePlanView } from '@/hooks/usePlanView'
import { useBudgetPageActions } from '@/hooks/useBudgetPageActions'
import { buildFactsFromStore } from '@/lib/budget/factsFromStore'
import { draftToCategories } from '@/lib/budget/draftToPlan'
import { BLOCK_META, BUDGET_BLOCKS } from '@/lib/budget/blocks'
import { BUILD_TEMPLATES, suggestionToCategory, suggestionsByBlock, templateDraft, type BuildTemplate } from '@/lib/budget/templates'
import type { DraftLine } from '@/lib/budget/facts'
import type { LineView } from '@/lib/budget/planView.types'
import { LineIcon } from '../LineIcon'
import { AddLineSheet } from '../sheets/AddLineSheet'
import { LineSheet } from '../sheets/LineSheet'
import { useBudgetSheetsCopy } from '../useSheetsCopy'
import { useBudgetBuilderCopy } from '../useBuilderCopy'
import { blockColor } from '../chromeFormat'
import { BuilderBlockStep } from './BuilderBlockStep'
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
  const blockNames = useBudgetSheetsCopy().blocks
  const alert = useAlert()
  const view = usePlanView('plan', planId)
  const act = useBudgetPageActions(view)
  const store = useFinanceStore
  const [step, setStep] = useState(0)
  const [started, setStarted] = useState(() => startEmpty || (view?.plan.categories.length ?? 0) > 0)
  const [lineId, setLineId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const facts = useMemo(() => buildFactsFromStore(store.getState(), new Date()), [store])
  const suggestions = useMemo(() => suggestionsByBlock(templateDraft(facts, 'mine')), [facts])

  if (!view) return null
  const base = view.base
  const block = BUDGET_BLOCKS[step]
  const selectedLine = lineId ? view.blocks.bills.lines.find((l) => l.line.id === lineId) ?? null : null

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
    store.getState().updateBudgetPlan(planId, { status: 'ready' })
    onFinish(planId)
  }

  return (
    <PageBody className="space-y-4 lg:pb-6">
      <div className="flex items-center gap-2">
        <IconButton variant="outlined" aria-label={c.close} onClick={onExit}>
          <ChevronLeft />
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
                <span className="text-[15px] font-semibold">{c.start.templates[t].name}</span>
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
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              {BUDGET_BLOCKS.map((b, i) => {
                const state = i < step ? 'done' : i === step ? 'current' : 'todo'
                const color = blockColor(b)
                return (
                  <IconButton
                    key={b}
                    variant="outlined"
                    aria-label={c.stepLabel(blockNames[b], state)}
                    aria-current={state === 'current' ? 'step' : undefined}
                    onClick={() => setStep(i)}
                    className="relative"
                    style={state === 'todo' ? undefined : { color, borderColor: state === 'current' ? color : 'transparent', background: `color-mix(in srgb, ${color} 16%, var(--color-brand-card))` }}
                  >
                    <LineIcon name={BLOCK_META[b].icon} className="size-5" />
                    {state === 'done' ? (
                      <span className="absolute -end-1 -top-1 z-[2] flex size-[18px] items-center justify-center rounded-full border-2 border-[var(--color-brand-bg)] bg-[var(--color-brand-green)] text-[var(--color-brand-on-primary)]">
                        <Check className="size-3" aria-hidden />
                      </span>
                    ) : null}
                  </IconButton>
                )
              })}
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-brand-text-secondary)]">
              <span className="font-semibold uppercase tracking-wider">{c.blockOf(step + 1, BUDGET_BLOCKS.length)}</span>
              <span className="text-end">{c.linkedNote}</span>
            </div>
          </div>

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

          <Card padding="md" className="flex gap-2">
            <Button size="cta" variant="outline" className="flex-1" disabled={step === 0} onClick={() => setStep(step - 1)}>
              <ChevronLeft aria-hidden />
              {c.previous}
            </Button>
            {step < LAST ? (
              <Button size="cta" className="flex-[1.4]" onClick={() => setStep(step + 1)}>
                {c.next}
                <ChevronRight aria-hidden />
              </Button>
            ) : (
              <Button size="cta" className="flex-[1.4]" onClick={finish}>
                {c.finish}
              </Button>
            )}
          </Card>
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
