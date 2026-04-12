'use client'

import type { SurveyStep } from '@/lib/onboarding/surveyConfig'

export interface OnboardingSurveyStepHeaderProps {
  step: SurveyStep
  loadError: string | null
}

/**
 * Title, subtitle, remote load warning, and help text for a survey step.
 */
export function OnboardingSurveyStepHeader({ step, loadError }: OnboardingSurveyStepHeaderProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-brand-text-primary)] font-heading mb-1">{step.title}</h2>
      {'subtitle' in step && step.subtitle ? (
        <p className="text-xs text-[var(--color-brand-text-secondary)] mb-2">{step.subtitle}</p>
      ) : null}
      {loadError ? (
        <p className="text-[11px] text-amber-200/90 mb-2">
          We couldn&apos;t load the remote survey ({loadError}). No worries — using the built-in flow instead.
        </p>
      ) : null}
      {'helpText' in step && step.helpText ? (
        <p className="text-[11px] text-[var(--color-brand-text-muted)] leading-relaxed">{step.helpText}</p>
      ) : null}
    </div>
  )
}
