'use client'

import { useRef, useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { Textarea } from '@/components/ui/textarea'
import { useActionToast } from '@/components/ui/ActionToast'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { applyOps, type OpsResult } from '@/lib/budget/ops'
import { toAdjustLines } from '@/lib/budget/budgetAi'
import { requestAdjust } from '@/lib/budget/budgetAiClient'
import { logAdjustFeedback } from '@/lib/budget/feedbackLog'
import { lineBlock } from '@/lib/budget/blocks'
import { effectivePlanCategoryAmountInBase } from '@/lib/budget/budgetPlans'
import type { PlanView } from '@/lib/budget/planView.types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useBudgetStudioCopy } from '../useStudioCopy'

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'preview'; reply: string; result: OpsResult; text: string }

const newId = () => crypto.randomUUID()

export interface AdjustSheetProps {
  open: boolean
  view: PlanView
  onClose: () => void
}

/** Free-text edits: the model proposes ops, the app previews the diff, the user applies (with Undo). */
export function AdjustSheet({ open, view, onClose }: AdjustSheetProps) {
  return (
    <ModalShell open={open} onBackdropClick={onClose} padContent>
      {open ? <AdjustForm view={view} onClose={onClose} /> : null}
    </ModalShell>
  )
}

function AdjustForm({ view, onClose }: { view: PlanView; onClose: () => void }) {
  const c = useBudgetStudioCopy().adjust
  const toast = useActionToast()
  const store = useFinanceStore
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const abort = useRef<AbortController | null>(null)
  const plan = view.plan
  const money = (n: number) => formatCurrency(n, view.base, false)

  const send = async () => {
    if (!text.trim()) return
    abort.current?.abort()
    abort.current = new AbortController()
    setPhase({ kind: 'loading' })
    const res = await requestAdjust(toAdjustLines(plan.categories, lineBlock), text, view.base, view.income, abort.current.signal)
    if (!res.ok) {
      setPhase({ kind: 'error', message: res.reason === 'quota' ? c.quota : res.reason === 'unavailable' ? c.unavailable : c.failed })
      return
    }
    const result = applyOps(plan.categories, res.data.ops, { newId, maxAmount: Math.max(view.income, 1) * 10 })
    setPhase(
      result.applied.length === 0
        ? { kind: 'error', message: res.data.reply || c.nothing }
        : { kind: 'preview', reply: res.data.reply, result, text },
    )
  }

  const apply = (p: Extract<Phase, { kind: 'preview' }>) => {
    const before = plan.categories
    const after = p.result.lines
    store.getState().replaceBudgetPlanCategories(plan.id, after)
    void logAdjustFeedback({ planId: plan.id, text: p.text, ops: p.result.applied, before, after, outcome: 'applied' })
    toast(c.applied, {
      undoLabel: c.undo,
      undo: () => {
        store.getState().replaceBudgetPlanCategories(plan.id, before)
        void logAdjustFeedback({ planId: plan.id, text: p.text, ops: p.result.applied, before, after, outcome: 'undone' })
      },
    })
    onClose()
  }

  const freeAfter = (p: Extract<Phase, { kind: 'preview' }>) => {
    const { exchangeRates } = store.getState()
    const total = p.result.lines.reduce((s, l) => s + effectivePlanCategoryAmountInBase(l, view.base, exchangeRates), 0)
    return Math.round((view.income - total) * 100) / 100
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <ModalSheetHeader title={c.title} onClose={onClose} titleRowClassName="mb-0" />

      {phase.kind === 'preview' ? (
        <>
          <div className="flex items-start gap-3">
            <BuddgyIcon mood="happy" size={36} />
            <p className="text-sm text-[var(--color-brand-text-primary)]">{phase.reply}</p>
          </div>
          <div className="flex flex-col gap-1.5 rounded-2xl bg-[var(--color-brand-elevated)] p-3">
            <p className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">
              {c.changes(phase.result.diff.length)} · {balanceText(freeAfter(phase), c, money)}
            </p>
            {phase.result.diff.map((d) => (
              <div key={`${d.id}-${d.kind}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-[var(--color-brand-text-primary)]">{d.name}</span>
                <span className="font-mono-numbers shrink-0 text-xs text-[var(--color-brand-text-secondary)]">
                  {d.before === null ? `+ ${money(d.after ?? 0)}` : d.after === null ? `− ${money(d.before)}` : `${money(d.before)} → ${money(d.after)}`}
                </span>
              </div>
            ))}
          </div>
          {phase.result.rejected.length > 0 ? (
            <p className="text-xs text-[var(--color-brand-text-secondary)]">{c.rejected(phase.result.rejected.length)}</p>
          ) : null}
          <div className="flex gap-2">
            <Button size="cta" variant="outline" className="flex-1" onClick={() => setPhase({ kind: 'idle' })}>
              {c.cancel}
            </Button>
            <Button size="cta" className="flex-[1.4]" onClick={() => apply(phase)}>
              {c.apply}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={c.placeholder}
            maxLength={400}
            className="min-h-24 text-[15px]"
            aria-label={c.title}
          />
          <div className="flex flex-wrap gap-2">
            {c.examples.map((x) => (
              <OptionChip key={x} as="trigger" size="md" onClick={() => setText(x)}>
                {x}
              </OptionChip>
            ))}
          </div>
          {phase.kind === 'error' ? <p className="text-sm text-[var(--color-brand-red-text)]">{phase.message}</p> : null}
          <Button size="cta" className="w-full" disabled={!text.trim() || phase.kind === 'loading'} onClick={send}>
            {phase.kind === 'loading' ? c.thinking : c.send}
          </Button>
        </>
      )}
    </div>
  )
}

function balanceText(free: number, c: ReturnType<typeof useBudgetStudioCopy>['adjust'], money: (n: number) => string) {
  if (Math.abs(free) < 0.5) return c.balanced
  return free > 0 ? c.left(money(free)) : c.over(money(-free))
}
