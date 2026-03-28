'use client'

import { useOnboardingPage } from '@/hooks/useOnboardingPage'
import { OnboardingPageView } from '@/components/features/onboarding/OnboardingPageView'

export default function OnboardingPage() {
  const ctx = useOnboardingPage()
  return <OnboardingPageView {...ctx} />
}
