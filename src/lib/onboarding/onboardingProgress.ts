import type { OnboardingState } from '@/lib/store/types'
import { ONBOARDING_FLOW_VERSION, defaultOnboardingState } from '@/lib/onboarding/onboardingTypes'

/** Survey-only step ids used for progress (excludes plan picker). */
export const EXPERT_SURVEY_STEP_IDS: string[] = [
  'expert_welcome',
  'display_name',
  'country',
  'city',
  'living_situation',
  'relationship_status',
  'dependents',
  'employment_type',
  'base_currency',
  'secondary_currency',
  'income_regularity',
  'income_entries',
  'housing_monthly',
  'debt_situation',
  'debt_entries',
  'financial_goals',
  'priority_focus',
  'spending_style',
  'transport_profile',
  'food_profile',
  'subscriptions_detail',
  'savings_orientation',
  'payment_methods',
  'pre_plan',
] as const

/** Steps that collect user data (excludes static intro / pre-plan screens). */
export const EXPERT_DATA_STEP_IDS = EXPERT_SURVEY_STEP_IDS.filter(
  (id) => id !== 'expert_welcome' && id !== 'pre_plan'
)

function countAnsweredDataSteps(answers: Record<string, unknown>): number {
  let c = 0
  for (const id of EXPERT_DATA_STEP_IDS) {
    const v = answers[id]
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && !v.trim()) continue
    if (Array.isArray(v) && v.length === 0) continue
    c += 1
  }
  return c
}

export function isExpertOnboardingComplete(onboarding: OnboardingState | undefined): boolean {
  if (!onboarding) return false
  return onboarding.flowVersion >= ONBOARDING_FLOW_VERSION && onboarding.planAccepted === true
}

const DATA_STEP_COUNT = EXPERT_DATA_STEP_IDS.length

/**
 * 0–100 for UI: based only on saved onboarding answers (not inferred from other app data),
 * so a fresh user with no survey input shows 0%.
 * 100 only when expert flow + plan accepted.
 */
export function getOnboardingCompletionPercent(onboardingState: OnboardingState | undefined): number {
  const ob = onboardingState ?? defaultOnboardingState()
  if (isExpertOnboardingComplete(ob)) return 100

  const answered = countAnsweredDataSteps(ob.answers)
  const pct = DATA_STEP_COUNT > 0 ? Math.round((answered / DATA_STEP_COUNT) * 100) : 0
  return Math.min(99, pct)
}

export function expertSurveyStepCount(): number {
  return EXPERT_SURVEY_STEP_IDS.length
}
