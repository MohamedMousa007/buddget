'use client'

import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { Button } from '@/components/ui/button'
import { canBuildEarly, planPhase, planState, type ChatPlan } from '@/lib/buddgy/plan/chatPlan'
import { flowReadiness, nextQuestion, type ScreenAnswer } from '@/lib/budget/flow/flow'
import { useBuddgyPlanCopy } from '@/lib/i18n/buddgyPlanCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { PlanQuestionCard } from './PlanQuestionCard'
import { PlanReadyCard } from './PlanReadyCard'

export interface PlanBlockProps {
  plan: ChatPlan
  missed: boolean
  onAnswer: (answers: ScreenAnswer[]) => void
  onBack: () => void
  onResume: () => void
  onBuildEarly: () => void
  onHandOver: () => void
}

/** Where a budget being built in the chat stands, after the conversation: the question asked now, paused, or ready to review. */
export function PlanBlock({ plan, missed, onAnswer, onBack, onResume, onBuildEarly, onHandOver }: PlanBlockProps) {
  const copy = useBuddgyPlanCopy()
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const phase = planPhase(plan)
  const state = planState(plan)
  const head = nextQuestion(state)

  const body = (() => {
    if (phase === 'ready' || phase === 'handed') return <PlanReadyCard plan={plan} handed={phase === 'handed'} onReview={onHandOver} onChange={onBack} />
    if (phase === 'paused' || !head) {
      return (
        <div className="flex w-full flex-col items-start gap-2">
          <p dir="auto" className="max-w-full rounded-2xl rounded-es-md bg-[var(--color-brand-elevated)] px-4 py-2.5 text-sm text-[var(--color-brand-text-primary)]">{copy.paused}</p>
          <Button variant="outline" size="touch" onClick={onResume}>{copy.resume}</Button>
        </div>
      )
    }
    return (
      <PlanQuestionCard
        state={state}
        head={head}
        step={plan.screens.length}
        base={base}
        missed={missed}
        early={canBuildEarly(plan) ? flowReadiness(state).percent : null}
        onSubmit={onAnswer}
        onBack={plan.screens.length > 0 ? onBack : undefined}
        onBuildEarly={onBuildEarly}
      />
    )
  })()

  return (
    <div className="flex items-end gap-2">
      <span className="mb-0.5 shrink-0 self-start text-[var(--color-brand-text)]">
        <BuddgyIcon mood={phase === 'ready' ? 'happy' : 'curious'} size={26} strokeWidth={1.75} filled />
      </span>
      <div className="flex min-w-0 max-w-[92%] flex-1 flex-col items-start gap-2">{body}</div>
    </div>
  )
}
