'use client'

import { shortPlanLine } from '@/lib/onboarding/planPickerCopy'
import type { OnboardingAiPlan } from '@/lib/store/types'

export function OnboardingPlanPickerAlerts({
  validationNote,
  plan,
}: {
  validationNote: string | undefined
  plan: OnboardingAiPlan
}) {
  return (
    <>
      {validationNote ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100/95">
          {shortPlanLine(validationNote, 200)}
        </div>
      ) : null}

      {plan.costOfLivingNote ? (
        <p className="text-[11px] text-[var(--color-brand-text-muted)] border-l-2 border-[var(--color-brand-red)]/50 pl-3">
          {shortPlanLine(plan.costOfLivingNote, 140)}
        </p>
      ) : null}
    </>
  )
}
