'use client'

import { ScreenStep } from '@/components/features/budget/studio/ScreenStep'
import { useBudgetStudioCopy } from '@/components/features/budget/useStudioCopy'
import { Button } from '@/components/ui/button'
import type { ScreenAnswer } from '@/lib/budget/flow/flow'
import type { FlowNode, FlowState } from '@/lib/budget/flow/types'
import { fillFor } from '@/lib/buddgy/plan/planSummary'
import { useBuddgyPlanCopy } from '@/lib/i18n/buddgyPlanCopy'
import type { Currency } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'

export interface PlanQuestionCardProps {
  state: FlowState
  head: FlowNode
  /** Changes with every answered screen, so the card starts fresh. */
  step: number
  base: Currency
  /** The typed answer could not be read. */
  missed: boolean
  /** Readiness, when enough is known to build before the last question. */
  early: number | null
  onSubmit: (answers: ScreenAnswer[]) => void
  onBack?: () => void
  onBuildEarly: () => void
}

/** The builder's own screen, drawn as a card in the chat. */
export function PlanQuestionCard({ state, head, step, base, missed, early, onSubmit, onBack, onBuildEarly }: PlanQuestionCardProps) {
  const ui = useBudgetStudioCopy()
  const copy = useBuddgyPlanCopy()
  return (
    <div className="flex w-full flex-col gap-2">
      <section aria-label={copy.start.title} className="rounded-[20px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3.5">
        <ScreenStep key={step} compact state={state} head={head} reopen={false} base={base} saved={false} fill={fillFor(state, (n) => formatCurrency(n, base, false))} onSubmit={onSubmit} />
      </section>
      {missed ? <p role="alert" dir="auto" className="px-1 text-xs text-[var(--color-brand-red)]">{copy.notUnderstood}</p> : null}
      {onBack || early !== null ? (
        <div className="flex flex-wrap gap-1">
          {onBack ? <Button variant="ghost" size="touch" onClick={onBack}>{copy.back}</Button> : null}
          {early !== null ? <Button variant="ghost" size="touch" onClick={onBuildEarly}>{ui.buildNow(early)}</Button> : null}
        </div>
      ) : null}
    </div>
  )
}
