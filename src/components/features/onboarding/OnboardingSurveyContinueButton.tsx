'use client'

import { ChevronRight } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { SurveyStep } from '@/lib/onboarding/surveyConfig'
import type { StepContinuePayload } from '@/lib/onboarding/onboardingStepPayload'
import type { OnboardingPaymentDraft } from '@/lib/store/types'
import type { IncomeOnboardingPayload } from '@/components/onboarding/IncomeOnboardingPanel'
import type { DebtOnboardingPayload } from '@/components/onboarding/DebtOnboardingPanel'
import type { SubscriptionsOnboardingPayload } from '@/components/onboarding/SubscriptionsOnboardingPanel'

export interface OnboardingSurveyContinueButtonProps {
  step: SurveyStep
  canContinue: boolean
  finishing: boolean
  planLoading: boolean
  isLastSurveyStep: boolean
  onContinue: (payload: StepContinuePayload) => void | Promise<void>
  textValue: string
  selected: string | null
  multi: string[]
  paymentDrafts: OnboardingPaymentDraft[]
  incomePayload: IncomeOnboardingPayload
  debtPayload: DebtOnboardingPayload
  subscriptionsPayload: SubscriptionsOnboardingPayload
}

/**
 * Primary continue CTA; dispatches the correct payload for the active step type.
 */
export function OnboardingSurveyContinueButton({
  step,
  canContinue,
  finishing,
  planLoading,
  isLastSurveyStep,
  onContinue,
  textValue,
  selected,
  multi,
  paymentDrafts,
  incomePayload,
  debtPayload,
  subscriptionsPayload,
}: OnboardingSurveyContinueButtonProps) {
  const t = useT()
  const o = t.onboarding

  return (
    <button
      type="button"
      disabled={!canContinue || finishing || planLoading}
      onClick={() => {
        if (step.type === 'static') void onContinue({ kind: 'static' })
        else if (step.type === 'text') void onContinue({ kind: 'text', textValue })
        else if (step.type === 'number') void onContinue({ kind: 'number', textValue })
        else if (step.type === 'single_select') {
          if (selected) void onContinue({ kind: 'single', selected })
        } else if (step.type === 'multi_select') void onContinue({ kind: 'multi', values: multi })
        else if (step.type === 'payment_methods') void onContinue({ kind: 'payment', drafts: paymentDrafts })
        else if (step.type === 'income_entry') void onContinue({ kind: 'income', payload: incomePayload })
        else if (step.type === 'debt_entry') void onContinue({ kind: 'debt', payload: debtPayload })
        else if (step.type === 'subscriptions_detail')
          void onContinue({ kind: 'subscriptions', payload: subscriptionsPayload })
      }}
      className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {planLoading ? o.planLoading : finishing ? o.finishing : isLastSurveyStep ? o.lastStep : o.continueButton}
      {!finishing && !planLoading ? <ChevronRight className="w-4 h-4" /> : null}
    </button>
  )
}
