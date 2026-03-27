import type { OnboardingState } from '@/lib/store/types'

export const ONBOARDING_FLOW_VERSION = 2

export function defaultOnboardingState(): OnboardingState {
  return {
    flowVersion: ONBOARDING_FLOW_VERSION,
    answers: {},
    currentStepIndex: 0,
    planAccepted: false,
    selectedPlanIndex: null,
    aiPlans: null,
    aiGeneratedAt: null,
    lastValidationNotes: null,
  }
}
