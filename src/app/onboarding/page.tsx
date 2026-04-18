'use client'

import { CoreOnboardingView } from '@/components/features/onboarding/CoreOnboardingView'

/**
 * The 4-step core-onboarding gate is now the only path. The legacy 27-step
 * expert survey has been retired; any in-flight drafts were drained by the
 * dashboard's legacy-onboarding migrator.
 */
export default function OnboardingPage() {
  return <CoreOnboardingView />
}
