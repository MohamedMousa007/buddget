'use client'

import type { OnboardingAiPlan } from '@/lib/store/types'
import type { ExpenseCategory } from '@/lib/store/types'
import { useOnboardingPlanPicker } from '@/hooks/useOnboardingPlanPicker'
import { OnboardingPlanPickerHero } from '@/components/features/onboarding/OnboardingPlanPickerHero'
import { OnboardingPlanPickerAlerts } from '@/components/features/onboarding/OnboardingPlanPickerAlerts'
import { OnboardingPlanPickerCategoryGrid } from '@/components/features/onboarding/OnboardingPlanPickerCategoryGrid'
import { OnboardingPlanPickerAssumptions } from '@/components/features/onboarding/OnboardingPlanPickerAssumptions'
import { OnboardingPlanPickerNav } from '@/components/features/onboarding/OnboardingPlanPickerNav'

export function OnboardingPlanPicker({
  plans,
  validationNotes,
  busy,
  onAccept,
}: {
  plans: OnboardingAiPlan[]
  validationNotes: string[]
  busy: boolean
  onAccept: (plan: OnboardingAiPlan) => void
}) {
  const picker = useOnboardingPlanPicker(plans)
  const note = validationNotes.find((n) => n.trim().length > 0)

  if (!picker.plan || !picker.percents) return null

  const percents = picker.percents as Record<ExpenseCategory, number>
  const acceptPayload = picker.acceptPayload!
  return (
    <div className="glass-card rounded-2xl p-6 w-full max-w-4xl flex flex-col gap-6 self-center">
      <OnboardingPlanPickerHero
        idx={picker.idx}
        plansLength={picker.plansLength}
        plan={picker.plan}
        monthlyTakeHome={picker.monthlyTakeHome}
        baseCurrency={picker.settings.baseCurrency}
      />

      <OnboardingPlanPickerAlerts validationNote={note} plan={picker.plan} />

      <OnboardingPlanPickerCategoryGrid
        percents={percents}
        monthlyTakeHome={picker.monthlyTakeHome}
        baseCurrency={picker.settings.baseCurrency}
        onPctChange={picker.setPct}
        onAmtChange={picker.setAmt}
      />

      <OnboardingPlanPickerAssumptions items={picker.plan.assumptions} />

      <OnboardingPlanPickerNav
        idx={picker.idx}
        plansLength={picker.plansLength}
        busy={busy}
        onPrev={picker.goPrev}
        onNext={picker.goNext}
        acceptPayload={acceptPayload}
        onAccept={onAccept}
      />
    </div>
  )
}
