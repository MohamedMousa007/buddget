'use client'

import { CoreOnboardingView } from '@/components/features/onboarding/CoreOnboardingView'
import { JourneyRunner } from '@/components/features/onboarding/journey/JourneyRunner'

/**
 * Onboarding entry point. Default is the conversational Journey (flow
 * v3). Setting `NEXT_PUBLIC_ONBOARDING_V3="0"` renders the legacy Core
 * Gate as an emergency fallback — used only if a regression is spotted
 * in the Journey pipeline and we need to revert without a code push.
 *
 * The flag + `CoreOnboardingView` live on for one release as an escape
 * hatch; SP8 deletes them once the Journey has proven stable.
 */
export default function OnboardingPage() {
  if (process.env.NEXT_PUBLIC_ONBOARDING_V3 === '0') {
    return <CoreOnboardingView />
  }
  return <JourneyRunner />
}
