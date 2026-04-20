'use client'

import { CoreOnboardingView } from '@/components/features/onboarding/CoreOnboardingView'
import { JourneyRunner } from '@/components/features/onboarding/journey/JourneyRunner'

/**
 * Onboarding entry point. Default is the 4-step Core Gate (the legacy
 * 27-step expert survey was retired). When the `NEXT_PUBLIC_ONBOARDING_V3`
 * env var is set to `"1"`, the new AI-driven Journey (flow v3) is
 * rendered instead. Gate is build-time so the Core Gate path is
 * tree-shaken out of production bundles that opt into v3, and vice
 * versa.
 *
 * Flag lifetime: enabled in dev for internal QA. PR3 (after the Journey
 * is validated) removes the flag and deletes `CoreOnboardingView` along
 * with its supporting files.
 */
export default function OnboardingPage() {
  if (process.env.NEXT_PUBLIC_ONBOARDING_V3 === '1') {
    return <JourneyRunner />
  }
  return <CoreOnboardingView />
}
